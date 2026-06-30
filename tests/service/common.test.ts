import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCommonMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[]}'))
const mockCommonBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"batch"}]}'))
const mockContentPostHandler = vi.hoisted(() => vi.fn((content: string) => `clean:${content}`))
const mockConfig = vi.hoisted(() => ({
  service: 'openai',
  token: {
    openai: 'test-token'
  } as Record<string, string>,
  proxy: {
    openai: 'https://api.example.com/v1/chat/completions'
  } as Record<string, string>,
  customProviders: [] as Array<{ id: string; token?: string; url: string }>
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  },
  urls: {
    openai: 'https://api.openai.com/v1'
  }
}))

vi.mock('@/entrypoints/utils/template', () => ({
  commonMsgTemplate: mockCommonMsgTemplate,
  commonBatchMsgTemplate: mockCommonBatchMsgTemplate
}))

vi.mock('@/entrypoints/utils/check', () => ({
  contentPostHandler: mockContentPostHandler
}))

vi.mock('@/entrypoints/utils/option', () => ({
  services: {
    openai: 'openai',
    openrouter: 'openrouter'
  }
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import common from '@/entrypoints/service/common'

describe('common OpenAI-compatible service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'translated content'
            }
          }
        ]
      })
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes OpenAI-compatible URLs and parses chat completion responses', async () => {
    await expect(common({
      origin: 'Hello world',
      targetLang: 'zh-Hans'
    })).resolves.toBe('clean:translated content')

    expect(mockCommonMsgTemplate).toHaveBeenCalledWith('Hello world', 'zh-Hans')
    expect(mockContentPostHandler).toHaveBeenCalledWith('translated content')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers

    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(init.body).toBe('{"messages":[]}')
  })

  it('uses the batch template and parses JSON array chat completion responses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n["你好","世界"]\n```'
            }
          }
        ]
      })
    })

    await expect(common({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).resolves.toEqual(['你好', '世界'])

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans')
    expect(mockCommonMsgTemplate).not.toHaveBeenCalled()
  })

  it('logs batch request stats in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '["你好","世界"]'
            }
          }
        ]
      })
    })

    try {
      await expect(common({
        type: 'BATCH_TRANSLATION',
        origins: ['Hello', 'World!'],
        targetLang: 'zh-Hans'
      })).resolves.toEqual(['你好', '世界'])

      expect(consoleInfo).toHaveBeenCalledWith('[OnlyTranslate][batch-translation]', 'request', {
        service: 'openai',
        items: 2,
        characters: 11
      })
    } finally {
      consoleInfo.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  it('parses batch arrays from responses with surrounding prose', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Here is the JSON array:\n["你好","世界"]'
            }
          }
        ]
      })
    })

    await expect(common({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).resolves.toEqual(['你好', '世界'])
  })

  it('parses batch arrays wrapped in a translations object', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"translations":["你好","世界"]}'
            }
          }
        ]
      })
    })

    await expect(common({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).resolves.toEqual(['你好', '世界'])
  })

  it('rejects malformed batch responses so callers can fall back to single translation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '["only one"]'
            }
          }
        ]
      })
    })

    try {
      await expect(common({
        type: 'BATCH_TRANSLATION',
        origins: ['Hello', 'World'],
        targetLang: 'zh-Hans'
      })).rejects.toThrow('Batch translation result count mismatch')
    } finally {
      consoleError.mockRestore()
    }
  })
})
