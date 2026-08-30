import { describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/service/_service', () => ({ _service: {} }))
vi.mock('@/entrypoints/utils/config', () => ({
  config: { service: 'microsoft', from: 'auto' }
}))

import {
  translateInputWithCurrentService,
  type InputTranslationDependencies
} from '@/entrypoints/service/inputTranslation'
import type {
  TranslationServiceFunction,
  TranslationServiceMessage
} from '@/entrypoints/service/types'
import { services } from '@/entrypoints/utils/option'

function createDependencies(
  service: string,
  handlers: Record<string, TranslationServiceFunction>,
  customProviders?: InputTranslationDependencies['customProviders'],
): InputTranslationDependencies {
  return {
    service,
    sourceLang: 'auto',
    handlers,
    customProviders,
  }
}

describe('input translation service routing', () => {
  it('uses the currently selected Google service and preserves the target override', async () => {
    const google = vi.fn(async (_message: TranslationServiceMessage) => 'Hello')
    const microsoft = vi.fn(async (_message: TranslationServiceMessage) => 'Wrong service')

    const result = await translateInputWithCurrentService(
      { text: '你好', targetLang: 'en', context: 'Test page' },
      createDependencies(services.google, {
        [services.google]: google,
        [services.microsoft]: microsoft
      })
    )

    expect(result).toBe('Hello')
    expect(google).toHaveBeenCalledWith({
      origin: '你好',
      context: '',
      promptContext: { scene: 'input' },
      sourceLang: 'auto',
      targetLang: 'en'
    })
    expect(microsoft).not.toHaveBeenCalled()
  })

  it('uses the currently selected large-model service', async () => {
    const deepseek = vi.fn(async (_message: TranslationServiceMessage) => 'Hello from DeepSeek')

    const result = await translateInputWithCurrentService(
      { text: '你好', targetLang: 'en' },
      createDependencies(services.deepseek, {
        [services.deepseek]: deepseek
      })
    )

    expect(result).toBe('Hello from DeepSeek')
    expect(deepseek).toHaveBeenCalledOnce()
  })

  it('returns the provider text directly without exposing input-page context', async () => {
    const deepseek = vi.fn(async (_message: TranslationServiceMessage) => 'Hello')

    await expect(translateInputWithCurrentService(
      { text: '你好', targetLang: 'en', context: 'Private page' },
      createDependencies(services.deepseek, {
        [services.deepseek]: deepseek,
      }),
    )).resolves.toBe('Hello')
    expect(deepseek).toHaveBeenCalledWith(expect.objectContaining({
      context: '',
      promptContext: { scene: 'input' },
    }))
  })

  it('routes custom OpenAI-compatible services through the common handler', async () => {
    const common = vi.fn(async (_message: TranslationServiceMessage) => 'Custom result')

    const result = await translateInputWithCurrentService(
      { text: '你好', targetLang: 'en' },
      createDependencies('custom_example', {
        [services.openai]: common
      })
    )

    expect(result).toBe('Custom result')
    expect(common).toHaveBeenCalledOnce()
  })

  it('routes custom Anthropic-compatible services through the Claude handler', async () => {
    const claude = vi.fn(async (_message: TranslationServiceMessage) => 'Anthropic result')

    const result = await translateInputWithCurrentService(
      { text: '你好', targetLang: 'en' },
      createDependencies('custom_anthropic', {
        [services.claude]: claude,
      }, [{
        id: 'custom_anthropic',
        name: 'Anthropic gateway',
        protocol: 'anthropic',
        url: 'https://gateway.example',
        token: '',
        model: '自定义模型',
        customModel: 'claude-test',
      }])
    )

    expect(result).toBe('Anthropic result')
    expect(claude).toHaveBeenCalledOnce()
  })

  it('rejects non-text responses from a single input translation request', async () => {
    const google = vi.fn(async (_message: TranslationServiceMessage) => ['unexpected'])

    await expect(translateInputWithCurrentService(
      { text: '你好', targetLang: 'en' },
      createDependencies(services.google, {
        [services.google]: google
      })
    )).rejects.toThrow('non-text response')
  })
})
