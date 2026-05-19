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
})
