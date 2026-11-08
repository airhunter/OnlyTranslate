import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleSegment } from '@/entrypoints/video/types'

const mockConfig = vi.hoisted(() => ({ display: 1 }))

vi.mock('@/entrypoints/utils/config', () => ({ config: mockConfig }))

import { SubtitleOverlay } from '@/entrypoints/video/overlay'

const makeSegment = (overrides: Partial<SubtitleSegment> = {}): SubtitleSegment => ({
  id: 'segment',
  start: 0,
  end: 10,
  sourceText: 'Original',
  status: 'pending',
  ...overrides,
})

describe('video subtitle overlay', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    mockConfig.display = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  function mount(segment: SubtitleSegment) {
    const target = document.createElement('div')
    const video = document.createElement('video')
    video.currentTime = 1
    target.appendChild(video)
    document.body.appendChild(target)
    const overlay = new SubtitleOverlay()
    overlay.mount(video, target)
    overlay.setSegments([segment])
    return { overlay, container: target.querySelector('#fr-subtitle-overlay')! }
  }

  it('shows one original line while bilingual translation is pending', () => {
    const { overlay, container } = mount(makeSegment())

    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('Original')
    overlay.cleanup()
  })

  it('shows original and translation after bilingual translation completes', () => {
    const { overlay, container } = mount(makeSegment({
      status: 'translated',
      translatedText: '译文',
    }))

    expect(Array.from(container.children).map(child => child.textContent)).toEqual(['Original', '译文'])
    overlay.cleanup()
  })

  it('shows only translated text in translation-only mode', () => {
    mockConfig.display = 0
    const { overlay, container } = mount(makeSegment({
      status: 'translated',
      translatedText: '译文',
    }))

    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('译文')
    overlay.cleanup()
  })

  it('falls back to original text after translation failure', () => {
    mockConfig.display = 0
    const { overlay, container } = mount(makeSegment({ status: 'failed' }))

    expect(container.textContent).toBe('Original')
    overlay.cleanup()
  })

  it('does not render duplicate lines when no translation is needed', () => {
    const { overlay, container } = mount(makeSegment({
      status: 'translated',
      translatedText: 'Original',
    }))

    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('Original')
    overlay.cleanup()
  })

  it('temporarily hides captions over the playback controls without moving them', () => {
    const target = document.createElement('div')
    const video = document.createElement('video')
    video.controls = true
    video.currentTime = 2
    target.append(video)
    document.body.append(target)
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 300))

    const overlay = new SubtitleOverlay()
    overlay.mount(video, target, true)
    overlay.setSegments([makeSegment()])
    const container = target.querySelector<HTMLElement>('#fr-subtitle-overlay')!
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 200, 400, 76))
    target.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, clientY: 280 }))
    expect(container.style.opacity).toBe('0')
    expect(container.style.bottom).toBe('8%')

    target.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, clientY: 150 }))
    expect(container.style.opacity).toBe('')
    expect(container.textContent).toBe('Original')
    overlay.cleanup()
  })

  it('moves the current translation into the native video track during video-only fullscreen', () => {
    const target = document.createElement('div')
    const video = document.createElement('video')
    target.append(video)
    document.body.append(target)
    video.currentTime = 2
    let fullscreen: Element | null = video
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen })
    const track = { mode: 'disabled', addCue: vi.fn(), removeCue: vi.fn() }
    const addTextTrack = vi.fn(() => track)
    Object.defineProperty(video, 'addTextTrack', { value: addTextTrack })
    vi.stubGlobal('VTTCue', class {
      constructor(public startTime: number, public endTime: number, public text: string) {}
    })

    const overlay = new SubtitleOverlay()
    const segment = makeSegment({ status: 'translated', translatedText: '译文' })
    try {
      overlay.mount(video, target, true)
      overlay.setSegments([segment])
      expect(track.mode).toBe('showing')
      expect(track.addCue).toHaveBeenCalledWith(expect.objectContaining({ text: 'Original\n译文' }))
      expect(target.querySelector('#fr-subtitle-overlay')?.textContent).toBe('')

      fullscreen = target
      overlay.setSegments([segment])
      expect(track.removeCue).toHaveBeenCalledOnce()
      expect(track.mode).toBe('disabled')
      expect(target.querySelector('#fr-subtitle-overlay')?.textContent).toBe('Original译文')

      fullscreen = video
      overlay.setSegments([segment])
      expect(addTextTrack).toHaveBeenCalledOnce()
      overlay.hide()
      expect(track.mode).toBe('disabled')
    } finally {
      overlay.cleanup()
      Reflect.deleteProperty(document, 'fullscreenElement')
      vi.unstubAllGlobals()
    }
  })
})
