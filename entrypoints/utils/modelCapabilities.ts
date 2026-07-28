export const REQUEST_POLICY_VERSION = 'ai-request-policy-f5de5b8a7c41'

export type OpenAIReasoningEffort = 'none' | 'minimal' | 'low' | 'medium'
export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high'

export interface OpenAITranslationPolicy {
    reasoningEffort?: OpenAIReasoningEffort
    removeTemperature: boolean
}

export interface GeminiTranslationPolicy {
    thinkingConfig?: {
        thinkingBudget?: number
        thinkingLevel?: GeminiThinkingLevel
    }
}

export interface AnthropicTranslationPolicy {
    thinking?: {
        type: 'enabled' | 'adaptive' | 'disabled'
        budget_tokens?: number
    }
    outputConfig?: {
        effort: 'low' | 'medium'
    }
    removeTemperature: boolean
}

export type TranslationFastModeProtocol = 'openai' | 'gemini' | 'anthropic' | 'deepseek'

export function normalizeTranslationModelId(model: string): string {
    return String(model || '')
        .trim()
        .replace(/^models\//i, '')
        .replace(/^[a-z0-9._-]+\//i, '')
        .replace(/（.*）/g, '')
        .toLowerCase()
}

export function resolveOpenAITranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    const originalGpt5 = /^gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)
    const gpt51 = /^gpt-5\.1(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)
    const o3 = /^o3(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)

    if (originalGpt5) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'minimal',
            removeTemperature: true,
        }
    }
    if (gpt51) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'none',
            removeTemperature: true,
        }
    }
    if (o3) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'low',
            removeTemperature: true,
        }
    }

    return { removeTemperature: false }
}

export function resolveGeminiTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): GeminiTranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    if (/^gemini-2\.5-pro(?:-|$)/.test(normalized)) {
        return {
            thinkingConfig: {
                thinkingBudget: thinkingWanted ? 1024 : 128,
            },
        }
    }
    if (/^gemini-2\.5-flash(?:-lite)?(?:-|$)/.test(normalized)) {
        return {
            thinkingConfig: {
                thinkingBudget: thinkingWanted ? 1024 : 0,
            },
        }
    }
    if (
        /^gemini-(?:3\.6|3\.5)-flash(?:-lite)?(?:-|$)/.test(normalized)
        || /^gemini-3\.1-flash-lite(?:-|$)/.test(normalized)
        || /^gemini-3-flash-preview(?:-|$)/.test(normalized)
    ) {
        return {
            thinkingConfig: {
                thinkingLevel: thinkingWanted ? 'medium' : 'minimal',
            },
        }
    }
    if (/^gemini-3\.1-pro(?:-|$)/.test(normalized)) {
        return {
            thinkingConfig: {
                thinkingLevel: thinkingWanted ? 'medium' : 'low',
            },
        }
    }
    return {}
}

export function resolveAnthropicTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): AnthropicTranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    const alwaysThinking = /^claude-(?:fable|mythos)-5(?:-|$)/.test(normalized)
    if (alwaysThinking) {
        return {
            outputConfig: { effort: thinkingWanted ? 'medium' : 'low' },
            removeTemperature: true,
        }
    }

    const claude5 = /^claude-(?:opus|sonnet)-5(?:-|$)/.test(normalized)
    if (claude5) {
        return {
            thinking: { type: thinkingWanted ? 'adaptive' : 'disabled' },
            outputConfig: { effort: thinkingWanted ? 'medium' : 'low' },
            removeTemperature: true,
        }
    }

    const gen47 = /^claude-opus-4-(?:7|8)(?:-|$)/.test(normalized)
    if (gen47) {
        return {
            ...(thinkingWanted
                ? {
                    thinking: { type: 'adaptive' as const },
                    outputConfig: { effort: 'medium' as const },
                }
                : {}),
            removeTemperature: true,
        }
    }

    const gen46 = /^claude-(?:opus|sonnet)-4-6(?:-|$)/.test(normalized)
    if (gen46) {
        return {
            ...(thinkingWanted
                ? {
                    thinking: { type: 'adaptive' as const },
                    outputConfig: { effort: 'medium' as const },
                }
                : {}),
            removeTemperature: thinkingWanted,
        }
    }

    const manualThinking = /^(?:claude-(?:haiku|sonnet|opus)-4-5(?:-\d{8})?|claude-sonnet-4-0|claude-sonnet-4-\d{8}|claude-opus-4-1(?:-\d{8})?|claude-opus-4-\d{8}|claude-3-7-sonnet(?:-\d{8})?)$/.test(normalized)
    if (manualThinking) {
        return {
            ...(thinkingWanted
                ? { thinking: { type: 'enabled' as const, budget_tokens: 1024 } }
                : {}),
            removeTemperature: thinkingWanted,
        }
    }

    return { removeTemperature: false }
}

export function supportsTranslationFastMode(
    protocol: TranslationFastModeProtocol,
    model: string,
): boolean {
    if (protocol === 'deepseek') return true
    if (protocol === 'openai') {
        return Boolean(resolveOpenAITranslationPolicy(model, false).reasoningEffort)
    }
    if (protocol === 'gemini') {
        return Boolean(resolveGeminiTranslationPolicy(model, false).thinkingConfig)
    }

    const policy = resolveAnthropicTranslationPolicy(model, true)
    return Boolean(policy.thinking || policy.outputConfig || policy.removeTemperature)
}
