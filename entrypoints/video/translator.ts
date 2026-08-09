import browser from 'webextension-polyfill'
import type {
    SubtitleTranslationEntry,
    SubtitleTranslationJob,
    SubtitleTranslationLane,
    SubtitleTranslationResult,
} from './types'
import { SUBTITLE_TRANSLATION_PROMPT_VERSION } from '@/entrypoints/service/subtitle'
import { config } from '@/entrypoints/utils/config'
import { detectlang } from '@/entrypoints/utils/common'
import { defaultOption, services, servicesType } from '@/entrypoints/utils/option'
import { enqueueTranslation } from '@/entrypoints/utils/translateQueue'
import {
    createDiagnosticMetadata,
    createTranslationDiagnosticId,
    type TranslationDiagnosticContext,
} from '@/entrypoints/utils/translationDiagnostics'

const REQUEST_TIMEOUT_MS = 45_000
const MAX_SINGLE_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000
const DEGRADED_REQUEST_TIMEOUT_MS = 20_000
const DEGRADED_MAX_SINGLE_RETRIES = 1
const DEGRADED_BATCH_DEADLINE_MS = 30_000

const STRUCTURED_SUBTITLE_SERVICES = new Set<string>([
    services.openai,
    services.moonshot,
    services.jieyue,
    services.siliconCloud,
    services.openrouter,
    services.grok,
    services.deepseek,
    services.newapi,
    services.gemini,
    services.claude,
])

interface SubtitleTranslationDirection {
    sourceLanguage: string
    targetLanguage: string
    shouldTranslate: boolean
}

export interface SubtitleTranslationOptions {
    signal?: AbortSignal
    lane: SubtitleTranslationLane
    onPartialResult?: (result: SubtitleTranslationResult) => void
    effectiveFastMode?: boolean
    onQualityRequestResult?: (result: SubtitleQualityRequestResult) => void
}

export type SubtitleQualityRequestResult = 'success' | 'timeout' | 'failure'

interface SingleTranslationPolicy {
    requestTimeoutMs: number
    maxRetries: number
    batchDeadlineMs?: number
}

const DEFAULT_SINGLE_POLICY: SingleTranslationPolicy = {
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_SINGLE_RETRIES,
}

const DEGRADED_SINGLE_POLICY: SingleTranslationPolicy = {
    requestTimeoutMs: DEGRADED_REQUEST_TIMEOUT_MS,
    maxRetries: DEGRADED_MAX_SINGLE_RETRIES,
    batchDeadlineMs: DEGRADED_BATCH_DEADLINE_MS,
}

class SubtitleRequestTimeoutError extends Error {
    constructor() {
        super('Subtitle translation request timed out')
        this.name = 'SubtitleRequestTimeoutError'
    }
}

function normalizeLanguage(language?: string): string {
    const normalized = String(language || '').trim().replace('_', '-').toLowerCase()
    if (!normalized) return ''
    if (normalized === 'zh-hant' || /^(zh-(tw|hk|mo))/.test(normalized)) return 'zh-Hant'
    if (normalized === 'zh-hans' || normalized === 'zh' || /^zh-(cn|sg)/.test(normalized)) return 'zh-Hans'
    return normalized.split('-')[0]
}

function resolveSubtitleDirection(job: SubtitleTranslationJob): SubtitleTranslationDirection {
    const sample = job.entries.map(entry => entry.text).join(' ')
    const sourceLanguage = normalizeLanguage(job.sourceLanguage) || normalizeLanguage(detectlang(sample))
    let targetLanguage = normalizeLanguage(job.targetLanguage || config.to)

    if (
        config.bidirectionalTranslation
        && config.bidirectionalTarget
        && sourceLanguage === normalizeLanguage(config.to)
    ) {
        targetLanguage = normalizeLanguage(config.bidirectionalTarget)
    }

    return {
        sourceLanguage,
        targetLanguage,
        shouldTranslate: Boolean(sourceLanguage && targetLanguage && sourceLanguage !== targetLanguage),
    }
}

