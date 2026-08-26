import { describe, expect, it } from 'vitest'
import { Config } from '@/entrypoints/utils/model'
import {
  defaultOption,
  isServiceConfigured,
  options,
  services,
  supportsTranslationOnlyMode,
} from '@/entrypoints/utils/option'

describe('service options', () => {
  it('uses Google as the default service for new configurations', () => {
    expect(defaultOption.service).toBe(services.google)
    expect(new Config().service).toBe(services.google)
  })

  it('allows Google HTML translation while keeping Microsoft out of translation-only mode', () => {
    expect(supportsTranslationOnlyMode(services.google)).toBe(true)
    expect(supportsTranslationOnlyMode(services.microsoft)).toBe(false)
    expect(supportsTranslationOnlyMode(services.openai)).toBe(true)
  })

  it('offers manual, repeated-character, and automatic input preview triggers', () => {
    expect(options.inputBoxTranslationTrigger.map(item => item.value)).toEqual([
      'disabled',
      'ctrl_enter',
      'triple_space',
      'triple_equal',
      'triple_dash',
      'auto_pause',
    ])
  })

  it('does not expose the retired fixed custom service in the popup list', () => {
    expect(options.services.some(item => item.value === services.custom)).toBe(false)
  })

  it('does not treat the retired custom URL fallback as a configured service', () => {
    const config = new Config()
    config.custom = 'http://localhost:11434/v1/chat/completions'
    config.customProviders = []

    expect(isServiceConfigured(services.custom, config)).toBe(false)
  })

  it('keeps dynamic custom providers configurable', () => {
    const config = new Config()
    config.customProviders = [{
      id: 'custom_123',
      name: 'Local gateway',
      url: 'http://localhost:11434/v1/chat/completions',
      token: '',
      model: 'gpt-4o-mini',
      customModel: ''
    }]

    expect(isServiceConfigured('custom_123', config)).toBe(true)
  })
})
