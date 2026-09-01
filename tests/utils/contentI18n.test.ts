import { describe, expect, it } from 'vitest'
import { contentMessages } from '@/entrypoints/utils/i18n/contentMessages'
import { pageMessages } from '@/entrypoints/utils/i18n/pageMessages'
import { messages } from '@/entrypoints/utils/i18n/messages'
import { setLocale } from '@/entrypoints/utils/i18n/locale'
import { t } from '@/entrypoints/utils/i18n/content'

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'string' ? [[path, child]] : flatten(child, path)
  })
}

describe('content i18n', () => {
  it('stays identical to the canonical application messages', () => {
    for (const lightweightMessages of [contentMessages, pageMessages]) {
      for (const [locale, localeMessages] of Object.entries(lightweightMessages)) {
        for (const [key, value] of flatten(localeMessages)) {
          const canonical = key.split('.').reduce<unknown>((current, part) => {
            return current && typeof current === 'object'
              ? (current as Record<string, unknown>)[part]
              : undefined
          }, messages[locale as keyof typeof messages])
          expect(canonical, `${locale}:${key}`).toBe(value)
        }
      }
    }
  })

  it('uses the shared active locale without loading settings or help text', () => {
    setLocale('ja-JP')
    expect(t('runtime.retry')).toBe('再試行')
    expect(t('runtime.rateLimited', { service: 'API' })).toContain('API')
  })
})
