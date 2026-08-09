import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'microsoft',
  from: 'auto',
  to: 'zh-Hans',
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig,
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key,
}))

import microsoft, { MicrosoftEndpointUnavailableError } from '@/entrypoints/service/microsoft'

describe('Microsoft service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockConfig.from = 'auto'
    mockConfig.to = 'zh-Hans'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ translations: [{ text: '你好 &amp; 再见' }] }],
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the unauthenticated Edge plain-text endpoint', async () => {
    await expect(microsoft({
      origin: 'Hello & goodbye',
      targetLang: 'zh-Hans',
    })).resolves.toBe('你好 & 再见')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe(
      'https://edge.microsoft.com/translate/translatetext?from=&to=zh-Hans&isEnterpriseClient=false',
    )
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(init.body as string)).toEqual(['Hello &amp; goodbye'])
  })

  it('ignores unreliable per-message source detection in automatic mode', async () => {
    await microsoft({
      origin: '<p>Hello</p>',
      sourceLang: 'mad',
      targetLang: 'ja',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('from=&')
    expect(url).toContain('to=ja')
    expect(url).not.toContain('textType=html')
    expect(JSON.parse(init.body as string)).toEqual(['&lt;p&gt;Hello&lt;/p&gt;'])
  })

  it('uses an explicitly configured source language', async () => {
    mockConfig.from = 'en'

    await microsoft({
      origin: 'Hello',
      sourceLang: 'mad',
      targetLang: 'zh-Hans',
    })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('from=en')
  })

  it('reports endpoint HTTP failures with status and response details', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'endpoint removed',
    })

    const promise = microsoft({ origin: 'Hello', targetLang: 'zh-Hans' })
    await expect(promise).rejects.toBeInstanceOf(MicrosoftEndpointUnavailableError)
    await expect(promise).rejects.toThrow(
      'runtime.microsoftEndpointUnavailable: HTTP 404 Not Found body: endpoint removed',
    )
  })

  it('rejects malformed translation responses explicitly', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ translations: [] }],
    })

    await expect(microsoft({ origin: 'Hello', targetLang: 'zh-Hans' }))
      .rejects.toThrow('runtime.microsoftInvalidResponse: missing translated text')
  })
})