function usesDefaultPrompt(): boolean {
    const userPrompt = config.user_role?.[config.service]
    const systemPrompt = config.system_role?.[config.service]
    return (!userPrompt || userPrompt === defaultOption.user_role)
        && (!systemPrompt || systemPrompt === defaultOption.system_role)
}

export function canUseStructuredSubtitleTranslation(): boolean {
    return servicesType.isAI(config.service)
        && (config.service.startsWith('custom_') || STRUCTURED_SUBTITLE_SERVICES.has(config.service))
        && usesDefaultPrompt()
}

function targetEntries(job: SubtitleTranslationJob): SubtitleTranslationEntry[] {
    return job.entries.filter(entry => entry.role === 'target')
}

function normalizeRuntimeText(response: unknown): string {
    if (typeof response === 'string') return response.trim()
    if (response && typeof response === 'object' && 'result' in response) {
        const result = (response as { result?: unknown }).result
        return result == null ? '' : String(result).trim()
    }
    return response == null ? '' : String(response).trim()
}

function createAbortError(): Error {
    const error = new Error('Subtitle translation request cancelled')
    error.name = 'AbortError'
    return error
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise

    return new Promise<T>((resolve, reject) => {
        let settled = false
        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            signal.removeEventListener('abort', handleAbort)
            callback()
        }
        const handleAbort = () => finish(() => reject(createAbortError()))

        if (signal.aborted) {
            handleAbort()
            return
        }
        signal.addEventListener('abort', handleAbort, { once: true })
        promise.then(
            value => finish(() => resolve(value)),
            error => finish(() => reject(error)),
        )
    })
}

function withTimeout<T>(
    promise: Promise<T>,
    signal?: AbortSignal,
    timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false
        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            signal?.removeEventListener('abort', handleAbort)
            callback()
        }
        const handleAbort = () => finish(() => reject(createAbortError()))
        const timer = setTimeout(
            () => finish(() => reject(new SubtitleRequestTimeoutError())),
            timeoutMs,
        )

        if (signal?.aborted) {
            handleAbort()
            return
        }
        signal?.addEventListener('abort', handleAbort, { once: true })
        promise.then(
            value => finish(() => resolve(value)),
            error => finish(() => reject(error)),
        )
    })
}

function validateRuntimeResults(
    response: unknown,
    job: SubtitleTranslationJob,
): SubtitleTranslationResult[] {
    if (!Array.isArray(response)) {
        throw new Error('Subtitle translation response is not an array')
    }
    const expectedIds = targetEntries(job).map(entry => entry.id)
    const results = response.map(item => {
        if (!item || typeof item !== 'object') {
            throw new Error('Subtitle translation response item is invalid')
        }
        const id = (item as { id?: unknown }).id
        const translatedText = (item as { translatedText?: unknown }).translatedText
        if (typeof id !== 'string' || typeof translatedText !== 'string' || !translatedText.trim()) {
            throw new Error('Subtitle translation response item is incomplete')
        }
        return { id, translatedText: translatedText.trim() }
    })
    if (results.length !== expectedIds.length
        || results.some((result, index) => result.id !== expectedIds[index])) {
        throw new Error('Subtitle translation response ids do not match the requested targets')
    }
    return results
}

async function requestStructuredBatch(
    job: SubtitleTranslationJob,
    lane: SubtitleTranslationLane,
    fastMode: boolean,
    signal?: AbortSignal,
    diagnosticContext?: TranslationDiagnosticContext,
): Promise<SubtitleTranslationResult[]> {
    const queuedAt = Date.now()
    const response = await withAbort(enqueueTranslation(
        () => {
            if (signal?.aborted) throw createAbortError()
            return withTimeout(browser.runtime.sendMessage({
                type: 'SUBTITLE_BATCH_TRANSLATION',
                job,
                sourceLang: job.sourceLanguage,
                targetLang: job.targetLanguage,
                fastMode,
                diagnostics: createDiagnosticMetadata(diagnosticContext, 0, queuedAt),
            }), signal, REQUEST_TIMEOUT_MS)
        },
        { priority: lane === 'foreground' ? 'high' : 'background' },
    ), signal)
    return validateRuntimeResults(response, job)
}

