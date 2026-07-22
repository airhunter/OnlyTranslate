import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clean: vi.fn(),
  queryTabs: vi.fn(),
  sendTabMessage: vi.fn(),
  sendRuntimeMessage: vi.fn(),
}))

vi.mock('@/entrypoints/utils/cache', () => ({
  cache: { clean: mocks.clean },
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: mocks.queryTabs,
      sendMessage: mocks.sendTabMessage,
    },
    runtime: {
      sendMessage: mocks.sendRuntimeMessage,
    },
  },
}))

import { clearTranslationCache } from '@/entrypoints/utils/clearTranslationCache'

describe('clearTranslationCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryTabs.mockResolvedValue([])
    mocks.sendTabMessage.mockResolvedValue(undefined)
    mocks.sendRuntimeMessage.mockResolvedValue({ success: true, removed: 0 })
  })

  it('clears shared, subtitle, and currently open page caches', async () => {
    mocks.queryTabs.mockResolvedValue([{ id: 3 }, { id: 7 }, {}])
    mocks.sendRuntimeMessage.mockResolvedValue({ success: true, removed: 4 })
    mocks.sendTabMessage.mockImplementation(async (tabId: number) => {
      if (tabId === 7) throw new Error('restricted tab')
    })

    await expect(clearTranslationCache()).resolves.toEqual({
      clearedPageTabs: 1,
      videoSubtitleEntries: 4,
    })

    expect(mocks.clean).toHaveBeenCalledOnce()
    expect(mocks.queryTabs).toHaveBeenCalledWith({})
    expect(mocks.sendRuntimeMessage).toHaveBeenCalledWith({ type: 'CLEAR_VIDEO_SUBTITLE_CACHE' })
    expect(mocks.sendTabMessage).toHaveBeenCalledWith(3, { message: 'clearCache' })
    expect(mocks.sendTabMessage).toHaveBeenCalledWith(7, { message: 'clearCache' })
  })

  it('reports a subtitle cache clearing failure', async () => {
    mocks.sendRuntimeMessage.mockResolvedValue({ success: false, error: 'storage unavailable' })

    await expect(clearTranslationCache()).rejects.toThrow('storage unavailable')
    expect(mocks.clean).toHaveBeenCalledOnce()
    expect(mocks.sendTabMessage).not.toHaveBeenCalled()
  })
})
