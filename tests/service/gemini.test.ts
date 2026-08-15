import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const mockGeminiMsgTemplate = vi.hoisted(() => vi.fn(() => '{"contents":[{"parts":[{"text":"single"}]}]}'))
const mockGeminiSubtitleBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"contents":[{"parts":[{"text":"subtitle-batch"}]}]}'))
const mockConfig = vi.hoisted(() => ({
  service: 'gemini',
  model: {
    gemini: 'gemini-2.5-flash'
  } as Record<string, string>,
  customModel: {} as Record<string, string>,
  proxy: {} as Record<string, string>,
  token: {
    gemini: 'gemini-token'
  } as Record<string, string>
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  }
}))

vi.mock('@/entrypoints/utils/template', () => ({
  geminiMsgTemplate: mockGeminiMsgTemplate,
  geminiSubtitleBatchMsgTemplate: mockGeminiSubtitleBatchMsgTemplate
}))

vi.mock('@/entrypoints/utils/option', () => ({
  customModelString: 'custom'
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import gemini from '@/entrypoints/service/gemini'

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

describe('Gemini service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'plain translation' }]
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

  it('uses the subtitle template, forwards fast mode, and parses native candidate content', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ thought: true, text: 'internal reasoning' }, {
                text: '[{"id":"segment-1","translation":"\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002"},{"id":"segment-2","translation":"\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002"}]'
              }]
            }
          }
        ]
      })
    })

    await expect(gemini({
      type: 'SUBTITLE_BATCH_TRANSLATION',
      job: subtitleJob,
      fastMode: true
    })).resolves.toEqual([
      { id: 'segment-1', translatedText: '\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002' },
      { id: 'segment-2', translatedText: '\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002' }
    ])

    expect(mockGeminiSubtitleBatchMsgTemplate).toHaveBeenCalledWith(subtitleJob, true)
    expect(mockGeminiMsgTemplate).not.toHaveBeenCalled()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe('{"contents":[{"parts":[{"text":"subtitle-batch"}]}]}')
  })

  it('keeps ordinary single translation on the original Gemini path', async () => {
    await expect(gemini({
      origin: 'Hello',
      targetLang: 'zh-Hans'
    })).resolves.toBe('plain translation')

    expect(mockGeminiMsgTemplate).toHaveBeenCalledWith('Hello', 'zh-Hans', undefined)
    expect(mockGeminiSubtitleBatchMsgTemplate).not.toHaveBeenCalled()
  })

  it('forwards an isolated prompt for selection analysis', async () => {
    const prompt = {
      system: 'Analyze language safely.',
      user: 'Selected text: "ephemeral"',
      responseFormat: 'json' as const,
    }

    await gemini({
      type: 'SELECTION_ANALYSIS',
      origin: 'ephemeral',
      targetLang: 'zh-Hans',
      prompt,
    })

    expect(mockGeminiMsgTemplate).toHaveBeenCalledWith('ephemeral', 'zh-Hans', undefined, prompt)
  })

  it('continues to reject ordinary batch translation messages', async () => {
    await expect(gemini({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).rejects.toThrow('Batch translation is not supported by this service')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockGeminiSubtitleBatchMsgTemplate).not.toHaveBeenCalled()
  })
})
