import { describe, expect, it, vi } from 'vitest'
import {
  forgetLoadedContentFeatures,
  loadContentFeatureForSender,
} from '@/entrypoints/utils/contentFeatureLoader'

function createBrowserMocks() {
  return {
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
      insertCSS: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('content feature loader', () => {
  it('injects feature CSS and script once per tab and frame, while forwarding every action', async () => {
    const { scripting, tabs } = createBrowserMocks()
    const loadedTargets = new Map<string, Promise<void>>()
    const sender = { tab: { id: 12 }, frameId: 3 }

    await loadContentFeatureForSender(
      { type: 'LOAD_CONTENT_FEATURE', feature: 'floating', action: { type: 'mount' } },
      sender,
      scripting,
      tabs,
      loadedTargets,
    )
    await loadContentFeatureForSender(
      { type: 'LOAD_CONTENT_FEATURE', feature: 'floating', action: { type: 'unmount' } },
      sender,
      scripting,
      tabs,
      loadedTargets,
    )

    expect(scripting.insertCSS).toHaveBeenCalledOnce()
    expect(scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 12, frameIds: [3] },
      files: ['content-scripts/floating-runtime.css'],
    })
    expect(scripting.executeScript).toHaveBeenCalledOnce()
    expect(scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 12, frameIds: [3] },
      files: ['content-scripts/floating-runtime.js'],
    })
    expect(tabs.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('loads script-only features without inserting CSS', async () => {
    const { scripting, tabs } = createBrowserMocks()

    const result = await loadContentFeatureForSender(
      { type: 'LOAD_CONTENT_FEATURE', feature: 'selection' },
      { tab: { id: 7 } },
      scripting,
      tabs,
    )

    expect(result).toEqual({ success: true })
    expect(scripting.insertCSS).not.toHaveBeenCalled()
    expect(scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, frameIds: [0] },
      files: ['content-scripts/selection-runtime.js'],
    })
  })

  it('rejects requests without a sender tab and ignores unrelated messages', async () => {
    const { scripting, tabs } = createBrowserMocks()

    await expect(loadContentFeatureForSender(
      { type: 'LOAD_CONTENT_FEATURE', feature: 'page' },
      {},
      scripting,
      tabs,
    )).resolves.toEqual({
      success: false,
      error: 'Content feature requests require a sender tab',
    })
    await expect(loadContentFeatureForSender(
      { type: 'OTHER' },
      { tab: { id: 1 } },
      scripting,
      tabs,
    )).resolves.toBeUndefined()
  })

  it('forgets only entries belonging to the navigated or closed tab', () => {
    const loaded = Promise.resolve()
    const loadedTargets = new Map([
      ['1:0:page', loaded],
      ['1:2:selection', loaded],
      ['10:0:page', loaded],
    ])

    forgetLoadedContentFeatures(loadedTargets, 1)

    expect([...loadedTargets.keys()]).toEqual(['10:0:page'])
  })

  it('coalesces simultaneous background requests for the same target', async () => {
    let finishInjection: (() => void) | undefined
    const injection = new Promise<void>(resolve => { finishInjection = resolve })
    const { scripting, tabs } = createBrowserMocks()
    scripting.executeScript.mockReturnValue(injection)
    const loadedTargets = new Map<string, Promise<void>>()
    const message = { type: 'LOAD_CONTENT_FEATURE', feature: 'page' } as const
    const sender = { tab: { id: 9 }, frameId: 0 }

    const first = loadContentFeatureForSender(message, sender, scripting, tabs, loadedTargets)
    const second = loadContentFeatureForSender(message, sender, scripting, tabs, loadedTargets)
    finishInjection?.()
    await Promise.all([first, second])

    expect(scripting.insertCSS).toHaveBeenCalledOnce()
    expect(scripting.executeScript).toHaveBeenCalledOnce()
  })
})
