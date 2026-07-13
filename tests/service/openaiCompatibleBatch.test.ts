import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const mockCommonBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"batch"}]}'))
const mockCommonSubtitleBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"subtitle-batch"}]}'))
const mockCommonMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"single"}]}'))
const mockDeepseekMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"deepseek-single"}]}'))
const mockContentPostHandler = vi.hoisted(() => vi.fn((content: string) => `clean:${content}`))
const mockConfig = vi.hoisted(() => ({
  service: 'deepseek',
  token: {
    deepseek: 'deepseek-token',
    newapi: 'newapi-token'
  } as Record<string, string>,
  proxy: {} as Record<string, string>,
  newApiUrl: 'https://newapi.example.com'
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  },
  urls: {
    deepseek: 'https://api.deepseek.com/chat/completions'
  }
}))

vi.mock('@/entrypoints/utils/template', () => ({
  commonBatchMsgTemplate: mockCommonBatchMsgTemplate,
  commonSubtitleBatchMsgTemplate: mockCommonSubtitleBatchMsgTemplate,
  commonMsgTemplate: mockCommonMsgTemplate,
  deepseekMsgTemplate: mockDeepseekMsgTemplate
}))

vi.mock('@/entrypoints/utils/check', () => ({
  contentPostHandler: mockContentPostHandler
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import deepseek from '@/entrypoints/service/deepseek'
import newapi from '@/entrypoints/service/newapi'

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

describe('OpenAI-compatible batch service adapters', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    mockConfig.service = 'deepseek'
    fetchMock.mockResolvedValue({
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
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the common batch template for DeepSeek batch messages', async () => {
    await expect(deepseek({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).resolves.toEqual(['你好', '世界'])

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans', undefined)
    expect(mockDeepseekMsgTemplate).not.toHaveBeenCalled()
  })

  it('uses the common batch template for NewAPI batch messages', async () => {
    mockConfig.service = 'newapi'

    await expect(newapi({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).resolves.toEqual(['你好', '世界'])

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans', undefined)
    expect(mockCommonMsgTemplate).not.toHaveBeenCalled()
  })

  it.each([
    ['DeepSeek', deepseek, 'deepseek'],
    ['NewAPI', newapi, 'newapi']
  ] as const)('uses the subtitle template and native response parser for %s', async (_name, service, serviceName) => {
    mockConfig.service = serviceName
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

    await expect(service({
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
    expect(mockDeepseekMsgTemplate).not.toHaveBeenCalled()
    expect(mockContentPostHandler).not.toHaveBeenCalled()
  })

  it('keeps ordinary DeepSeek and NewAPI single translation routes unchanged', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'plain translation'
            }
          }
        ]
      })
    })

    await expect(deepseek({
      origin: 'Hello',
      targetLang: 'zh-Hans'
    })).resolves.toBe('clean:plain translation')
    expect(mockDeepseekMsgTemplate).toHaveBeenCalledWith('Hello', 'zh-Hans', undefined)
    expect(mockCommonSubtitleBatchMsgTemplate).not.toHaveBeenCalled()

    mockConfig.service = 'newapi'
    await expect(newapi({
      origin: 'World',
      targetLang: 'zh-Hans'
    })).resolves.toBe('clean:plain translation')
    expect(mockCommonMsgTemplate).toHaveBeenCalledWith('World', 'zh-Hans', undefined)
    expect(mockCommonSubtitleBatchMsgTemplate).not.toHaveBeenCalled()
  })
})
