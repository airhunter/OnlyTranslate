import { describe, expect, it, vi } from 'vitest'
import { createContentFeatureRequester } from '@/entrypoints/content/contentFeatureRequester'

describe('content feature requester', () => {
  it('coalesces simultaneous initialization requests', async () => {
    let resolveRequest: ((value: { success: boolean }) => void) | undefined
    const sendMessage = vi.fn(() => new Promise<{ success: boolean }>(resolve => {
      resolveRequest = resolve
    }))
    const requester = createContentFeatureRequester({ sendMessage })

    const first = requester.request('selection')
    const second = requester.request('selection')
    resolveRequest?.({ success: true })
    await Promise.all([first, second])

    expect(sendMessage).toHaveBeenCalledOnce()
  })

  it('forwards each action after initialization', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const requester = createContentFeatureRequester({ sendMessage })

    await requester.request('page', { type: 'translate' })
    await requester.request('page', { type: 'restore' })

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'LOAD_CONTENT_FEATURE',
      feature: 'page',
      action: { type: 'restore' },
    })
  })

  it('surfaces background loading errors and allows a retry', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'blocked' })
      .mockResolvedValueOnce({ success: true })
    const requester = createContentFeatureRequester({ sendMessage })

    await expect(requester.request('video')).rejects.toThrow('blocked')
    await expect(requester.request('video')).resolves.toBeUndefined()
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})
