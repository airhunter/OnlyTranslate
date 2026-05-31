import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initVideoSubtitle: vi.fn()
}))

vi.mock('@/entrypoints/video/manager', () => ({
  initVideoSubtitle: mocks.initVideoSubtitle
}))

import { setupVideoSubtitle } from '@/entrypoints/content/videoSubtitleSetup'

describe('video subtitle setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes video subtitles through the default initializer', () => {
    setupVideoSubtitle()

    expect(mocks.initVideoSubtitle).toHaveBeenCalledTimes(1)
  })

  it('can initialize video subtitles through a provided initializer', () => {
    const initVideoSubtitle = vi.fn()

    setupVideoSubtitle(initVideoSubtitle)

    expect(initVideoSubtitle).toHaveBeenCalledTimes(1)
    expect(mocks.initVideoSubtitle).not.toHaveBeenCalled()
  })
})
