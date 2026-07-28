import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const mockCommonMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[]}'))
const mockCommonBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"batch"}]}'))
const mockCommonSubtitleBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"subtitle-batch"}]}'))
const mockContentPostHandler = vi.hoisted(() => vi.fn((content: string) => `clean:${content}`))
const mockConfig = vi.hoisted(() => ({
  service: 'openai',
  token: {
    openai: 'test-token'
  } as Record<string, string>,
  proxy: {
    openai: 'https://api.example.com/v1/chat/completions'
  } as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    protocol?: 'openai' | 'anthropic'
    token?: string
    url: string
  }>
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
  commonBatchMsgTemplate: mockCommonBatchMsgTemplate,
  commonSubtitleBatchMsgTemplate: mockCommonSubtitleBatchMsgTemplate
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

const subtitleJob: SubtitleTranslationJob = {
  trackKey: 'youtube:video-1:en',
  sessionId: 'session-1',
  title: 'Test video',
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
  promptVersion: 'subtitle-context-v1',
  entries: [
    { id: 'segment-0', role: 'context', text: 'Sarah called yesterday.' },
    { id: 'segment-1', role: 'target', text: 'She said it was ready.' },
    { id: 'segment-2', role: 'target', text: 'So I picked it up.' }
  ]
}

describe('common OpenAI-compatible service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockConfig.service = 'openai'
    mockConfig.token = { openai: 'test-token' }
    mockConfig.proxy = { openai: 'https://api.example.com/v1/chat/completions' }
    mockConfig.customProviders = []
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

    expect(mockCommonMsgTemplate).toHaveBeenCalledWith('Hello world', 'zh-Hans', undefined)
    expect(mockContentPostHandler).toHaveBeenCalledWith('translated content')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers

    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(init.body).toBe('{"messages":[]}')
  })

  it('completes a custom OpenAI-compatible base URL', async () => {
    mockConfig.service = 'custom_gateway'
    mockConfig.customProviders = [{
      id: 'custom_gateway',
      protocol: 'openai',
      token: 'custom-token',
      url: 'https://gateway.example/v1',
    }]

    await common({ origin: 'Hello', targetLang: 'zh-Hans' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gateway.example/v1/chat/completions')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer custom-token')
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

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans', undefined)
    expect(mockCommonMsgTemplate).not.toHaveBeenCalled()
  })

  it('uses the subtitle batch template, forwards fast mode, and parses native chat content', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '[{"id":"segment-1","translation":"\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002"},{"id":"segment-2","translation":"\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002"}]'
            }
          }
        ]
      })
    })

    await expect(common({
      type: 'SUBTITLE_BATCH_TRANSLATION',
      job: subtitleJob,
      fastMode: true
    })).resolves.toEqual([
      { id: 'segment-1', translatedText: '\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002' },
      { id: 'segment-2', translatedText: '\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002' }
    ])

    expect(mockCommonSubtitleBatchMsgTemplate).toHaveBeenCalledWith(subtitleJob, true)
    expect(mockCommonBatchMsgTemplate).not.toHaveBeenCalled()
    expect(mockCommonMsgTemplate).not.toHaveBeenCalled()
    expect(mockContentPostHandler).not.toHaveBeenCalled()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe('{"messages":[{"role":"user","content":"subtitle-batch"}]}')
  })

  it('forwards subtitle fast mode to the request template', async () => {
    await common({
      origin: 'Fast subtitle',
      targetLang: 'zh-Hans',
      fastMode: true
    })

    expect(mockCommonMsgTemplate).toHaveBeenCalledWith('Fast subtitle', 'zh-Hans', true)
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
