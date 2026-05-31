import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'deepl',
  token: {
    deepl: 'deepl-token'
  } as Record<string, string>,
  proxy: {} as Record<string, string>,
  to: 'zh-Hans'
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  },
  urls: {
    deepl: 'https://api.deepl.com/v2/translate'
  }
}))

vi.mock('@/entrypoints/utils/option', () => ({
  services: {
    deepL: 'deepl'
  }
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import deepl from '@/entrypoints/service/deepl'

describe('DeepL service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        translations: [
          {
            text: '你好'
          }
        ]
      })
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps zh-Hans to DeepL zh and parses translation responses', async () => {
    await expect(deepl({
      origin: '<p>Hello</p>',
      context: 'Example page',
      targetLang: 'zh-Hans'
    })).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)

    expect(url).toBe('https://api.deepl.com/v2/translate')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('DeepL-Auth-Key deepl-token')
    expect(body).toMatchObject({
      text: ['<p>Hello</p>'],
      target_lang: 'zh',
      tag_handling: 'html',
      context: 'Example page',
      preserve_formatting: true
    })
  })
})
