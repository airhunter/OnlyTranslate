import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isSupportedVideoSubtitleHost,
  setupVideoSubtitle
} from '@/entrypoints/content/videoSubtitleSetup'

describe('video subtitle setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and initializes subtitles only on supported video hosts', async () => {
    const initVideoSubtitle = vi.fn()
    const loadModule = vi.fn(async () => ({ initVideoSubtitle }))

    await expect(setupVideoSubtitle('www.youtube.com', loadModule)).resolves.toBe(true)

    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(initVideoSubtitle).toHaveBeenCalledTimes(1)
  })

  it('does not load the video runtime on unrelated hosts', async () => {
    const initVideoSubtitle = vi.fn()
    const loadModule = vi.fn(async () => ({ initVideoSubtitle }))

    await expect(setupVideoSubtitle('example.com', loadModule)).resolves.toBe(false)

    expect(loadModule).not.toHaveBeenCalled()
    expect(initVideoSubtitle).not.toHaveBeenCalled()
  })

  it('matches exact hosts and subdomains without matching lookalike domains', () => {
    expect(isSupportedVideoSubtitleHost('coursera.org')).toBe(true)
    expect(isSupportedVideoSubtitleHost('www.khanacademy.org')).toBe(true)
    expect(isSupportedVideoSubtitleHost('youtube.com.example.org')).toBe(false)
  })
})