function retryDelay(retryCount: number): number {
    return Math.min(BASE_RETRY_DELAY_MS * (2 ** retryCount), MAX_RETRY_DELAY_MS)
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const handleAbort = () => {
            clearTimeout(timer)
            reject(createAbortError())
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', handleAbort)
            resolve()
        }, delay)

        if (signal?.aborted) {
            handleAbort()
            return
        }
        signal?.addEventListener('abort', handleAbort, { once: true })
    })
}

async function requestSingleSubtitle(
    entry: SubtitleTranslationEntry,
    job: SubtitleTranslationJob,
    fastMode: boolean,
    policy: SingleTranslationPolicy,
    onQualityRequestResult?: SubtitleTranslationOptions['onQualityRequestResult'],
    retryCount = 0,
    signal?: AbortSignal,
    diagnosticContext?: TranslationDiagnosticContext,
): Promise<string> {
    if (signal?.aborted) throw createAbortError()
    try {
        const response = await withTimeout(browser.runtime.sendMessage({
            context: job.title,
            origin: entry.text,
            sourceLang: job.sourceLanguage,
            targetLang: job.targetLanguage,
            fastMode,
            diagnostics: createDiagnosticMetadata(diagnosticContext, retryCount, Date.now()),
        }), signal, policy.requestTimeoutMs)
        const result = normalizeRuntimeText(response)
        if (!result) throw new Error('Subtitle translation response is empty')
        notifyQualityRequestResult(onQualityRequestResult, 'success')
        return result
    } catch (error) {
        if (signal?.aborted) throw createAbortError()
        notifyQualityRequestResult(
            onQualityRequestResult,
            error instanceof SubtitleRequestTimeoutError ? 'timeout' : 'failure',
        )
        if (signal?.aborted) throw createAbortError()
        if (retryCount >= policy.maxRetries) throw error
        await waitForRetry(retryDelay(retryCount), signal)
        return requestSingleSubtitle(
            entry,
            job,
            fastMode,
            policy,
            onQualityRequestResult,
            retryCount + 1,
            signal,
            diagnosticContext,
        )
    }
}

function createDeadlineSignal(parentSignal: AbortSignal | undefined, deadlineMs: number | undefined) {
    if (!deadlineMs) {
        return {
            signal: parentSignal,
            cleanup: () => undefined,
        }
    }

    const controller = new AbortController()
    const handleParentAbort = () => controller.abort()
    if (parentSignal?.aborted) controller.abort()
    else parentSignal?.addEventListener('abort', handleParentAbort, { once: true })
    const timer = setTimeout(() => controller.abort(), deadlineMs)
    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timer)
            parentSignal?.removeEventListener('abort', handleParentAbort)
        },
    }
}

function notifyQualityRequestResult(
    callback: SubtitleTranslationOptions['onQualityRequestResult'],
    result: SubtitleQualityRequestResult,
) {
    try {
        callback?.(result)
    } catch {
        // Runtime observers must not change translation or fallback behavior.
    }
}

