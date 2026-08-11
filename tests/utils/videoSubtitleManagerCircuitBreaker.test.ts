import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SubtitleTranslationJob,
  SubtitleTranslationResult,
} from '@/entrypoints/video/types'
import type {
  SubtitleSchedulerTranslateOptions,
} from '@/entrypoints/video/scheduler'
import type {
  SubtitleQualityRequestResult,
} from '@/entrypoints/video/translator'

const mocks = vi.hoisted(() => ({
  overlaySetSegments: vi.fn(),
  translateSubtitleBatch: vi.fn(),
  createCacheSession: vi.fn(),
  cacheSessions: [] as Array<{
    hydrate: ReturnType<typeof vi.fn>
    commitMany: ReturnType<typeof vi.fn>
  }>,
  schedulerOptions: [] as Array<{
    sessionId: string
    translateBatch: (
      job: SubtitleTranslationJob,
      options: SubtitleSchedulerTranslateOptions,
    ) => Promise<SubtitleTranslationResult[]>
    onTranslationCommitted?: (results: SubtitleTranslationResult[]) => void
  }>,
  schedulers: [] as Array<{
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }>,
  config: {
    enableVideoSubtitle: true,
    videoSubtitleFastMode: false,
    to: 'zh-Hans',
    useCache: true,
    service: 'openai',
    model: { openai: 'gpt-5-mini' },
    customModel: {},
    proxy: { openai: 'https://gateway.example/v1/' },
    customProviders: [],
    system_role: { openai: 'default system' },
    user_role: { openai: 'default user' },
    thinking: { openai: true },
    bidirectionalTranslation: false,
    bidirectionalTarget: 'en',
  },
}))

vi.mock('@/entrypoints/video/parser', () => ({
  parseSubtitleData: vi.fn(() => ({
    cues: [
      { start: 0, end: 1, text: 'Done' },
      { start: 1, end: 2, text: 'Missing' },
    ],
    format: 'youtube-json3',
    sourceLanguage: 'en',
  })),
}))
vi.mock('@/entrypoints/video/segmenter', () => ({
  buildSubtitleSegments: vi.fn(() => [
    { id: 'done', start: 0, end: 1, sourceText: 'Done', status: 'pending' },
    { id: 'missing', start: 1, end: 2, sourceText: 'Missing', status: 'pending' },
  ]),
  segmenterVersion: 2,
}))
vi.mock('@/entrypoints/video/overlay', () => ({
  SubtitleOverlay: class {
    mount = vi.fn()
    setSegments = mocks.overlaySetSegments
    cleanup = vi.fn()
    show = vi.fn()
    hide = vi.fn()
  },
}))
vi.mock('@/entrypoints/video/scheduler', () => ({
  SubtitleTranslationScheduler: class {
    start = vi.fn()
    stop = vi.fn()

    constructor(options: (typeof mocks.schedulerOptions)[number]) {
      mocks.schedulerOptions.push(options)
      mocks.schedulers.push(this)
    }
  },
}))
vi.mock('@/entrypoints/video/platforms', () => ({
  getAllSubtitlePatterns: () => ['/api/timedtext'],
  detectPlatform: () => ({
    videoSelector: 'video',
    containerSelector: '.player',
    hideNativeSelector: '.native-caption',
  }),
}))
vi.mock('@/entrypoints/video/translator', () => ({
  translateSubtitleBatch: mocks.translateSubtitleBatch,
  canUseStructuredSubtitleTranslation: vi.fn(() => true),
  SUBTITLE_TRANSLATION_PROMPT_VERSION: 'subtitle-context-v1',
}))
vi.mock('@/entrypoints/video/cache', () => ({
  createVideoSubtitleCacheSession: mocks.createCacheSession,
  normalizeSubtitleCacheEndpoint: (endpoint: string) => endpoint.replace(/\/$/, ''),
  sha256SubtitleCacheValue: vi.fn(async () => 'prompt-sha256'),
}))
vi.mock('@/entrypoints/utils/config', () => ({ config: mocks.config }))
vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string, params: Record<string, string | number> = {}) => (
    params.seconds === undefined ? key : `${key}:${params.seconds}`
  ),
}))

const job: SubtitleTranslationJob = {
  trackKey: 'youtube|video|en|||',
  sessionId: '1',
  title: 'Video',
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
  promptVersion: 'subtitle-context-v1',
  entries: [{ id: 'missing', role: 'target', text: 'Missing' }],
}

function captureTrack(language = 'en') {
  const event = new MessageEvent('message', {
    data: {
      eventType: 'fr-subtitle-inject',
      type: 'subtitle-captured',
      url: `https://www.youtube.com/api/timedtext?v=video&lang=${language}&fmt=json3`,
      data: '{"events":[]}',
    },
  })
  Object.defineProperty(event, 'source', { value: window })
  window.dispatchEvent(event)
}

