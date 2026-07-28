import { afterEach, describe, expect, it, vi } from 'vitest'
import { testConnection } from '@/entrypoints/utils/testConnection'

const baseConfig = () => ({
  token: {} as Record<string, string>,
  proxy: {} as Record<string, string>,
  model: { deepseek: 'deepseek-v4-flash' },
  customModel: {} as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    name: string
    protocol?: 'openai' | 'anthropic'
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

  it('completes custom OpenAI URLs before testing the connection', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [{ message: { content: '你好' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const config = baseConfig()
    config.customProviders.push({
      id: 'custom_openai',
      name: 'OpenAI gateway',
      protocol: 'openai',
      url: 'https://gateway.example/v1',
      token: 'openai-token',
      model: 'gpt-test',
      customModel: '',
    })

    await expect(testConnection('custom_openai', config)).resolves.toMatchObject({
      success: true,
      translatedText: '你好',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gateway.example/v1/chat/completions')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer openai-token',
    })
  })

  it('uses native Anthropic headers, payload, response parsing, and URL completion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '你好' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const config = baseConfig()
    config.customProviders.push({
      id: 'custom_anthropic',
      name: 'Anthropic gateway',
      protocol: 'anthropic',
      url: 'https://gateway.example',
      token: 'anthropic-token',
      model: 'claude-test',
      customModel: '',
    })

    await expect(testConnection('custom_anthropic', config)).resolves.toEqual({
      success: true,
      code: 'success',
      translatedText: '你好',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gateway.example/v1/messages')
    expect(init.headers).toMatchObject({
      'x-api-key': 'anthropic-token',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'claude-test',
      system: expect.any(String),
      messages: [{ role: 'user', content: 'hello' }],
    })
  })
})
