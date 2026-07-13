import browser from 'webextension-polyfill'
import type {
    SubtitleTranslationEntry,
    SubtitleTranslationJob,
    SubtitleTranslationResult,
} from './types'
import { SUBTITLE_TRANSLATION_PROMPT_VERSION } from '@/entrypoints/service/subtitle'
import { config } from '@/entrypoints/utils/config'
import { detectlang } from '@/entrypoints/utils/common'
import { defaultOption, services, servicesType } from '@/entrypoints/utils/option'
import { enqueueTranslation } from '@/entrypoints/utils/translateQueue'

const REQUEST_TIMEOUT_MS = 45_000
const MAX_SINGLE_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000

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

function withTimeout<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
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
            () => finish(() => reject(new Error('Subtitle translation request timed out'))),
            REQUEST_TIMEOUT_MS,
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
    signal?: AbortSignal,
): Promise<SubtitleTranslationResult[]> {
    const response = await enqueueTranslation(
        () => {
            if (signal?.aborted) throw createAbortError()
            return withTimeout(browser.runtime.sendMessage({
                type: 'SUBTITLE_BATCH_TRANSLATION',
                job,
                sourceLang: job.sourceLanguage,
                targetLang: job.targetLanguage,
                fastMode: true,
            }), signal)
        },
        { priority: 'high' },
    )
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
    retryCount = 0,
    signal?: AbortSignal,
): Promise<string> {
    if (signal?.aborted) throw createAbortError()
    try {
        const response = await withTimeout(browser.runtime.sendMessage({
            context: job.title,
            origin: entry.text,
            sourceLang: job.sourceLanguage,
            targetLang: job.targetLanguage,
            fastMode: true,
        }), signal)
        const result = normalizeRuntimeText(response)
        if (!result) throw new Error('Subtitle translation response is empty')
        return result
    } catch (error) {
        if (signal?.aborted) throw createAbortError()
        if (retryCount >= MAX_SINGLE_RETRIES) throw error
        await waitForRetry(retryDelay(retryCount), signal)
        return requestSingleSubtitle(entry, job, retryCount + 1, signal)
    }
}

async function fallbackToSingles(
    job: SubtitleTranslationJob,
    signal?: AbortSignal,
): Promise<SubtitleTranslationResult[]> {
    if (signal?.aborted) return []
    const targets = targetEntries(job)
    const settled = await Promise.allSettled(targets.map(entry => enqueueTranslation(
        () => requestSingleSubtitle(entry, job, 0, signal),
        { priority: 'high' },
    )))

    return settled.flatMap((result, index) => result.status === 'fulfilled' && result.value.trim()
        ? [{ id: targets[index].id, translatedText: result.value.trim() }]
        : [])
}

export async function translateSubtitleBatch(
    rawJob: SubtitleTranslationJob,
    signal?: AbortSignal,
): Promise<SubtitleTranslationResult[]> {
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
        }))
    }

    if (canUseStructuredSubtitleTranslation()) {
        try {
            return await requestStructuredBatch(job, signal)
        } catch {
            if (signal?.aborted) return []
            return fallbackToSingles(job, signal)
        }
    }

    return fallbackToSingles(job, signal)
}

export { SUBTITLE_TRANSLATION_PROMPT_VERSION }
