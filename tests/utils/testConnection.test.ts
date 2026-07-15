import { afterEach, describe, expect, it, vi } from 'vitest'
import { testConnection } from '@/entrypoints/utils/testConnection'

const baseConfig = () => ({
  token: {} as Record<string, string>,
  proxy: {} as Record<string, string>,
  model: { deepseek: 'deepseek-chat' },
  customModel: {} as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    name: string
    url: string
    token: string
    model: string
    customModel: string
  }>,
})

describe('testConnection result codes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns stable localizable codes for validation failures', async () => {
    await expect(testConnection('unknown-service', baseConfig())).resolves.toMatchObject({
      success: false,
      code: 'unsupported',
    })
    await expect(testConnection('deepseek', baseConfig())).resolves.toMatchObject({
      success: false,
      code: 'missing-token',
    })

    const config = baseConfig()
    config.customProviders.push({
      id: 'custom_test',
      name: 'Test',
      url: '',
      token: '',
      model: 'custom-model',
      customModel: '',
    })
    await expect(testConnection('custom_test', config)).resolves.toMatchObject({
      success: false,
      code: 'missing-url',
    })
  })

  it.each([
    [401, 'auth-failed'],
    [404, 'not-found'],
    [500, 'request-failed'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: 'Test error',
      text: vi.fn().mockResolvedValue('provider detail'),
    }))
    const config = baseConfig()
    config.token.deepseek = 'configured-token'

    await expect(testConnection('deepseek', config)).resolves.toMatchObject({ success: false, code })
  })

  it('distinguishes timeouts, network errors, and successful translations', async () => {
    const config = baseConfig()
    config.token.deepseek = 'configured-token'

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')))
    await expect(testConnection('deepseek', config)).resolves.toMatchObject({ success: false, code: 'timeout' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(testConnection('deepseek', config)).resolves.toMatchObject({
      success: false,
      code: 'network-error',
      detail: 'offline',
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [{ message: { content: '你好' } }] }),
    }))
    await expect(testConnection('deepseek', config)).resolves.toEqual({
      success: true,
      code: 'success',
      translatedText: '你好',
    })
  })
})
