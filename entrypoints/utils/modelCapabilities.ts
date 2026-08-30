export const REQUEST_POLICY_VERSION = 'ai-request-policy-45a2a1ebc84d'

export type OpenAIReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high'

export interface OpenAITranslationPolicy {
    reasoningEffort?: OpenAIReasoningEffort
    reasoning?: {
        effort: OpenAIReasoningEffort
    }
    thinking?: {
        type: 'enabled' | 'disabled'
    }
    enableThinking?: boolean
    temperature?: number
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

export type OpenAICompatibleProvider =
    | 'openai'
    | 'deepseek'
    | 'zhipu'
    | 'moonshot'
    | 'dashscope'
    | 'siliconflow'
    | 'xai'
    | 'openrouter'
    | 'generic'

export type TranslationFastModeProtocol = OpenAICompatibleProvider | 'gemini' | 'anthropic'

export function normalizeTranslationModelId(model: string): string {
    return String(model || '')
        .trim()
        .replace(/^models\//i, '')
        .replace(/^(?:[a-z0-9._-]+\/)+/i, '')
        .replace(/（.*）/g, '')
        .toLowerCase()
}

export function inferOpenAICompatibleProvider(
    service: string,
    model: string,
    endpoint = '',
): OpenAICompatibleProvider {
    const normalizedEndpoint = endpoint.toLowerCase()
    if (normalizedEndpoint.includes('openrouter.ai')) return 'openrouter'
    if (normalizedEndpoint.includes('api.deepseek.com')) return 'deepseek'
    if (normalizedEndpoint.includes('open.bigmodel.cn')) return 'zhipu'
    if (normalizedEndpoint.includes('api.moonshot.') || normalizedEndpoint.includes('platform.kimi.')) return 'moonshot'
    if (normalizedEndpoint.includes('api.siliconflow.cn')) return 'siliconflow'
    if (normalizedEndpoint.includes('aliyuncs.com') || normalizedEndpoint.includes('dashscope.aliyun.com')) return 'dashscope'
    if (normalizedEndpoint.includes('api.x.ai')) return 'xai'
    if (normalizedEndpoint.includes('api.openai.com') || normalizedEndpoint.includes('openai.azure.com')) return 'openai'

    if (service === 'openai') return 'openai'
    if (service === 'deepseek') return 'deepseek'
    if (service === 'zhipu') return 'zhipu'
    if (service === 'moonshot') return 'moonshot'
    if (service === 'siliconCloud') return 'siliconflow'
    if (service === 'grok') return 'xai'
    if (service === 'openrouter') return 'openrouter'

    const normalizedModel = normalizeTranslationModelId(model)
    if (/^(?:gpt-|gpt5$|o\d(?:-|$))/.test(normalizedModel)) return 'openai'
    if (/^deepseek-(?!r1)/.test(normalizedModel)) return 'deepseek'
    if (/^glm-/.test(normalizedModel)) return 'zhipu'
    if (/^kimi-/.test(normalizedModel)) return 'moonshot'
    if (/^grok-/.test(normalizedModel)) return 'xai'
    if (/^qwen3(?:[.-]|$)/.test(normalizedModel)) return 'siliconflow'
    return 'generic'
}

export function resolveOpenAITranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    const originalGpt5 = /^gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)
    const modernGpt5 = /^gpt-5\.(?:[1-9]\d*)(?:-(?:sol|terra|luna|mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)
    const gpt5Alias = normalized === 'gpt5'
    const gpt5Pro = /^gpt-5(?:\.\d+)?-pro(?:-|$)/.test(normalized)
    const oSeries = /^o(?:3(?:-mini)?|4-mini)(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)

    if (originalGpt5) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'minimal',
            removeTemperature: true,
        }
    }
    if (modernGpt5) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'none',
            removeTemperature: true,
        }
    }
    if (gpt5Alias) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'minimal',
            removeTemperature: true,
        }
    }
    if (gpt5Pro) {
        return {
            reasoningEffort: 'high',
            removeTemperature: true,
        }
    }
    if (oSeries) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'low',
            removeTemperature: true,
        }
    }

    return { removeTemperature: false }
}

function resolveDeepSeekTranslationPolicy(thinkingWanted: boolean): OpenAITranslationPolicy {
    return {
        thinking: { type: thinkingWanted ? 'enabled' : 'disabled' },
        ...(thinkingWanted ? { reasoningEffort: 'high' as const } : {}),
        removeTemperature: thinkingWanted,
    }
}

function resolveZhipuTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    if (/^glm-(?:4\.(?:5|6|7|8)|5(?:\.|-|$))/.test(normalized)) {
        return {
            thinking: { type: thinkingWanted ? 'enabled' : 'disabled' },
            removeTemperature: false,
        }
    }
    return { removeTemperature: false }
}

function resolveMoonshotTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    if (/^kimi-k2\.(?:5|6)(?:-|$)/.test(normalized)) {
        return {
            thinking: { type: thinkingWanted ? 'enabled' : 'disabled' },
            temperature: thinkingWanted ? 1 : 0.6,
            removeTemperature: false,
        }
    }
    if (/^kimi-k2\.7-code(?:-|$)/.test(normalized)) {
        return {
            thinking: { type: 'enabled' },
            removeTemperature: true,
        }
    }
    if (/^kimi-k3(?:-|$)/.test(normalized)) {
        return {
            reasoningEffort: thinkingWanted ? 'high' : 'low',
            removeTemperature: true,
        }
    }
    if (/^kimi-k2-thinking(?:-|$)/.test(normalized)) {
        return { removeTemperature: true }
    }
    return { removeTemperature: false }
}