describe('video subtitle quality-mode circuit breaker', () => {
  beforeEach(() => {
    window.location.href = 'https://www.youtube.com/watch?v=video'
    history.replaceState({}, '', '/watch?v=video')
    document.body.innerHTML = `
      <div class="player">
        <video></video>
        <div class="native-caption"></div>
        <div class="ytp-right-controls"></div>
      </div>
    `
    mocks.config.videoSubtitleFastMode = false
    mocks.cacheSessions.length = 0
    mocks.schedulerOptions.length = 0
    mocks.schedulers.length = 0
    mocks.overlaySetSegments.mockReset()
    mocks.translateSubtitleBatch.mockReset()
    mocks.createCacheSession.mockReset().mockImplementation(async () => {
      const index = mocks.cacheSessions.length
      const session = {
        hydrate: vi.fn(async () => index === 0
          ? [{ id: 'done', translatedText: '质量译文' }]
          : [
              { id: 'done', translatedText: '不应覆盖质量译文' },
              { id: 'missing', translatedText: '速度缓存译文' },
            ]),
        commitMany: vi.fn(async () => undefined),
      }
      mocks.cacheSessions.push(session)
      return session
    })
  })

  it('shares timeout counts across lanes and restarts once with isolated FastMode cache state', async () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout')
    vi.resetModules()
    const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
    initVideoSubtitle()
    captureTrack()
    await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(1))

    const qualityScheduler = mocks.schedulerOptions[0]
    const observedModes: boolean[] = []
    const outcomes: SubtitleQualityRequestResult[] = [
      'timeout',
      'success',
      'timeout',
      'failure',
      'timeout',
      'timeout',
    ]
    mocks.translateSubtitleBatch.mockImplementation(async (
      _job: SubtitleTranslationJob,
      options: {
        effectiveFastMode?: boolean
        onQualityRequestResult?: (result: SubtitleQualityRequestResult) => void
      },
    ) => {
      observedModes.push(Boolean(options.effectiveFastMode))
      options.onQualityRequestResult?.(outcomes.shift()!)
      return []
    })

    await qualityScheduler.translateBatch(job, { lane: 'foreground' })
    await qualityScheduler.translateBatch(job, { lane: 'prefetch' })
    await qualityScheduler.translateBatch(job, { lane: 'foreground' })
    await qualityScheduler.translateBatch(job, { lane: 'prefetch' })
    expect(mocks.schedulers).toHaveLength(1)

    await Promise.all([
      qualityScheduler.translateBatch(job, { lane: 'foreground' }),
      qualityScheduler.translateBatch(job, { lane: 'prefetch' }),
    ])
    await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(2))

    expect(observedModes).toEqual([false, false, false, false, false, false])
    expect(mocks.schedulers[0].stop).toHaveBeenCalledTimes(1)
    expect(mocks.createCacheSession).toHaveBeenCalledTimes(2)
    expect(mocks.createCacheSession).toHaveBeenNthCalledWith(2, expect.objectContaining({
      identity: expect.objectContaining({
        fastMode: true,
        thinkingWanted: false,
      }),
    }))
    expect(mocks.schedulerOptions[1].sessionId).toBe('2')
    expect(mocks.overlaySetSegments).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'done',
        status: 'translated',
        translatedText: '质量译文',
      }),
      expect.objectContaining({
        id: 'missing',
        status: 'translated',
        translatedText: '速度缓存译文',
      }),
    ])

    qualityScheduler.onTranslationCommitted?.([
      { id: 'done', translatedText: '迟到质量译文', cacheable: true },
    ])
    expect(mocks.cacheSessions[0].commitMany).not.toHaveBeenCalled()

    mocks.schedulerOptions[1].onTranslationCommitted?.([
      { id: 'missing', translatedText: '新的速度译文', cacheable: true },
    ])
    expect(mocks.cacheSessions[1].commitMany).toHaveBeenCalledWith([
      { id: 'missing', translatedText: '新的速度译文', cacheable: true },
    ])

    let resumedMode: boolean | undefined
    mocks.translateSubtitleBatch.mockImplementationOnce(async (
      _job: SubtitleTranslationJob,
      options: { effectiveFastMode?: boolean },
    ) => {
      resumedMode = options.effectiveFastMode
      return []
    })
    await mocks.schedulerOptions[1].translateBatch(job, { lane: 'foreground' })
    expect(resumedMode).toBe(true)
    expect(mocks.config.videoSubtitleFastMode).toBe(false)

    const button = document.getElementById('fr-subtitle-quick-btn') as HTMLButtonElement
    const hint = document.getElementById('fr-subtitle-status-hint') as HTMLElement
    expect(button.title).toContain('video.subtitleFastModeActive')
    expect(button.title).toContain('video.subtitleForcedFastMode')
    expect(hint.textContent).toBe('video.subtitleForcedFastMode')
    expect(hint.hidden).toBe(false)
    expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true)

    button.click()
    button.click()
    expect(mocks.schedulers).toHaveLength(3)
    let reopenedMode: boolean | undefined
    mocks.translateSubtitleBatch.mockImplementationOnce(async (
      _job: SubtitleTranslationJob,
      options: { effectiveFastMode?: boolean },
    ) => {
      reopenedMode = options.effectiveFastMode
      return []
    })
    await mocks.schedulerOptions[2].translateBatch(job, { lane: 'foreground' })
    expect(reopenedMode).toBe(true)

    captureTrack('fr')
    await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(4))
    expect(mocks.createCacheSession).toHaveBeenLastCalledWith(expect.objectContaining({
      identity: expect.objectContaining({ fastMode: false }),
    }))
    timeoutSpy.mockRestore()
  })
})
