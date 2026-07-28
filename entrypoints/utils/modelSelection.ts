import type { CustomProvider } from './model'
import { customModelString } from './option'

interface TranslationModelConfiguration {
    model?: Record<string, string>
    customModel?: Record<string, string>
    customProviders?: Array<Pick<CustomProvider, 'id' | 'model' | 'customModel'>>
}

export function resolveConfiguredTranslationModel(
    service: string,
    configuration: TranslationModelConfiguration,
): string {
    if (service.startsWith('custom_')) {
        const provider = configuration.customProviders?.find(item => item.id === service)
        const model = provider?.model === customModelString
            ? provider.customModel
            : provider?.model
        return String(model || '').replace(/（.*）/g, '').trim()
    }

    const selectedModel = configuration.model?.[service]
    const model = selectedModel === customModelString
        ? configuration.customModel?.[service]
        : selectedModel
    return String(model || '').replace(/（.*）/g, '').trim()
}
