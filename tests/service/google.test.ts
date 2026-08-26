import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  from: 'auto',
  to: 'zh-Hans',
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig,
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key,
}))

import google from '@/entrypoints/service/google'

describe('Google service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockConfig.from = 'auto'
    mockConfig.to = 'zh-Hans'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [['你好 &amp; 再见']],
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the markup-preserving translateHtml endpoint and decodes plain text once', async () => {
    await expect(google({
      origin: 'Hello & goodbye',
      targetLang: 'zh-Hans',
    })).resolves.toBe('你好 & 再见')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://translate-pa.googleapis.com/v1/translateHtml')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'X-Goog-API-Key': expect.any(String),
      },
    })
    expect(JSON.parse(init.body as string)).toEqual([
      [['Hello &amp; goodbye'], 'auto', 'zh-Hans'],
      'wt_lib',
    ])
  })

  it('sends HTML unchanged and preserves the encoded HTML response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [['<span data-slot="0">你好 &amp; 再见</span>']],
    })

    const origin = '<span data-slot="0">Hello &amp; goodbye</span>'
    await expect(google({
      origin,
      textFormat: 'html',
      targetLang: 'zh-Hans',
    })).resolves.toBe('<span data-slot="0">你好 &amp; 再见</span>')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual([[[origin], 'auto', 'zh-Hans'], 'wt_lib'])
  })

  it('rejects malformed responses', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    await expect(google({ origin: 'Hello' })).rejects.toThrow('runtime.googleInvalidResponse')
  })
})
