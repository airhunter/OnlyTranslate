import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'microsoft',
  from: 'auto',
  to: 'zh-Hans',
  token: {
    microsoft: 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature'
  } as Record<string, string>
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/option', () => ({
  services: {
    microsoft: 'microsoft'
  }
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import microsoft from '@/entrypoints/service/microsoft'

describe('Microsoft service adapter', () => {
  const fetchMock = vi.fn()
  const validJwt = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature'

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          translations: [
            {
              text: '你好'
            }
          ]
        }
      ]
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds html translation requests and parses Microsoft responses', async () => {
    await expect(microsoft({
      origin: '<p>Hello</p>',
      targetLang: 'zh-Hans'
    })).resolves.toBe('你好')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toContain('to=zh-Hans')
    expect(url).toContain('textType=html')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${validJwt}`)
    expect(JSON.parse(init.body as string)).toEqual([{ Text: '<p>Hello</p>' }])
  })
})
