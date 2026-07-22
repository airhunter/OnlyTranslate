import { _service } from './_service'
import type { TranslationServiceFunction } from './types'
import { config } from '@/entrypoints/utils/config'
import { services, servicesType } from '@/entrypoints/utils/option'

export interface InputTranslationRequest {
  text: string
  targetLang: string
  context?: string
}

export interface InputTranslationDependencies {
  service: string
  sourceLang: string
  handlers: Record<string, TranslationServiceFunction>
}

function getDefaultDependencies(): InputTranslationDependencies {
  return {
    service: config.service,
    sourceLang: config.from,
    handlers: _service
  }
}

export async function translateInputWithCurrentService(
  request: InputTranslationRequest,
  dependencies: InputTranslationDependencies = getDefaultDependencies()
): Promise<string> {
  const handlerKey = servicesType.isCustom(dependencies.service)
    ? services.openai
    : dependencies.service
  const handler = dependencies.handlers[handlerKey]
  if (!handler) throw new Error(`Unsupported translation service: ${dependencies.service}`)

  const result = await handler({
    origin: request.text,
    context: request.context ?? '',
    sourceLang: dependencies.sourceLang,
    targetLang: request.targetLang
  })
  if (typeof result !== 'string') {
    throw new Error('Input translation service returned a non-text response')
  }
  return result
}