async function translateWithSingles(
    job: SubtitleTranslationJob,
    options: SubtitleTranslationOptions,
    cacheable: boolean,
    fastMode: boolean,
    policy: SingleTranslationPolicy = DEFAULT_SINGLE_POLICY,
    reportQualityResults = false,
    diagnosticContext?: TranslationDiagnosticContext,
): Promise<SubtitleTranslationResult[]> {
    const {
        signal: parentSignal,
        lane,
        onPartialResult,
        onQualityRequestResult,
    } = options
    if (parentSignal?.aborted) return []
    const deadline = createDeadlineSignal(parentSignal, policy.batchDeadlineMs)
    const signal = deadline.signal
    const targets = targetEntries(job)
    const results: Array<SubtitleTranslationResult | undefined> = new Array(targets.length)
    const workerCount = Math.min(lane === 'foreground' ? 2 : 1, targets.length)
    const priority = lane === 'foreground' ? 'high' : 'background'
    let nextTargetIndex = 0

    const runWorker = async () => {
        while (!signal?.aborted) {
            const targetIndex = nextTargetIndex++
            if (targetIndex >= targets.length) return
            const entry = targets[targetIndex]

            try {
                const translatedText = await withAbort(enqueueTranslation(
                    () => requestSingleSubtitle(
                        entry,
                        job,
                        fastMode,
                        policy,
                        reportQualityResults ? onQualityRequestResult : undefined,
                        0,
                        signal,
                        diagnosticContext,
                    ),
                    { priority },
                ), signal)
                if (signal?.aborted) return
                if (!translatedText.trim()) continue

                const result: SubtitleTranslationResult = {
                    id: entry.id,
                    translatedText: translatedText.trim(),
                    cacheable,
                }
                results[targetIndex] = result
                try {
                    onPartialResult?.(result)
                } catch {
                    // A consumer callback must not turn a successful translation into a retry.
                }
            } catch {
                if (signal?.aborted) return
            }
        }
    }

    try {
        await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
        return results.filter((result): result is SubtitleTranslationResult => Boolean(result))
    } finally {
        deadline.cleanup()
    }
}

export async function translateSubtitleBatch(
    rawJob: SubtitleTranslationJob,
    options: SubtitleTranslationOptions = { lane: 'foreground' },
): Promise<SubtitleTranslationResult[]> {
    const { signal, lane, onQualityRequestResult } = options
    const fastMode = options.effectiveFastMode ?? config.videoSubtitleFastMode !== false
    const diagnosticContext: TranslationDiagnosticContext = {
        sessionId: createTranslationDiagnosticId('video'),
        scene: 'video',
        startedAt: Date.now(),
        pageUrl: typeof document === 'undefined' ? undefined : document.location.href,
    }
    const direction = resolveSubtitleDirection(rawJob)
    const job: SubtitleTranslationJob = {
        ...rawJob,
        sourceLanguage: direction.sourceLanguage,
        targetLanguage: direction.targetLanguage,
        promptVersion: rawJob.promptVersion || SUBTITLE_TRANSLATION_PROMPT_VERSION,
    }

    if (!direction.shouldTranslate) {
        return targetEntries(job).map(entry => ({
            id: entry.id,
            translatedText: entry.text,
            cacheable: true,
        }))
    }

    if (canUseStructuredSubtitleTranslation()) {
        try {
            const results = await requestStructuredBatch(job, lane, fastMode, signal, diagnosticContext)
            if (!fastMode) notifyQualityRequestResult(onQualityRequestResult, 'success')
            return results.map(result => ({ ...result, cacheable: true }))
        } catch (error) {
            if (signal?.aborted) return []
            if (!fastMode) {
                const result = error instanceof SubtitleRequestTimeoutError ? 'timeout' : 'failure'
                notifyQualityRequestResult(onQualityRequestResult, result)
                if (signal?.aborted) return []
            }
            return translateWithSingles(job, options, false, true, DEGRADED_SINGLE_POLICY, false, diagnosticContext)
        }
    }

    return translateWithSingles(
        job,
        options,
        true,
        fastMode,
        DEFAULT_SINGLE_POLICY,
        !fastMode && servicesType.isAI(config.service),
        diagnosticContext,
    )
}

export { SUBTITLE_TRANSLATION_PROMPT_VERSION }

export const subtitleTranslationDefaults = Object.freeze({
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxSingleRetries: MAX_SINGLE_RETRIES,
    degradedRequestTimeoutMs: DEGRADED_REQUEST_TIMEOUT_MS,
    degradedMaxSingleRetries: DEGRADED_MAX_SINGLE_RETRIES,
    degradedBatchDeadlineMs: DEGRADED_BATCH_DEADLINE_MS,
})
