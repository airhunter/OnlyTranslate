import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  parseSubtitleData: vi.fn(),
  buildSubtitleSegments: vi.fn(),
  overlayMount: vi.fn(),
  overlaySetSegments: vi.fn(),
  overlayCleanup: vi.fn(),
  overlayShow: vi.fn(),
  overlayHide: vi.fn(),
  translateSubtitleBatch: vi.fn(),
  canUseStructuredSubtitleTranslation: vi.fn(() => true),
  createCacheSession: vi.fn(),
  cacheHydrate: vi.fn(),
  cacheCommitMany: vi.fn(),
  config: {
    enableVideoSubtitle: true,
    to: 'zh-Hans',
    useCache: true,
    service: 'openai',
    model: { openai: 'gpt-5-mini' },
    customModel: {},
    proxy: { openai: 'https://gateway.example/v1/' },
    customProviders: [],
    system_role: { openai: 'default system' },
    user_role: { openai: 'default user' },
  },
  schedulerOptions: [] as Array<{
    trackKey: string
    sessionId: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    translateBatch: (job: unknown) => Promise<unknown>
    onStatus?: (snapshot: {
      phase: 'starting' | 'catching-up' | 'buffered' | 'failed'
      runwaySeconds: number
      activeRuns: number
      failedInImmediateWindow: boolean
    }) => void
    onTranslationCommitted?: (results: Array<{
      id: string
      translatedText: string
      cacheable?: boolean
    }>) => void
  }>,
  schedulers: [] as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
}))

