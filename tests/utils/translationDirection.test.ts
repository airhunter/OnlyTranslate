import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  to: 'zh-Hans',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en'
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/common', () => ({
  detectlang: vi.fn()
}))

import { detectlang } from '@/entrypoints/utils/common'
import { resolveTranslationDirection } from '../../entrypoints/utils/translationDirection'

describe('resolveTranslationDirection', () => {
  beforeEach(() => {
    mockConfig.to = 'zh-Hans'
    mockConfig.bidirectionalTranslation = false
    mockConfig.bidirectionalTarget = 'en'
    vi.clearAllMocks()
  })

  it('uses the default target when bidirectional translation is disabled', () => {
    vi.mocked(detectlang).mockReturnValue('en')

    expect(resolveTranslationDirection('hello')).toEqual({
      sourceLang: 'en',
      targetLang: 'zh-Hans',
      shouldTranslate: true
    })
  })

  it('skips translation when source matches default target in fixed target mode', () => {
    vi.mocked(detectlang).mockReturnValue('zh-Hans')

    expect(resolveTranslationDirection('你好')).toEqual({
      sourceLang: 'zh-Hans',
      targetLang: 'zh-Hans',
      shouldTranslate: false
    })
  })

  it('translates default target language to bidirectional target when enabled', () => {
    mockConfig.bidirectionalTranslation = true
    vi.mocked(detectlang).mockReturnValue('zh-Hans')

    expect(resolveTranslationDirection('你好')).toEqual({
      sourceLang: 'zh-Hans',
      targetLang: 'en',
      shouldTranslate: true
    })
  })

  it('falls back to default target for languages outside the bidirectional pair', () => {
    mockConfig.bidirectionalTranslation = true
    vi.mocked(detectlang).mockReturnValue('fr')

    expect(resolveTranslationDirection('bonjour')).toEqual({
      sourceLang: 'fr',
      targetLang: 'zh-Hans',
      shouldTranslate: true
    })
  })

  it('treats matching default and bidirectional targets like fixed target mode', () => {
    mockConfig.bidirectionalTranslation = true
    mockConfig.bidirectionalTarget = 'zh-Hans'
    vi.mocked(detectlang).mockReturnValue('zh-Hans')

    expect(resolveTranslationDirection('你好')).toEqual({
      sourceLang: 'zh-Hans',
      targetLang: 'zh-Hans',
      shouldTranslate: false
    })
  })
})
