import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const mocks = vi.hoisted(() => ({
  createTab: vi.fn(),
  openOptionsPage: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      create: mocks.createTab,
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
      openOptionsPage: mocks.openOptionsPage,
    },
  },
}))

import {
  buildFeedbackIssueUrl,
  helpTopics,
  openOptionsPanel,
  resolveOptionsRoute,
} from '@/entrypoints/utils/help'

describe('help utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createTab.mockResolvedValue(undefined)
    mocks.openOptionsPage.mockResolvedValue(undefined)
  })

  it('opens a specific options panel and falls back to the default options page', async () => {
    await openOptionsPanel('help')
    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test/options.html?panel=help',
    })

    mocks.createTab.mockRejectedValueOnce(new Error('tabs unavailable'))
    await openOptionsPanel('service')
    expect(mocks.openOptionsPage).toHaveBeenCalledTimes(1)
  })

  it('resolves only whitelisted options routes', () => {
    expect(resolveOptionsRoute('?panel=help')).toEqual({ panel: 'help' })
    expect(resolveOptionsRoute('?panel=service')).toEqual({ panel: 'service' })
    expect(resolveOptionsRoute('?panel=unknown')).toEqual({ panel: 'service' })
  })

  it('builds a prefilled feedback issue without user configuration', () => {
    const url = buildFeedbackIssueUrl({
      version: '1.2.3',
      locale: 'en-US',
      userAgent: 'TestBrowser/10',
    })
    const parsed = new URL(url)
    const body = parsed.searchParams.get('body') ?? ''

    expect(parsed.origin + parsed.pathname).toBe('https://github.com/airhunter/OnlyTranslate/issues/new')
    expect(body).toContain('OnlyTranslate: v1.2.3')
    expect(body).toContain('UI locale: en-US')
    expect(body).toContain('Browser: TestBrowser/10')
    expect(body).not.toMatch(/api key|token|proxy|customProviders/i)
  })

  it('provides every structured help entry in all supported locales', () => {
    const keys = helpTopics.flatMap(topic => [
      topic.titleKey,
      topic.summaryKey,
      topic.keywordsKey,
      ...topic.sections.flatMap(section => [
        section.titleKey,
        section.bodyKey,
        ...(section.imageAltKey ? [section.imageAltKey] : []),
        ...(section.stepKeys ?? []),
      ]),
    ])

    for (const locale of ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const) {
      const i18n = createAppI18n(locale)
      for (const key of keys) {
        expect(i18n.global.t(key), `${locale}:${key}`).not.toBe(key)
      }
    }
  })

  it('keeps the beta ebook guide concise and available in every locale', () => {
    const ebookTopic = helpTopics.find(topic => topic.id === 'ebooks')
    expect(ebookTopic?.sections).toHaveLength(2)

    for (const locale of ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const) {
      const i18n = createAppI18n(locale)
      expect(i18n.global.t('help.topics.ebooks.title')).toContain('Beta')
      expect(i18n.global.t('help.topics.ebooks.betaBody')).toContain('EPUB')
    }
  })

  it('documents cache clearing and protected local data in every locale', () => {
    const settingsTopic = helpTopics.find(topic => topic.id === 'settings')
    expect(settingsTopic?.sections.some(section => section.id === 'translation-cache')).toBe(true)

    for (const locale of ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const) {
      const i18n = createAppI18n(locale)
      expect(i18n.global.t('help.topics.settings.cacheTitle')).not.toBe('help.topics.settings.cacheTitle')
      expect(i18n.global.t('help.topics.settings.cacheStep4')).toContain('API')
    }
  })

  it('references screenshots bundled with the extension', () => {
    const images = helpTopics.flatMap(topic => topic.sections.flatMap(section => section.image ? [section.image] : []))

    expect(images).toHaveLength(2)
    for (const image of images) {
      expect(existsSync(resolve(process.cwd(), 'public', image.replace(/^\//, ''))), image).toBe(true)
    }
  })
})
