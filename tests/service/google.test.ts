import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  from: 'auto',
  to: 'zh-Hans',
}))

vi.mock('@/entrypoints/utils/config', () => ({ config: mockConfig }))
vi.mock('@/entrypoints/utils/i18n', () => ({ t: (key: string) => key }))

import google from '@/entrypoints/service/google'

describe('Google service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockConfig.to = 'zh-Hans'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [[['你好']]],
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the Google language code for Traditional Chinese', async () => {
    await expect(google({ origin: 'Hello', targetLang: 'zh-Hant' })).resolves.toBe('你好')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(new URL(url).searchParams.get('tl')).toBe('zh-TW')
  })
})
