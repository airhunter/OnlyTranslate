import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
    service: 'openai',
    model: {
        openai: 'gpt-5-mini',
        gemini: 'gemini-2.5-pro',
        claude: 'claude-haiku-4-5',
    } as Record<string, string>,
    customModel: {} as Record<string, string>,
    customProviders: [],
    system_role: {} as Record<string, string>,
    user_role: {} as Record<string, string>,
    thinking: {} as Record<string, boolean>,
}))

vi.mock('@/entrypoints/utils/config', () => ({ config: mockConfig }))

import {
    REQUEST_POLICY_VERSION,
    resolveAnthropicTranslationPolicy,
    resolveGeminiTranslationPolicy,
    resolveOpenAITranslationPolicy,
} from '@/entrypoints/utils/modelCapabilities'
import {
    claudeMsgTemplate,
    claudeSubtitleBatchMsgTemplate,
    commonBatchMsgTemplate,
    commonMsgTemplate,
    commonSubtitleBatchMsgTemplate,
    geminiMsgTemplate,
    geminiSubtitleBatchMsgTemplate,
} from '@/entrypoints/utils/template'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const subtitleJob: SubtitleTranslationJob = {
    trackKey: 'youtube|video|en|||',
    sessionId: '1',
    title: 'Policy matrix',
    sourceLanguage: 'en',
    targetLanguage: 'zh-Hans',
    promptVersion: 'subtitle-context-v1',
    entries: [{ id: 'target', role: 'target', text: 'Hello.' }],
}

const openAICases = [
    'gpt-4.1',
    'gpt-5-chat-latest',
    'gpt-5-mini',
    'openai/gpt-5-mini',
    'gpt-5.1-2026-01-01',
    'o3-mini-2025-01-31',
    'anthropic/claude-opus-4-8',
    'google/gemini-3.6-flash',
    'gpt5',
]
const geminiCases = [
    'models/gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-3.6-flash',
    'google/gemini-3.6-flash',
    'gemini-3.1-pro',
    'gemini-future',
]
const anthropicCases = [
    'claude-haiku-4-5',
    'claude-sonnet-4-6',
    'claude-opus-4-8',
    'anthropic/claude-opus-4-8',
    'claude-opus-5',
    'claude-fable-5',
    'claude-future',
]

function policySnapshot() {
    return {
        openai: Object.fromEntries(openAICases.map(model => [
            model,
            {
                fast: resolveOpenAITranslationPolicy(model, false),
                thinking: resolveOpenAITranslationPolicy(model, true),
            },
        ])),
        gemini: Object.fromEntries(geminiCases.map(model => [
            model,
            {
                fast: resolveGeminiTranslationPolicy(model, false),
                thinking: resolveGeminiTranslationPolicy(model, true),
            },
        ])),
        anthropic: Object.fromEntries(anthropicCases.map(model => [
            model,
            {
                fast: resolveAnthropicTranslationPolicy(model, false),
                thinking: resolveAnthropicTranslationPolicy(model, true),
            },
        ])),
    }
}

function openAIControls(payload: Record<string, unknown>) {
    return {
        reasoning_effort: payload.reasoning_effort ?? null,
        hasTemperature: Object.hasOwn(payload, 'temperature'),
    }
}

function geminiControls(payload: Record<string, unknown>) {
    const generationConfig = payload.generationConfig as Record<string, unknown>
    return generationConfig.thinkingConfig ?? null
}

function anthropicControls(payload: Record<string, unknown>) {
    return {
        thinking: payload.thinking ?? null,
        output_config: payload.output_config ?? null,
        hasTemperature: Object.hasOwn(payload, 'temperature'),
    }
}

