import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const mockSendMessage = vi.hoisted(() => vi.fn())
const mockDetectlang = vi.hoisted(() => vi.fn(() => 'en'))
const mockEnqueueTranslation = vi.hoisted(() => vi.fn((task: () => Promise<unknown>) => task()))
const mockConfig = vi.hoisted(() => ({
  to: 'zh-Hans',
  service: 'openai',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en',
  user_role: {} as Record<string, string>,
  system_role: {} as Record<string, string>,
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: mockSendMessage,
    },
  },
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig,
}))

vi.mock('@/entrypoints/utils/common', () => ({
  detectlang: mockDetectlang,
}))

vi.mock('@/entrypoints/utils/translateQueue', () => ({
  enqueueTranslation: mockEnqueueTranslation,
}))

import {
  SUBTITLE_TRANSLATION_PROMPT_VERSION,
  canUseStructuredSubtitleTranslation,
  translateSubtitleBatch,
} from '@/entrypoints/video/translator'

function createJob(overrides: Partial<SubtitleTranslationJob> = {}): SubtitleTranslationJob {
  return {
    trackKey: 'youtube:video-1:en',
    sessionId: 'session-1',
    title: 'Example video',
    sourceLanguage: 'en-US',
    targetLanguage: 'zh-Hans',
    promptVersion: '',
    entries: [
      { id: 'context-before', role: 'context', text: 'Sarah tested the release.' },
      { id: 'target-1', role: 'target', text: 'She said it worked.' },
      { id: 'target-2', role: 'target', text: 'Not right away.' },
      { id: 'context-after', role: 'context', text: 'We shipped it on Friday.' },
    ],
    ...overrides,
  }
}

function targetResults(job: SubtitleTranslationJob) {
  return job.entries
    .filter(entry => entry.role === 'target')
    .map(entry => ({ id: entry.id, translatedText: `translated:${entry.text}` }))
}

