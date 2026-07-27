import { describe, expect, it, vi } from 'vitest'

import {
  CONTENT_UI_MOUNT_FALLBACK_MS,
  setupContentUiMounting
} from '@/entrypoints/content/contentUiMounting'

describe('content UI mounting', () => {
  it('waits for page load before mounting UI into the document', () => {
    const eventTarget = new EventTarget()
    const mount = vi.fn()
    const cancelScheduled = vi.fn()

    setupContentUiMounting({
      document: { readyState: 'interactive' },
      window: eventTarget as unknown as Window,
      mount,
      schedule: vi.fn(() => 1),
      cancelScheduled
    })

    expect(mount).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(new Event('load'))
    eventTarget.dispatchEvent(new Event('load'))

    expect(mount).toHaveBeenCalledTimes(1)
    expect(cancelScheduled).toHaveBeenCalledWith(1)
  })

  it('mounts immediately when page load has already completed', () => {
    const mount = vi.fn()
    const schedule = vi.fn()

    setupContentUiMounting({
      document: { readyState: 'complete' },
      window: new EventTarget() as unknown as Window,
      mount,
      schedule
    })

    expect(mount).toHaveBeenCalledTimes(1)
    expect(schedule).not.toHaveBeenCalled()
  })

  it('mounts after a fallback delay when the page load event never arrives', () => {
    const eventTarget = new EventTarget()
    const mount = vi.fn()
    let fallback: (() => void) | undefined
    const cancelScheduled = vi.fn()
    const schedule = vi.fn((callback: () => void) => {
      fallback = callback
      return 2
    })

    setupContentUiMounting({
      document: { readyState: 'interactive' },
      window: eventTarget as unknown as Window,
      mount,
      schedule,
      cancelScheduled
    })

    expect(schedule).toHaveBeenCalledWith(expect.any(Function), CONTENT_UI_MOUNT_FALLBACK_MS)
    expect(mount).not.toHaveBeenCalled()

    fallback?.()
    eventTarget.dispatchEvent(new Event('load'))

    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('does not mount after disposal', () => {
    const eventTarget = new EventTarget()
    const mount = vi.fn()
    const cancelScheduled = vi.fn()
    let fallback: (() => void) | undefined
    const lifecycle = setupContentUiMounting({
      document: { readyState: 'loading' },
      window: eventTarget as unknown as Window,
      mount,
      schedule: (callback) => {
        fallback = callback
        return 3
      },
      cancelScheduled
    })

    lifecycle.dispose()
    eventTarget.dispatchEvent(new Event('load'))
    fallback?.()

    expect(mount).not.toHaveBeenCalled()
    expect(cancelScheduled).toHaveBeenCalledWith(3)
  })
})