function templateSnapshot() {
    const snapshot: Record<string, unknown> = {}

    for (const model of openAICases) {
        mockConfig.service = 'openai'
        mockConfig.model.openai = model
        snapshot[`openai:${model}`] = {
            fast: {
                single: openAIControls(JSON.parse(commonMsgTemplate('Hello', 'zh-Hans', true))),
                batch: openAIControls(JSON.parse(commonBatchMsgTemplate(['Hello'], 'zh-Hans', true))),
                subtitle: openAIControls(JSON.parse(commonSubtitleBatchMsgTemplate(subtitleJob, true))),
            },
            thinking: {
                single: openAIControls(JSON.parse(commonMsgTemplate('Hello', 'zh-Hans', false))),
                batch: openAIControls(JSON.parse(commonBatchMsgTemplate(['Hello'], 'zh-Hans', false))),
                subtitle: openAIControls(JSON.parse(commonSubtitleBatchMsgTemplate(subtitleJob, false))),
            },
        }
    }

    for (const model of geminiCases) {
        mockConfig.service = 'gemini'
        mockConfig.model.gemini = model
        snapshot[`gemini:${model}`] = {
            fast: {
                single: geminiControls(JSON.parse(geminiMsgTemplate('Hello', 'zh-Hans', true))),
                subtitle: geminiControls(JSON.parse(geminiSubtitleBatchMsgTemplate(subtitleJob, true))),
            },
            thinking: {
                single: geminiControls(JSON.parse(geminiMsgTemplate('Hello', 'zh-Hans', false))),
                subtitle: geminiControls(JSON.parse(geminiSubtitleBatchMsgTemplate(subtitleJob, false))),
            },
        }
    }

    for (const model of anthropicCases) {
        mockConfig.service = 'claude'
        mockConfig.model.claude = model
        snapshot[`anthropic:${model}`] = {
            fast: {
                single: anthropicControls(JSON.parse(claudeMsgTemplate('Hello', 'zh-Hans', true))),
                subtitle: anthropicControls(JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, true))),
            },
            thinking: {
                single: anthropicControls(JSON.parse(claudeMsgTemplate('Hello', 'zh-Hans', false))),
                subtitle: anthropicControls(JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, false))),
            },
        }
    }

    return snapshot
}

describe('translation model request policies', () => {
    beforeEach(() => {
        mockConfig.service = 'openai'
        mockConfig.model.openai = 'gpt-5-mini'
        mockConfig.model.gemini = 'gemini-2.5-pro'
        mockConfig.model.claude = 'claude-haiku-4-5'
        mockConfig.thinking = {
            openai: true,
            gemini: true,
            claude: true,
        }
    })

    it('matches the reviewed capability registry', () => {
        expect(policySnapshot()).toMatchSnapshot()
    })

    it('recognizes provider-qualified models without crossing protocol policies', () => {
        expect(resolveOpenAITranslationPolicy('openai/gpt-5-mini', false))
            .toEqual(resolveOpenAITranslationPolicy('gpt-5-mini', false))
        expect(resolveGeminiTranslationPolicy('google/gemini-3.6-flash', false))
            .toEqual(resolveGeminiTranslationPolicy('gemini-3.6-flash', false))
        expect(resolveAnthropicTranslationPolicy('anthropic/claude-opus-4-8', false))
            .toEqual(resolveAnthropicTranslationPolicy('claude-opus-4-8', false))

        expect(resolveOpenAITranslationPolicy('anthropic/claude-opus-4-8', false))
            .toEqual({ removeTemperature: false })
        expect(resolveOpenAITranslationPolicy('google/gemini-3.6-flash', false))
            .toEqual({ removeTemperature: false })
    })

    it('matches the normalized payload matrix for every template surface', () => {
        expect(templateSnapshot()).toMatchSnapshot()
    })

    it('binds payload changes to the cache policy version', () => {
        const matrix = {
            policies: policySnapshot(),
            templates: templateSnapshot(),
        }
        const digest = createHash('sha256')
            .update(JSON.stringify(matrix))
            .digest('hex')
            .slice(0, 12)

        expect(REQUEST_POLICY_VERSION).toBe(`ai-request-policy-${digest}`)
    })

    it('ignores the raw thinking switch whenever FastMode is enabled', () => {
        for (const service of ['openai', 'gemini', 'claude']) {
            mockConfig.service = service
            mockConfig.thinking[service] = false
            const withoutThinking = service === 'openai'
                ? openAIControls(JSON.parse(commonSubtitleBatchMsgTemplate(subtitleJob, true)))
                : service === 'gemini'
                    ? geminiControls(JSON.parse(geminiSubtitleBatchMsgTemplate(subtitleJob, true)))
                    : anthropicControls(JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, true)))
            mockConfig.thinking[service] = true
            const withThinking = service === 'openai'
                ? openAIControls(JSON.parse(commonSubtitleBatchMsgTemplate(subtitleJob, true)))
                : service === 'gemini'
                    ? geminiControls(JSON.parse(geminiSubtitleBatchMsgTemplate(subtitleJob, true)))
                    : anthropicControls(JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, true)))

            expect(withThinking).toEqual(withoutThinking)
        }
    })
})
