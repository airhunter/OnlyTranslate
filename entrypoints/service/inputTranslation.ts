import { _service } from './_service'
import type { TranslationServiceFunction } from './types'
import { config } from '@/entrypoints/utils/config'
import { services, servicesType } from '@/entrypoints/utils/option'
import type { CustomProvider } from '@/entrypoints/utils/model'
import { getCustomProviderProtocol } from '@/entrypoints/utils/providerEndpoint'
import type { TranslationDiagnosticMetadata } from '@/entrypoints/utils/translationDiagnostics'

export interface InputTranslationRequest {
  text: string
  targetLang: string
  context?: string
  diagnostics?: TranslationDiagnosticMetadata
}

export interface InputTranslationDependencies {
  service: string
  sourceLang: string
  handlers: Record<string, TranslationServiceFunction>
  customProviders?: CustomProvider[]
}

function getDefaultDependencies(): InputTranslationDependencies {
  return {
    service: config.service,
    sourceLang: config.from,
    handlers: _service,
    customProviders: config.customProviders,
  }
}

export async function translateInputWithCurrentService(
  request: InputTranslationRequest,
  dependencies: InputTranslationDependencies = getDefaultDependencies()
): Promise<string> {
  const customProvider = servicesType.isCustom(dependencies.service)
    ? dependencies.customProviders?.find(provider => provider.id === dependencies.service)
    : undefined
  const handlerKey = customProvider && getCustomProviderProtocol(customProvider) === 'anthropic'
    ? services.claude
    : servicesType.isCustom(dependencies.service)
      ? services.openai
      : dependencies.service
  const handler = dependencies.handlers[handlerKey]
  if (!handler) throw new Error(`Unsupported translation service: ${dependencies.service}`)

  const result = await handler({
    origin: request.text,
    context: request.context ?? '',
    sourceLang: dependencies.sourceLang,
    targetLang: request.targetLang,
    diagnostics: request.diagnostics,
  })
  if (typeof result !== 'string') {
    throw new Error('Input translation service returned a non-text response')
  }
  return result
}
