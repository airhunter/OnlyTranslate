import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SubtitleTranslationJob,
  SubtitleTranslationLane,
  SubtitleTranslationResult,
} from '@/entrypoints/video/types'

const mockSendMessage = vi.hoisted(() => vi.fn())
const mockDetectlang = vi.hoisted(() => vi.fn(() => 'en'))
const mockEnqueueTranslation = vi.hoisted(() => vi.fn((
  task: () => Promise<unknown>,
  _options?: { priority?: string },
) => task()))
const mockConfig = vi.hoisted(() => ({
  to: 'zh-Hans',
  service: 'openai',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en',
  videoSubtitleFastMode: true,
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

function runtimeTargetResults(job: SubtitleTranslationJob) {
  return job.entries
    .filter(entry => entry.role === 'target')
    .map(entry => ({ id: entry.id, translatedText: `translated:${entry.text}` }))
}

function translatedResults(job: SubtitleTranslationJob, cacheable = true): SubtitleTranslationResult[] {
  return runtimeTargetResults(job).map(result => ({ ...result, cacheable }))
}

function translationOptions(
  lane: SubtitleTranslationLane = 'foreground',
  overrides: Partial<Parameters<typeof translateSubtitleBatch>[1]> = {},
): NonNullable<Parameters<typeof translateSubtitleBatch>[1]> {
  return { lane, ...overrides }
}

async function flushMicrotasks() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve()
  }
}

describe('video subtitle translator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockConfig.to = 'zh-Hans'
    mockConfig.service = 'openai'
    mockConfig.bidirectionalTranslation = false
    mockConfig.bidirectionalTarget = 'en'
    mockConfig.videoSubtitleFastMode = true
    mockConfig.user_role = {}
    mockConfig.system_role = {}
    mockDetectlang.mockReturnValue('en')
    mockEnqueueTranslation.mockImplementation((task: () => Promise<unknown>) => task())
    mockSendMessage.mockImplementation(async (message: Record<string, unknown>) => {
      if (message.type === 'SUBTITLE_BATCH_TRANSLATION') {
        return runtimeTargetResults(message.job as SubtitleTranslationJob)
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

      await expect(translateSubtitleBatch(job)).resolves.toEqual(translatedResults(job))

      expect(canUseStructuredSubtitleTranslation()).toBe(true)
      expect(mockEnqueueTranslation).toHaveBeenCalledTimes(1)
      expect(mockEnqueueTranslation).toHaveBeenCalledWith(expect.any(Function), { priority: 'high' })
      expect(mockSendMessage).toHaveBeenCalledTimes(1)
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
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
      }))
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

  it('uses a restricted FastMode fallback after a non-timeout quality failure', async () => {
    mockConfig.videoSubtitleFastMode = false
    const onQualityRequestResult = vi.fn()
    mockSendMessage.mockImplementation(async (message: Record<string, unknown>) => {
      if (message.type === 'SUBTITLE_BATCH_TRANSLATION') {
        return [{ id: 'wrong-id', translatedText: 'invalid' }]
      }
      return `translated:${message.origin}`
    })

    await expect(translateSubtitleBatch(createJob(), translationOptions('foreground', {
      onQualityRequestResult,
    }))).resolves.toEqual(
      translatedResults(createJob(), false),
    )

    expect(mockSendMessage).toHaveBeenCalledTimes(3)
    expect(mockSendMessage.mock.calls[0][0]).toEqual(expect.objectContaining({
      type: 'SUBTITLE_BATCH_TRANSLATION',
      fastMode: false,
    }))
    expect(mockSendMessage.mock.calls.slice(1)
      .every(([message]) => message.fastMode === true)).toBe(true)
    expect(onQualityRequestResult).toHaveBeenCalledWith('failure')
  })

  it('uses the explicit effective mode and reports a successful quality request', async () => {
    const onQualityRequestResult = vi.fn()

    await expect(translateSubtitleBatch(createJob(), translationOptions('foreground', {
      effectiveFastMode: false,
      onQualityRequestResult,
    }))).resolves.toEqual(translatedResults(createJob()))

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SUBTITLE_BATCH_TRANSLATION',
      fastMode: false,
    }))
    expect(onQualityRequestResult).toHaveBeenCalledOnce()
    expect(onQualityRequestResult).toHaveBeenCalledWith('success')
  })

  it('applies the degraded retry and batch deadline to non-timeout structured fallbacks', async () => {
    const onQualityRequestResult = vi.fn()
    mockSendMessage.mockImplementation((message: Record<string, unknown>) => {
      if (message.type === 'SUBTITLE_BATCH_TRANSLATION') {
        return Promise.resolve([{ id: 'wrong-id', translatedText: 'invalid' }])
      }
      return new Promise(() => {})
    })

    const translation = translateSubtitleBatch(createJob(), translationOptions('foreground', {
      effectiveFastMode: false,
      onQualityRequestResult,
    }))
    await flushMicrotasks()

    expect(onQualityRequestResult).toHaveBeenCalledWith('failure')
    expect(mockSendMessage).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(20_000)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(mockSendMessage).toHaveBeenCalledTimes(5)
    expect(mockSendMessage.mock.calls.slice(1)
      .every(([message]) => message.fastMode === true)).toBe(true)

    await vi.advanceTimersByTimeAsync(9_000)
    await expect(translation).resolves.toEqual([])
  })

  it('limits a quality-timeout fallback to FastMode singles and a 30-second batch deadline', async () => {
    const job = createJob()
    const onPartialResult = vi.fn()
    const onQualityRequestResult = vi.fn()
    mockSendMessage.mockImplementation((message: Record<string, unknown>) => {
      if (message.type === 'SUBTITLE_BATCH_TRANSLATION') return new Promise(() => {})
      if (message.origin === 'She said it worked.') return Promise.resolve('她说这成功了。')
      return new Promise(() => {})
    })

    const translation = translateSubtitleBatch(job, translationOptions('foreground', {
      effectiveFastMode: false,
      onPartialResult,
      onQualityRequestResult,
    }))
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(45_000)
    await flushMicrotasks()

    expect(onQualityRequestResult).toHaveBeenCalledWith('timeout')
    const fallbackMessages = mockSendMessage.mock.calls
      .map(([message]) => message as Record<string, unknown>)
      .filter(message => message.type !== 'SUBTITLE_BATCH_TRANSLATION')
    expect(fallbackMessages).toHaveLength(2)
    expect(fallbackMessages.every(message => message.fastMode === true)).toBe(true)
    expect(onPartialResult).toHaveBeenCalledWith({
      id: 'target-1',
      translatedText: '她说这成功了。',
      cacheable: false,
    })

    await vi.advanceTimersByTimeAsync(30_000)
    await expect(translation).resolves.toEqual([
      { id: 'target-1', translatedText: '她说这成功了。', cacheable: false },
    ])
    expect(mockSendMessage.mock.calls
      .map(([message]) => message as Record<string, unknown>)
      .filter(message => message.origin === 'Not right away.')).toHaveLength(2)
  })

  it('does not start timeout fallback singles when the quality observer aborts the run', async () => {
    const controller = new AbortController()
    const onQualityRequestResult = vi.fn(() => controller.abort())
    mockSendMessage.mockImplementation(() => new Promise(() => {}))

    const translation = translateSubtitleBatch(createJob(), translationOptions('foreground', {
      signal: controller.signal,
      effectiveFastMode: false,
      onQualityRequestResult,
    }))
    await vi.advanceTimersByTimeAsync(45_000)

    await expect(translation).resolves.toEqual([])
    expect(onQualityRequestResult).toHaveBeenCalledWith('timeout')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('queues a structured prefetch request with background priority', async () => {
    const job = createJob()

    await expect(translateSubtitleBatch(job, translationOptions('prefetch')))
      .resolves.toEqual(translatedResults(job))

    expect(mockEnqueueTranslation).toHaveBeenCalledTimes(1)
    expect(mockEnqueueTranslation).toHaveBeenCalledWith(expect.any(Function), {
      priority: 'background',
    })
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

    await expect(translateSubtitleBatch(job)).resolves.toEqual(translatedResults(job))

    expect(canUseStructuredSubtitleTranslation()).toBe(false)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage.mock.calls.some(([message]) => message.type === 'SUBTITLE_BATCH_TRANSLATION')).toBe(false)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      context: job.title,
      origin: 'She said it worked.',
      sourceLang: 'en',
      targetLang: 'zh-Hans',
      fastMode: true,
    }))
    expect(mockSendMessage.mock.calls[0][0]).not.toHaveProperty('useCache')
  })

  it('reports each direct quality attempt without shortening its 45-second request budget', async () => {
    mockConfig.user_role = { openai: 'My custom subtitle instructions' }
    const job = createJob({
      entries: [{ id: 'target-1', role: 'target', text: 'Slow sentence.' }],
    })
    const onQualityRequestResult = vi.fn()
    mockSendMessage
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce('慢句。')

    const translation = translateSubtitleBatch(job, translationOptions('foreground', {
      effectiveFastMode: false,
      onQualityRequestResult,
    }))
    await flushMicrotasks()

    await vi.advanceTimersByTimeAsync(44_999)
    expect(onQualityRequestResult).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onQualityRequestResult).toHaveBeenCalledWith('timeout')

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(translation).resolves.toEqual([
      { id: 'target-1', translatedText: '慢句。', cacheable: true },
    ])
    expect(onQualityRequestResult.mock.calls).toEqual([
      ['timeout'],
      ['success'],
    ])
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage.mock.calls.every(([message]) => message.fastMode === false)).toBe(true)
  })

  it('reports direct non-timeout failures and stops retries when its observer aborts', async () => {
    mockConfig.user_role = { openai: 'My custom subtitle instructions' }
    const controller = new AbortController()
    const onQualityRequestResult = vi.fn(() => controller.abort())
    mockSendMessage.mockRejectedValueOnce(new Error('provider rejected request'))

    await expect(translateSubtitleBatch(createJob({
      entries: [{ id: 'target-1', role: 'target', text: 'Rejected.' }],
    }), translationOptions('foreground', {
      signal: controller.signal,
      effectiveFastMode: false,
      onQualityRequestResult,
    }))).resolves.toEqual([])

    expect(onQualityRequestResult).toHaveBeenCalledOnce()
    expect(onQualityRequestResult).toHaveBeenCalledWith('failure')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it.each(['zhipu', 'minimax', 'google', 'microsoft', 'chromeTranslator', 'deepL'])(
    'falls back to direct single runtime requests for unsupported %s',
    async (service) => {
      mockConfig.service = service
      const job = createJob()

      await expect(translateSubtitleBatch(job)).resolves.toEqual(translatedResults(job))

      expect(canUseStructuredSubtitleTranslation()).toBe(false)
      expect(mockSendMessage).toHaveBeenCalledTimes(2)
      expect(mockSendMessage.mock.calls.every(([message]) => !message.type)).toBe(true)
    },
  )

  it('does not report machine-translation singles as quality-mode requests', async () => {
    mockConfig.service = 'google'
    const onQualityRequestResult = vi.fn()

    await expect(translateSubtitleBatch(createJob(), translationOptions('foreground', {
      effectiveFastMode: false,
      onQualityRequestResult,
    }))).resolves.toEqual(translatedResults(createJob()))

    expect(onQualityRequestResult).not.toHaveBeenCalled()
  })

  it('reports cacheable direct results as soon as each target finishes', async () => {
    mockConfig.service = 'google'
    const job = createJob()
    const onPartialResult = vi.fn()

    await expect(translateSubtitleBatch(job, translationOptions('foreground', {
      onPartialResult,
    }))).resolves.toEqual(translatedResults(job))

    expect(onPartialResult).toHaveBeenCalledTimes(2)
    expect(onPartialResult).toHaveBeenNthCalledWith(1, translatedResults(job)[0])
    expect(onPartialResult).toHaveBeenNthCalledWith(2, translatedResults(job)[1])
  })

  it('queues direct prefetch translations with background priority', async () => {
    mockConfig.service = 'google'
    const job = createJob()

    await expect(translateSubtitleBatch(job, translationOptions('prefetch')))
      .resolves.toEqual(translatedResults(job))

    expect(mockEnqueueTranslation).toHaveBeenCalledTimes(2)
    expect(mockEnqueueTranslation.mock.calls.every(([, options]) => (
      options?.priority === 'background'
    ))).toBe(true)
  })

  it.each([
    ['foreground', 2, 'high'],
    ['prefetch', 1, 'background'],
  ] as const)(
    'limits structured fallback workers for the %s lane and emits partial results',
    async (lane, workerCount, priority) => {
      const job = createJob({
        entries: Array.from({ length: 4 }, (_, index) => ({
          id: `target-${index + 1}`,
          role: 'target' as const,
          text: `Sentence ${index + 1}.`,
        })),
      })
      const pendingSingles: Array<{
        origin: string
        resolve: (value: string) => void
      }> = []
      const onPartialResult = vi.fn()
      mockSendMessage.mockImplementation((message: Record<string, unknown>) => {
        if (message.type === 'SUBTITLE_BATCH_TRANSLATION') {
          return Promise.resolve([{ id: 'wrong-id', translatedText: 'invalid' }])
        }
        return new Promise<string>((resolve) => {
          pendingSingles.push({ origin: String(message.origin), resolve })
        })
      })

      const translation = translateSubtitleBatch(job, translationOptions(lane, {
        onPartialResult,
      }))
      await flushMicrotasks()

      expect(pendingSingles).toHaveLength(workerCount)
      expect(onPartialResult).not.toHaveBeenCalled()

      let resolvedCount = 0
      while (resolvedCount < job.entries.length) {
        const pending = pendingSingles[resolvedCount]
        expect(pending).toBeDefined()
        pending.resolve(`translated:${pending.origin}`)
        resolvedCount += 1
        await flushMicrotasks()

        if (resolvedCount === 1) {
          expect(onPartialResult).toHaveBeenCalledTimes(1)
          expect(pendingSingles.length).toBe(Math.min(job.entries.length, workerCount + 1))
        }
      }

      await expect(translation).resolves.toEqual(translatedResults(job, false))
      expect(onPartialResult).toHaveBeenCalledTimes(job.entries.length)
      expect(mockEnqueueTranslation).toHaveBeenCalledTimes(job.entries.length + 1)
      for (const [, options] of mockEnqueueTranslation.mock.calls) {
        expect(options).toEqual({ priority })
      }
    },
  )

  it('keeps successful single fallbacks when a structured response is invalid', async () => {
    const job = createJob()
    const onPartialResult = vi.fn()
    let enqueueCall = 0
    mockEnqueueTranslation.mockImplementation((task: () => Promise<unknown>) => {
      enqueueCall += 1
      if (enqueueCall === 3) return Promise.reject(new Error('target-2 failed'))
      return task()
    })
    mockSendMessage
      .mockResolvedValueOnce([{ id: 'wrong-id', translatedText: 'invalid' }])
      .mockResolvedValueOnce('她说这成功了。')

    await expect(translateSubtitleBatch(job, translationOptions('foreground', {
      onPartialResult,
    }))).resolves.toEqual([
      { id: 'target-1', translatedText: '她说这成功了。', cacheable: false },
    ])

    expect(mockEnqueueTranslation).toHaveBeenCalledTimes(3)
    expect(mockEnqueueTranslation).toHaveBeenNthCalledWith(2, expect.any(Function), { priority: 'high' })
    expect(mockEnqueueTranslation).toHaveBeenNthCalledWith(3, expect.any(Function), { priority: 'high' })
    expect(onPartialResult).toHaveBeenCalledTimes(1)
    expect(onPartialResult).toHaveBeenCalledWith({
      id: 'target-1',
      translatedText: '她说这成功了。',
      cacheable: false,
    })
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
    const onQualityRequestResult = vi.fn()
    mockSendMessage.mockImplementationOnce(() => new Promise(() => {}))

    const translation = translateSubtitleBatch(createJob(), translationOptions('foreground', {
      signal: controller.signal,
      effectiveFastMode: false,
      onQualityRequestResult,
    }))
    await Promise.resolve()
    controller.abort()

    await expect(translation).resolves.toEqual([])
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SUBTITLE_BATCH_TRANSLATION',
    }))
    expect(onQualityRequestResult).not.toHaveBeenCalled()
  })

  it('does not send a structured request when its epoch is already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(translateSubtitleBatch(createJob(), translationOptions('foreground', {
      signal: controller.signal,
    }))).resolves.toEqual([])
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('stops a direct prefetch worker without starting later targets after cancellation', async () => {
    mockConfig.service = 'google'
    const controller = new AbortController()
    const onPartialResult = vi.fn()
    const job = createJob({
      entries: [
        { id: 'target-1', role: 'target', text: 'First.' },
        { id: 'target-2', role: 'target', text: 'Second.' },
        { id: 'target-3', role: 'target', text: 'Third.' },
      ],
    })
    mockSendMessage.mockImplementation(() => new Promise(() => {}))

    const translation = translateSubtitleBatch(job, translationOptions('prefetch', {
      signal: controller.signal,
      onPartialResult,
    }))
    await flushMicrotasks()
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    controller.abort()

    await expect(translation).resolves.toEqual([])
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(onPartialResult).not.toHaveBeenCalled()
  })

  it('continues a single worker after an empty target exhausts its retries', async () => {
    mockConfig.service = 'google'
    const job = createJob({
      entries: [
        { id: 'target-1', role: 'target', text: 'Empty.' },
        { id: 'target-2', role: 'target', text: 'Continue.' },
      ],
    })
    mockSendMessage.mockImplementation(async (message: Record<string, unknown>) => (
      message.origin === 'Empty.' ? '' : '继续。'
    ))

    const translation = translateSubtitleBatch(job, translationOptions('prefetch'))
    await vi.runAllTimersAsync()

    await expect(translation).resolves.toEqual([
      { id: 'target-2', translatedText: '继续。', cacheable: true },
    ])
    expect(mockSendMessage.mock.calls
      .map(([message]) => message as Record<string, unknown>)
      .filter(message => message.origin === 'Empty.')).toHaveLength(4)
    expect(mockSendMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      origin: 'Continue.',
    }))
  })
})
