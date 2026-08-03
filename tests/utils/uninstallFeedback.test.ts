import { describe, expect, it } from 'vitest'
import {
  buildUninstallFeedbackUrl,
  resolveUninstallFeedbackOrigin,
  resolveUninstallFeedbackLocale,
} from '@/entrypoints/utils/uninstallFeedback'

describe('uninstall feedback utilities', () => {
  it.each([
    ['zh-CN', 'zh-CN'],
    ['zh_Hans_CN', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh_Hant_HK', 'zh-TW'],
    ['ja-JP', 'ja-JP'],
    ['en-GB', 'en-US'],
    ['fr-FR', 'en-US'],
  ] as const)('maps %s to the supported website locale %s', (input, expected) => {
    expect(resolveUninstallFeedbackLocale(input)).toBe(expected)
  })

  it('builds a localized uninstall survey URL with the extension version only', () => {
    expect(buildUninstallFeedbackUrl('1.5.0', 'zh-TW'))
      .toBe('https://onlytranslate.top/zh-tw/uninstall?version=1.5.0')
    expect(buildUninstallFeedbackUrl('1.5.0', 'de-DE'))
      .toBe('https://onlytranslate.top/en/uninstall?version=1.5.0')
  })

  it('drops malformed version values instead of forwarding arbitrary text', () => {
    expect(buildUninstallFeedbackUrl('1.5.0&user=unexpected', 'zh-CN'))
      .toBe('https://onlytranslate.top/uninstall')
  })

  it('uses the configured uninstall origin only in development mode', () => {
    const developmentOrigin = resolveUninstallFeedbackOrigin(
      'development',
      'http://localhost:5173',
    )

    expect(developmentOrigin).toBe('http://localhost:5173')
    expect(buildUninstallFeedbackUrl('1.5.0', 'zh-CN', developmentOrigin))
      .toBe('http://localhost:5173/uninstall?version=1.5.0')
    expect(resolveUninstallFeedbackOrigin('production', 'http://localhost:5173'))
      .toBe('https://onlytranslate.top')
  })

  it.each([
    'not a url',
    'file:///tmp/uninstall',
    'https://user:password@example.com',
  ])('ignores an invalid development origin: %s', (configuredOrigin) => {
    expect(resolveUninstallFeedbackOrigin('development', configuredOrigin))
      .toBe('https://onlytranslate.top')
  })
})
