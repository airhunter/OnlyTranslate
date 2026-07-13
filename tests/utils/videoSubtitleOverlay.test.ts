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
})