vi.mock('@/entrypoints/video/parser', () => ({ parseSubtitleData: mocks.parseSubtitleData }))
vi.mock('@/entrypoints/video/segmenter', () => ({
  buildSubtitleSegments: mocks.buildSubtitleSegments,
  segmenterVersion: 2,
}))
vi.mock('@/entrypoints/video/overlay', () => ({
  SubtitleOverlay: class {
    mount = mocks.overlayMount
    setSegments = mocks.overlaySetSegments
    cleanup = mocks.overlayCleanup
    show = mocks.overlayShow
    hide = mocks.overlayHide
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
  canUseStructuredSubtitleTranslation: mocks.canUseStructuredSubtitleTranslation,
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

describe('video subtitle manager lifecycle', () => {
  beforeEach(() => {
    window.location.href = 'https://www.youtube.com/watch?v=video'
    document.body.innerHTML = `
      <div class="player">
        <video></video>
        <div class="native-caption"></div>
        <div class="ytp-right-controls"></div>
      </div>
    `
    document.title = 'Original Video - YouTube'
    history.replaceState({}, '', '/watch?v=video')
    mocks.parseSubtitleData.mockReset().mockReturnValue({
      cues: [{ start: 0, end: 1, text: 'Hello' }],
      format: 'youtube-json3',
      sourceLanguage: 'en',
    })
    mocks.buildSubtitleSegments.mockReset().mockReturnValue([{
      id: 'segment',
      start: 0,
      end: 1,
      sourceText: 'Hello',
      status: 'pending',
    }])
    mocks.overlayMount.mockClear()
    mocks.overlaySetSegments.mockClear()
    mocks.overlayCleanup.mockClear()
    mocks.overlayShow.mockClear()
    mocks.overlayHide.mockClear()
    mocks.translateSubtitleBatch.mockReset()
    mocks.canUseStructuredSubtitleTranslation.mockReset().mockReturnValue(true)
    mocks.cacheHydrate.mockReset().mockResolvedValue([])
    mocks.cacheCommitMany.mockReset().mockResolvedValue(undefined)
    mocks.config.useCache = true
    mocks.createCacheSession.mockReset().mockResolvedValue({
      hydrate: mocks.cacheHydrate,
      commitMany: mocks.cacheCommitMany,
    })
    mocks.schedulerOptions.length = 0
    mocks.schedulers.length = 0
  })

  it('hydrates before scheduling, exposes progress and isolates track/navigation lifecycle', async () => {
    let releaseHydration!: (hits: Array<{ id: string; translatedText: string }>) => void
    mocks.cacheHydrate.mockReturnValueOnce(new Promise(resolve => {
      releaseHydration = resolve
    }))

    vi.resetModules()
    const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
    initVideoSubtitle()

    const quickButton = document.getElementById('fr-subtitle-quick-btn') as HTMLButtonElement
    expect(quickButton.dataset.subtitleStatus).toBe('loading')
    expect(quickButton.getAttribute('aria-pressed')).toBe('true')

    const statusEvent = new MessageEvent('message', {
      data: {
        eventType: 'fr-subtitle-inject',
        type: 'youtube-subtitle-status',
        videoId: 'video',
        status: 'waiting-cc',
      },
    })
    Object.defineProperty(statusEvent, 'source', { value: window })
    window.dispatchEvent(statusEvent)
    expect(quickButton.dataset.subtitleStatus).toBe('waiting-cc')
    expect(quickButton.title).toBe('video.subtitleWaitingCc')

    const capture = (lang: string) => {
      const event = new MessageEvent('message', {
        data: {
          eventType: 'fr-subtitle-inject',
          type: 'subtitle-captured',
          url: `https://www.youtube.com/api/timedtext?v=video&lang=${lang}&fmt=json3`,
          data: '{"events":[]}',
        },
      })
      Object.defineProperty(event, 'source', { value: window })
      window.dispatchEvent(event)
    }

    capture('en')
    capture('en')
    await vi.waitFor(() => expect(mocks.createCacheSession).toHaveBeenCalledTimes(1))
    expect(mocks.parseSubtitleData).toHaveBeenCalledTimes(1)
    expect(mocks.schedulers).toHaveLength(0)
    expect(quickButton.dataset.subtitleStatus).toBe('starting')
    expect(mocks.createCacheSession).toHaveBeenCalledWith(expect.objectContaining({
      useCache: true,
      identity: expect.objectContaining({
        trackKey: 'youtube|video|en|||',
        sourceLanguage: 'en',
        targetLanguage: 'zh-Hans',
        segmenterVersion: 2,
        contextVersion: 'subtitle-neighborhood-v1',
        mode: 'structured',
        service: 'openai',
        model: 'gpt-5-mini',
        endpoint: 'https://gateway.example/v1',
        fastMode: true,
        title: 'Original Video',
      }),
    }))

    document.title = 'Updated Video - YouTube'
    releaseHydration([{ id: 'segment', translatedText: '你好' }])
    await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(1))
    expect(mocks.schedulers[0].start).toHaveBeenCalledTimes(1)
    expect(mocks.overlaySetSegments).toHaveBeenCalledWith([
      expect.objectContaining({ status: 'translated', translatedText: '你好' }),
    ])
    expect(mocks.schedulerOptions[0]).toEqual(expect.objectContaining({
      trackKey: 'youtube|video|en|||',
      sessionId: '1',
      sourceLanguage: 'en',
      targetLanguage: 'zh-Hans',
      title: 'Original Video',
      translateBatch: mocks.translateSubtitleBatch,
    }))

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(100_000)
    const timeoutSpy = vi.spyOn(window, 'setTimeout')
    mocks.schedulerOptions[0].onStatus?.({
      phase: 'catching-up',
      runwaySeconds: 8,
      activeRuns: 2,
      failedInImmediateWindow: false,
    })
    expect(quickButton.dataset.subtitleStatus).toBe('catching-up')
    expect(quickButton.title).toBe('video.subtitleTranslationCatchingUp:8')
    const hint = document.getElementById('fr-subtitle-status-hint')!
    expect(hint.hidden).toBe(false)
    expect(quickButton.contains(hint)).toBe(false)
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-live')).toBe('polite')
    expect(hint.textContent).toBe('video.subtitleTranslationCatchingUp:8')

    mocks.schedulerOptions[0].onStatus?.({
      phase: 'catching-up',
      runwaySeconds: 13,
      activeRuns: 1,
      failedInImmediateWindow: false,
    })
    expect(quickButton.title).toBe('video.subtitleTranslationCatchingUp:13')
    expect(hint.textContent).toBe('video.subtitleTranslationCatchingUp:8')

    mocks.schedulerOptions[0].onStatus?.({
      phase: 'buffered',
      runwaySeconds: 32,
      activeRuns: 0,
      failedInImmediateWindow: false,
    })
    expect(hint.textContent).toBe('video.subtitleTranslationBuffered')
    expect(timeoutSpy.mock.calls.at(-1)?.[1]).toBe(2_000)
    const hideBufferedHint = timeoutSpy.mock.calls.at(-1)?.[0] as TimerHandler
    expect(typeof hideBufferedHint).toBe('function')
    ;(hideBufferedHint as () => void)()
    expect(hint.hidden).toBe(true)

    mocks.schedulerOptions[0].onStatus?.({
      phase: 'catching-up',
      runwaySeconds: 14,
      activeRuns: 1,
      failedInImmediateWindow: false,
    })
    expect(quickButton.title).toBe('video.subtitleTranslationCatchingUp:14')
    expect(hint.hidden).toBe(true)
    expect(hint.textContent).toBe('')

    mocks.schedulerOptions[0].onTranslationCommitted?.([
      { id: 'segment', translatedText: '你好', cacheable: true },
      { id: 'degraded', translatedText: '降级', cacheable: false },
    ])
    expect(mocks.cacheCommitMany).toHaveBeenCalledWith([
      { id: 'segment', translatedText: '你好', cacheable: true },
    ])

    mocks.config.useCache = false
    mocks.schedulerOptions[0].onTranslationCommitted?.([
      { id: 'segment', translatedText: 'must not persist', cacheable: true },
    ])
    expect(mocks.cacheCommitMany).toHaveBeenCalledTimes(1)
    mocks.config.useCache = true

    capture('fr')
    await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(2))
    expect(mocks.schedulers[0].stop).toHaveBeenCalledTimes(1)

    history.pushState({}, '', '/watch?v=next-video')
    window.dispatchEvent(new Event('yt-navigate-finish'))
    expect(mocks.schedulers[1].stop).toHaveBeenCalledTimes(1)
    expect(mocks.overlayCleanup).toHaveBeenCalled()
    const navigationHint = document.getElementById('fr-subtitle-status-hint')!
    expect(navigationHint.hidden).toBe(true)
    expect(navigationHint.textContent).toBe('')
    nowSpy.mockRestore()
    timeoutSpy.mockRestore()
  })
})
