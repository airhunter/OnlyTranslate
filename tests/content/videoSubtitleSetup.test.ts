import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isSupportedVideoSubtitleHost,
  setupVideoSubtitle
} from '@/entrypoints/content/videoSubtitleSetup'
import { isXVideoSubtitleHost } from '@/entrypoints/video/xSubtitle'

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
    expect(isSupportedVideoSubtitleHost('x.com')).toBe(true)
    expect(isSupportedVideoSubtitleHost('mobile.twitter.com')).toBe(true)
    expect(isSupportedVideoSubtitleHost('teapaw.org')).toBe(true)
    expect(isSupportedVideoSubtitleHost('notx.com')).toBe(false)
    expect(isSupportedVideoSubtitleHost('www.reddit.com')).toBe(true)
    expect(isSupportedVideoSubtitleHost('old.reddit.com')).toBe(true)
    expect(isSupportedVideoSubtitleHost('reddit.com.example.org')).toBe(false)
  })

  it('enables the runtime and X subtitle source on both Teapaw domains', () => {
    for (const host of ['teapaw.org', 'teapawt.org']) {
      expect(isSupportedVideoSubtitleHost(host)).toBe(true)
      expect(isXVideoSubtitleHost(host)).toBe(true)
    }
    expect(isSupportedVideoSubtitleHost('teapawt.org.example.com')).toBe(false)
    expect(isXVideoSubtitleHost('teapawt.org.example.com')).toBe(false)
  })
})
