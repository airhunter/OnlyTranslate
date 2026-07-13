import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  parseSubtitleData: vi.fn(),
  buildSubtitleSegments: vi.fn(),
  overlayMount: vi.fn(),
  overlaySetSegments: vi.fn(),
  overlayCleanup: vi.fn(),
  overlayShow: vi.fn(),
  overlayHide: vi.fn(),
  translateText: vi.fn(),
  translateSubtitleBatch: vi.fn(),
  schedulerOptions: [] as Array<{
    trackKey: string
    sessionId: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    translateBatch: (job: unknown) => Promise<unknown>
  }>,
  schedulers: [] as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
}))

vi.mock('@/entrypoints/video/parser', () => ({ parseSubtitleData: mocks.parseSubtitleData }))
vi.mock('@/entrypoints/video/segmenter', () => ({ buildSubtitleSegments: mocks.buildSubtitleSegments }))
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

    constructor(options: {
      trackKey: string
      sessionId: string
      title: string
      sourceLanguage?: string
      targetLanguage: string
      translateBatch: (job: unknown) => Promise<unknown>
    }) {
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
vi.mock('@/entrypoints/video/translator', () => ({ translateSubtitleBatch: mocks.translateSubtitleBatch }))
vi.mock('@/entrypoints/utils/config', () => ({ config: { enableVideoSubtitle: true, to: 'zh-Hans' } }))
vi.mock('@/entrypoints/utils/i18n', () => ({ t: (key: string) => key }))

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
    mocks.translateText.mockReset().mockResolvedValue('你好')
    mocks.schedulerOptions.length = 0
    mocks.schedulers.length = 0
  })

  it('deduplicates the active track, rebuilds on track change and clears on navigation', async () => {
    vi.resetModules()
    const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
    initVideoSubtitle()

    const quickButton = document.getElementById('fr-subtitle-quick-btn') as HTMLButtonElement
    expect(quickButton.dataset.subtitleStatus).toBe('loading')

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
    expect(mocks.parseSubtitleData).toHaveBeenCalledTimes(1)
    expect(mocks.schedulers).toHaveLength(1)
    expect(mocks.schedulers[0].start).toHaveBeenCalledTimes(1)
    expect(quickButton.dataset.subtitleStatus).toBe('ready')

    expect(mocks.schedulerOptions[0]).toEqual(expect.objectContaining({
      trackKey: 'youtube|video|en|||',
      sessionId: '1',
      sourceLanguage: 'en',
      targetLanguage: 'zh-Hans',
      translateBatch: mocks.translateSubtitleBatch,
    }))

    capture('fr')
    expect(mocks.parseSubtitleData).toHaveBeenCalledTimes(2)
    expect(mocks.schedulers[0].stop).toHaveBeenCalledTimes(1)
    expect(mocks.schedulers).toHaveLength(2)

    history.pushState({}, '', '/watch?v=next-video')
    window.dispatchEvent(new Event('yt-navigate-finish'))
    expect(mocks.schedulers[1].stop).toHaveBeenCalledTimes(1)
    expect(mocks.overlayCleanup).toHaveBeenCalled()
  })
})
