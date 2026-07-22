import { describe, expect, it } from 'vitest'

import { resolveLocale, setLocale, t } from '@/entrypoints/utils/i18n'

describe('i18n', () => {
  it('resolves supported and browser-like locale codes', () => {
    expect(resolveLocale('en-US')).toBe('en-US')
    expect(resolveLocale('zh_TW')).toBe('zh-TW')
    expect(resolveLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(resolveLocale('ja')).toBe('ja-JP')
    expect(resolveLocale('fr-FR')).toBe('zh-CN')
  })

  it('returns translated messages and falls back to key names', () => {
    setLocale('zh-CN')
    expect(t('common.appName')).toBe('只译')
    expect(t('missing.key')).toBe('missing.key')
  })

  it('labels the page translation shortcut separately from translation scope', () => {
    setLocale('zh-CN')
    expect(t('options.interaction.scopeToggle')).toBe('页面翻译快捷键')
    expect(t('options.interaction.scopeToggleTip')).toContain('当前翻译范围')
    expect(t('popup.fullPageShortcut')).toBe('页面翻译')
  })

  it('provides subtitle runway status messages in every supported locale', () => {
    for (const locale of ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const) {
      setLocale(locale)
      for (const key of [
        'video.subtitleTranslationStarting',
        'video.subtitleTranslationBuffered',
        'video.subtitleTranslationFailed',
      ]) {
        expect(t(key), `${locale}:${key}`).not.toBe(key)
      }
      expect(t('video.subtitleTranslationCatchingUp', { seconds: 12 })).toContain('12')
    }
  })

  it('provides input translation candidate messages in every supported locale', () => {
    for (const locale of ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const) {
      setLocale(locale)
      for (const key of [
        'runtime.inputTranslationTranslating',
        'runtime.inputTranslationCandidate',
        'runtime.inputTranslationAccept',
        'runtime.inputTranslationCancel',
        'runtime.inputTranslationUnsupportedEditor',
        'options.interaction.inputCandidateHint',
        'option.inputTrigger.autoPause',
      ]) {
        expect(t(key), `${locale}:${key}`).not.toBe(key)
      }
    }
  })
})