describe('video subtitle translator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockConfig.to = 'zh-Hans'
    mockConfig.service = 'openai'
    mockConfig.bidirectionalTranslation = false
    mockConfig.bidirectionalTarget = 'en'
    mockConfig.user_role = {}
    mockConfig.system_role = {}
    mockDetectlang.mockReturnValue('en')
    mockEnqueueTranslation.mockImplementation((task: () => Promise<unknown>) => task())
    mockSendMessage.mockImplementation(async (message: Record<string, unknown>) => {
      if (message.type === 'SUBTITLE_BATCH_TRANSLATION') {
        return targetResults(message.job as SubtitleTranslationJob)
      }
      return `translated:${message.origin}`
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it.each([
    'openai',
    'moonshot',
    'jieyue',
    'siliconCloud',
    'openrouter',
    'grok',
    'custom_test-provider',
    'deepseek',
    'newapi',
    'gemini',
    'claude',
  ])(
    'routes %s through one structured high-priority runtime request',
    async (service) => {
      mockConfig.service = service
      const job = createJob()

      await expect(translateSubtitleBatch(job)).resolves.toEqual(targetResults(job))

      expect(canUseStructuredSubtitleTranslation()).toBe(true)
      expect(mockEnqueueTranslation).toHaveBeenCalledTimes(1)
      expect(mockEnqueueTranslation).toHaveBeenCalledWith(expect.any(Function), { priority: 'high' })
      expect(mockSendMessage).toHaveBeenCalledTimes(1)
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SUBTITLE_BATCH_TRANSLATION',
        job: expect.objectContaining({
          trackKey: job.trackKey,
          sessionId: job.sessionId,
          sourceLanguage: 'en',
          targetLanguage: 'zh-Hans',
          promptVersion: SUBTITLE_TRANSLATION_PROMPT_VERSION,
          entries: job.entries,
        }),
        sourceLang: 'en',
        targetLang: 'zh-Hans',
        fastMode: true,
      })
      expect(mockSendMessage.mock.calls[0][0]).not.toHaveProperty('useCache')
    },
  )

  it('uses the normalized track language without detecting each short subtitle', async () => {
    const job = createJob({
      sourceLanguage: 'EN_gb',
      entries: [
        { id: 'target-1', role: 'target', text: 'OK' },
        { id: 'target-2', role: 'target', text: 'No' },
      ],
    })

    await translateSubtitleBatch(job)

    expect(mockDetectlang).not.toHaveBeenCalled()
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ sourceLanguage: 'en' }),
      sourceLang: 'en',
    }))
  })

  it('detects a missing source language once from the whole ordered batch', async () => {
    const job = createJob({ sourceLanguage: undefined })

    await translateSubtitleBatch(job)

    expect(mockDetectlang).toHaveBeenCalledTimes(1)
    expect(mockDetectlang).toHaveBeenCalledWith(job.entries.map(entry => entry.text).join(' '))
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ sourceLanguage: 'en' }),
      sourceLang: 'en',
    }))
  })

  it.each([
    ['user prompt', 'user_role'],
    ['system prompt', 'system_role'],
  ] as const)('falls back to direct single runtime requests for a custom %s', async (_, field) => {
    mockConfig[field] = { openai: 'My custom subtitle instructions' }
    const job = createJob()

    await expect(translateSubtitleBatch(job)).resolves.toEqual(targetResults(job))

    expect(canUseStructuredSubtitleTranslation()).toBe(false)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage.mock.calls.some(([message]) => message.type === 'SUBTITLE_BATCH_TRANSLATION')).toBe(false)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
      context: job.title,
      origin: 'She said it worked.',
      sourceLang: 'en',
      targetLang: 'zh-Hans',
      fastMode: true,
    })
    expect(mockSendMessage.mock.calls[0][0]).not.toHaveProperty('useCache')
  })

  it.each(['zhipu', 'minimax', 'google', 'microsoft', 'chromeTranslator', 'deepL'])(
    'falls back to direct single runtime requests for unsupported %s',
    async (service) => {
      mockConfig.service = service
      const job = createJob()

      await expect(translateSubtitleBatch(job)).resolves.toEqual(targetResults(job))

      expect(canUseStructuredSubtitleTranslation()).toBe(false)
      expect(mockSendMessage).toHaveBeenCalledTimes(2)
      expect(mockSendMessage.mock.calls.every(([message]) => !message.type)).toBe(true)
    },
  )

  it('keeps successful single fallbacks when a structured response is invalid', async () => {
    const job = createJob()
    let enqueueCall = 0
    mockEnqueueTranslation.mockImplementation((task: () => Promise<unknown>) => {
      enqueueCall += 1
      if (enqueueCall === 3) return Promise.reject(new Error('target-2 failed'))
      return task()
    })
    mockSendMessage
      .mockResolvedValueOnce([{ id: 'wrong-id', translatedText: 'invalid' }])
      .mockResolvedValueOnce('她说这成功了。')

    await expect(translateSubtitleBatch(job)).resolves.toEqual([
      { id: 'target-1', translatedText: '她说这成功了。' },
    ])

    expect(mockEnqueueTranslation).toHaveBeenCalledTimes(3)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'SUBTITLE_BATCH_TRANSLATION',
    }))
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      origin: 'She said it worked.',
      fastMode: true,
    }))
  })

  it('does not start single fallbacks after a seek cancels a structured job', async () => {
    const controller = new AbortController()
    mockSendMessage.mockImplementationOnce(() => new Promise(() => {}))

    const translation = translateSubtitleBatch(createJob(), controller.signal)
    await Promise.resolve()
    controller.abort()

    await expect(translation).resolves.toEqual([])
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SUBTITLE_BATCH_TRANSLATION',
    }))
  })

  it('does not send a structured request when its epoch is already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(translateSubtitleBatch(createJob(), controller.signal)).resolves.toEqual([])
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
