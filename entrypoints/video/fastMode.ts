import type { CustomProvider } from '@/entrypoints/utils/model'
import {
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
])

function resolveFastModeProtocol(
    service: string,
    configuration: VideoFastModeConfiguration,
): TranslationFastModeProtocol | null {
    if (service === services.deepseek) return 'deepseek'
    if (service === services.gemini) return 'gemini'
    if (service === services.claude) return 'anthropic'
    if (service.startsWith('custom_')) {
        const provider = configuration.customProviders?.find(item => item.id === service)
        return getCustomProviderProtocol(provider)
    }
    if (OPENAI_COMPATIBLE_FAST_MODE_SERVICES.has(service)) return 'openai'
    return null
}

export function isVideoFastModeEffective(
    service: string,
    configuration: VideoFastModeConfiguration,
): boolean {
    const protocol = resolveFastModeProtocol(service, configuration)
    if (!protocol) return false
    return supportsTranslationFastMode(
        protocol,
        resolveConfiguredTranslationModel(service, configuration),
    )
}
