import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  playerWatchCleanups: [] as Array<() => void>,
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
    videoSubtitleFastMode: true,
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
vi.mock('@/entrypoints/video/redditVideoPlayer', async importOriginal => {
  const actual = await importOriginal<typeof import('@/entrypoints/video/redditVideoPlayer')>()
  return {
    ...actual,
    watchRedditVideoPlayers: (...args: Parameters<typeof actual.watchRedditVideoPlayers>) => {
      const cleanup = actual.watchRedditVideoPlayers(...args)
      mocks.playerWatchCleanups.push(cleanup)
      return cleanup
    },
  }
})
vi.mock('@/entrypoints/utils/i18n/content', () => ({
  t: (key: string, params: Record<string, string | number> = {}) => (
    params.seconds === undefined ? key : `${key}:${params.seconds}`
  ),
}))

describe('video subtitle manager lifecycle', () => {
  afterEach(() => {
    mocks.playerWatchCleanups.splice(0).forEach(stop => stop())
  })
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
    mocks.config.videoSubtitleFastMode = true
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
      translateBatch: expect.any(Function),
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
    expect(quickButton.title).toBe(
      'video.subtitleTranslationCatchingUp:8 · video.subtitleFastModeActive',
    )
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
    expect(quickButton.title).toBe(
      'video.subtitleTranslationCatchingUp:13 · video.subtitleFastModeActive',
    )
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
    expect(quickButton.title).toBe(
      'video.subtitleTranslationCatchingUp:14 · video.subtitleFastModeActive',
    )
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

  it('loads Reddit captions into the shared scheduler and restores native captions when disabled', async () => {
    window.location.href = 'https://www.reddit.com/r/test/comments/1oiu9xm/video/'
    document.body.innerHTML = '<shreddit-player post-id="t3_1oiu9xm" src="https://v.redd.it/eflpgc6r0zxf1/HLSPlaylist.m3u8" caption-url="https://v.redd.it/eflpgc6r0zxf1/wh_ben_en.vtt"></shreddit-player>'
    const host = document.querySelector('shreddit-player')!
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<video src="blob:reddit"></video><shreddit-media-ui></shreddit-media-ui>'
    const native = root.querySelector('shreddit-media-ui')!.attachShadow({ mode: 'open' })
    native.innerHTML = '<shreddit-caption-overlay></shreddit-caption-overlay>'
    const sendMessage = vi.fn().mockResolvedValue({
      status: 'ready', url: 'https://v.redd.it/eflpgc6r0zxf1/wh_ben_en.vtt', data: 'WEBVTT', language: 'en',
    })
    vi.stubGlobal('browser', { runtime: { sendMessage } })
    try {
      vi.resetModules()
      const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
      initVideoSubtitle()
      await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(1))
      const button = root.querySelector<HTMLButtonElement>('[data-only-translate-video]')!
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'LOAD_REDDIT_VIDEO_SUBTITLE', videoId: 'eflpgc6r0zxf1',
        captionUrl: 'https://v.redd.it/eflpgc6r0zxf1/wh_ben_en.vtt',
      })
      expect(mocks.overlayMount).toHaveBeenCalledWith(root.querySelector('video'), button.parentElement, true)
      expect(mocks.schedulerOptions[0].sourceLanguage).toBe('en')
      const caption = native.querySelector<HTMLElement>('shreddit-caption-overlay')!
      expect(caption.style.visibility).toBe('hidden')
      button.click()
      expect(button.dataset.subtitleStatus).toBe('disabled')
      expect(mocks.schedulers[0].stop).toHaveBeenCalledOnce()
      expect(caption.style.visibility).toBe('')
      root.querySelector('video')!.dispatchEvent(new Event('play'))
      expect(sendMessage).toHaveBeenCalledOnce()
      button.click()
      expect(mocks.schedulers).toHaveLength(2)
      expect(caption.style.visibility).toBe('hidden')
      host.remove()
      await vi.waitFor(() => expect(mocks.schedulers[1].stop).toHaveBeenCalledOnce())
      expect(caption.style.visibility).toBe('')
    } finally { vi.unstubAllGlobals() }
  })

  it('discards late Reddit responses when a player element is reused for a different media ID', async () => {
    window.location.href = 'https://www.reddit.com/r/test/comments/1oiu9xm/video/'
    document.body.innerHTML = '<shreddit-player post-id="t3_1oiu9xm" src="https://v.redd.it/eflpgc6r0zxf1/HLSPlaylist.m3u8"></shreddit-player>'
    const host = document.querySelector('shreddit-player')!
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<video src="blob:reddit"></video>'
    let finishOld!: (result: unknown) => void
    const sendMessage = vi.fn().mockReturnValueOnce(new Promise(resolve => { finishOld = resolve }))
      .mockResolvedValue({ status: 'no-track' })
    vi.stubGlobal('browser', { runtime: { sendMessage } })
    try {
      vi.resetModules()
      const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
      initVideoSubtitle()
      host.setAttribute('src', 'https://v.redd.it/anothervideo1/HLSPlaylist.m3u8')
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
      finishOld({ status: 'ready', url: 'https://v.redd.it/eflpgc6r0zxf1/wh_ben_en.vtt', data: 'WEBVTT', language: 'en' })
      await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('[data-only-translate-video]')!.dataset.subtitleStatus).toBe('no-track'))
      expect(mocks.overlayMount).not.toHaveBeenCalled()
      expect(mocks.schedulers).toHaveLength(0)
      expect(sendMessage.mock.calls.map(([request]) => request.videoId)).toEqual(['eflpgc6r0zxf1', 'anothervideo1'])
    } finally {
      host.remove()
      vi.unstubAllGlobals()
    }
  })

  it('automatically translates the post video and follows playback without re-enabling a disabled player', async () => {
    window.location.href = 'https://teapaw.org/main/status/111'
    document.body.innerHTML = `
      <div class="timeline-item"><div><video></video></div></div>
      <div class="timeline-item">
        <span class="tweet-date"><a href="/reply/status/222#m">Reply</a></span>
        <div><video></video></div>
      </div>`
    let finishFirst!: (result: unknown) => void
    const sendMessage = vi.fn()
      .mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve }))
      .mockResolvedValueOnce({ status: 'no-track' })
      .mockResolvedValueOnce({
        status: 'ready', url: 'https://video.twimg.com/second.vtt', data: 'WEBVTT', language: 'en',
      })
    vi.stubGlobal('browser', { runtime: { sendMessage } })
    try {
      vi.resetModules()
      const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
      initVideoSubtitle()
      const [first, second] = document.querySelectorAll<HTMLButtonElement>('[data-only-translate-video]')
      const secondVideo = second.parentElement!.querySelector('video')!
      expect(sendMessage).toHaveBeenCalledOnce()
      expect(first.dataset.subtitleStatus).toBe('loading')

      secondVideo.dispatchEvent(new Event('play'))
      finishFirst({ status: 'ready', url: 'https://video.twimg.com/first.vtt', data: 'WEBVTT' })
      await vi.waitFor(() => expect(second.dataset.subtitleStatus).toBe('no-track'))
      expect(first.getAttribute('aria-pressed')).toBe('false')
      expect(sendMessage.mock.calls.map(([request]) => request.postId)).toEqual(['111', '222'])
      expect(mocks.overlayMount).not.toHaveBeenCalled()
      expect(second.parentElement?.querySelector('[role="status"]')?.textContent).toBe('video.subtitleNoTrack')

      second.click()
      expect(second.dataset.subtitleStatus).toBe('disabled')
      secondVideo.dispatchEvent(new Event('play'))
      expect(sendMessage).toHaveBeenCalledTimes(2)
      expect(second.dataset.subtitleStatus).toBe('disabled')
      second.click()
      await vi.waitFor(() => expect(mocks.schedulers).toHaveLength(1))
      expect(mocks.overlayMount).toHaveBeenCalledWith(secondVideo, second.parentElement, true)
      expect(mocks.schedulerOptions[0].sourceLanguage).toBe('en')
      secondVideo?.remove()
      await vi.waitFor(() => expect(mocks.schedulers[0].stop).toHaveBeenCalledOnce())
      expect(second.isConnected).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