function supportsSiliconFlowThinkingSwitch(model: string): boolean {
    const normalized = normalizeTranslationModelId(model)
    if (/^qwen3(?:[.-]|$)/.test(normalized)) {
        return !normalized.includes('coder') && !normalized.includes('thinking')
    }
    return /^glm-(?:4\.5v|4\.6|4\.7|5(?:\.|-|$))/.test(normalized)
        || /^deepseek-v3\.(?:1|2)(?:-|$)/.test(normalized)
}

function resolveSiliconFlowTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    if (!supportsSiliconFlowThinkingSwitch(model)) return { removeTemperature: false }
    return {
        enableThinking: thinkingWanted,
        removeTemperature: false,
    }
}

function resolveDashScopeTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    const supportsThinkingSwitch = (
        /^qwen3(?:[.-]|$)/.test(normalized)
        || /^qwen-(?:plus|max|flash|turbo)(?:-|$)/.test(normalized)
        || /^deepseek-v(?:4-(?:pro|flash)|3\.(?:1|2))(?:-|$)/.test(normalized)
        || /^kimi-k2\.(?:5|6)(?:-|$)/.test(normalized)
        || /^glm-/.test(normalized)
    ) && !normalized.includes('thinking')

    if (!supportsThinkingSwitch) return { removeTemperature: false }
    return {
        enableThinking: thinkingWanted,
        ...(/^kimi-k2\.(?:5|6)(?:-|$)/.test(normalized)
            ? { temperature: thinkingWanted ? 1 : 0.6 }
            : {}),
        removeTemperature: false,
    }
}

function resolveXAITranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    if (/^grok-(?:4-0709|4\.3)(?:-|$)/.test(normalized)) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'none',
            removeTemperature: true,
        }
    }
    if (/^grok-4\.5(?:-|$)/.test(normalized)) {
        return {
            reasoningEffort: thinkingWanted ? 'medium' : 'low',
            removeTemperature: true,
        }
    }
    if (/^grok-3-mini(?:-|$)/.test(normalized)) {
        return {
            reasoningEffort: thinkingWanted ? 'high' : 'low',
            removeTemperature: true,
        }
    }
    return { removeTemperature: false }
}

function toOpenRouterPolicy(policy: OpenAITranslationPolicy): OpenAITranslationPolicy {
    return {
        ...(policy.reasoningEffort
            ? { reasoning: { effort: policy.reasoningEffort } }
            : {}),
        removeTemperature: policy.removeTemperature || Boolean(policy.reasoningEffort),
    }
}

function resolveOpenRouterTranslationPolicy(
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    const normalized = normalizeTranslationModelId(model)
    for (const resolver of [
        resolveOpenAITranslationPolicy,
        resolveXAITranslationPolicy,
        resolveMoonshotTranslationPolicy,
    ]) {
        const policy = resolver(model, thinkingWanted)
        if (policy.reasoningEffort) return toOpenRouterPolicy(policy)
    }

    const geminiPolicy = resolveGeminiTranslationPolicy(model, thinkingWanted).thinkingConfig
    if (geminiPolicy) {
        const effort = geminiPolicy.thinkingLevel
            || (geminiPolicy.thinkingBudget === 0 ? 'none' : geminiPolicy.thinkingBudget === 128 ? 'minimal' : 'medium')
        return { reasoning: { effort }, removeTemperature: true }
    }

    if (
        /^qwen3(?:[.-]|$)/.test(normalized)
        || /^glm-(?:4\.(?:5|6|7|8)|5(?:\.|-|$))/.test(normalized)
    ) {
        return {
            reasoning: { effort: thinkingWanted ? 'medium' : 'none' },
            removeTemperature: true,
        }
    }
    if (/(?:^|[-.])(?:r1|z1|thinking)(?:-|$)/.test(normalized)) {
        return {
            reasoning: { effort: thinkingWanted ? 'medium' : 'low' },
            removeTemperature: true,
        }
    }
    return { removeTemperature: false }
}

export function resolveOpenAICompatibleTranslationPolicy(
    provider: OpenAICompatibleProvider,
    model: string,
    thinkingWanted: boolean,
): OpenAITranslationPolicy {
    if (provider === 'openai') return resolveOpenAITranslationPolicy(model, thinkingWanted)
    if (provider === 'deepseek') return resolveDeepSeekTranslationPolicy(thinkingWanted)
    if (provider === 'zhipu') return resolveZhipuTranslationPolicy(model, thinkingWanted)
    if (provider === 'moonshot') return resolveMoonshotTranslationPolicy(model, thinkingWanted)
    if (provider === 'dashscope') return resolveDashScopeTranslationPolicy(model, thinkingWanted)
    if (provider === 'siliconflow') return resolveSiliconFlowTranslationPolicy(model, thinkingWanted)
    if (provider === 'xai') return resolveXAITranslationPolicy(model, thinkingWanted)
    if (provider === 'openrouter') return resolveOpenRouterTranslationPolicy(model, thinkingWanted)
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
    if (protocol === 'gemini') {
        return Boolean(resolveGeminiTranslationPolicy(model, false).thinkingConfig)
    }
    if (protocol === 'anthropic') {
        const policy = resolveAnthropicTranslationPolicy(model, true)
        return Boolean(policy.thinking || policy.outputConfig || policy.removeTemperature)
    }

    const policy = resolveOpenAICompatibleTranslationPolicy(protocol, model, false)
    return Boolean(
        policy.reasoningEffort
        || policy.reasoning
        || policy.thinking
        || policy.enableThinking !== undefined
        || policy.temperature !== undefined
        || policy.removeTemperature
    )
}
