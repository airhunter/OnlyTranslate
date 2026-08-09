import type { CustomProvider } from '@/entrypoints/utils/model'
import {
    inferOpenAICompatibleProvider,
    supportsTranslationFastMode,
    type TranslationFastModeProtocol,
} from '@/entrypoints/utils/modelCapabilities'
import { resolveConfiguredTranslationModel } from '@/entrypoints/utils/modelSelection'
import { services } from '@/entrypoints/utils/option'
import { getCustomProviderProtocol } from '@/entrypoints/utils/providerEndpoint'

interface VideoFastModeConfiguration {
    model?: Record<string, string>
    customModel?: Record<string, string>
    customProviders?: CustomProvider[]
}

const OPENAI_COMPATIBLE_FAST_MODE_SERVICES = new Set<string>([
    services.openai,
    services.moonshot,
    services.jieyue,
    services.siliconCloud,
    services.openrouter,
    services.grok,
    services.newapi,
    services.zhipu,
])

function resolveFastModeProtocol(
    service: string,
    model: string,
    configuration: VideoFastModeConfiguration,
): TranslationFastModeProtocol | null {
    if (service === services.gemini) return 'gemini'
    if (service === services.claude) return 'anthropic'
    if (service.startsWith('custom_')) {
        const provider = configuration.customProviders?.find(item => item.id === service)
        if (getCustomProviderProtocol(provider) === 'anthropic') return 'anthropic'
        return inferOpenAICompatibleProvider(service, model, provider?.url)
    }
    if (service === services.deepseek || OPENAI_COMPATIBLE_FAST_MODE_SERVICES.has(service)) {
        return inferOpenAICompatibleProvider(service, model)
    }
    return null
}

export function isVideoFastModeEffective(
    service: string,
    configuration: VideoFastModeConfiguration,
): boolean {
    const model = resolveConfiguredTranslationModel(service, configuration)
    const protocol = resolveFastModeProtocol(service, model, configuration)
    if (!protocol) return false
    return supportsTranslationFastMode(protocol, model)
}
