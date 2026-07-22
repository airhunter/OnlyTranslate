import { describe, expect, it, vi } from 'vitest'

import { setupContentUiMounting } from '@/entrypoints/content/contentUiMounting'

describe('content UI mounting', () => {
  it('waits for page load before mounting UI into the document', () => {
    const eventTarget = new EventTarget()
    const mount = vi.fn()

    setupContentUiMounting({
      document: { readyState: 'interactive' },
      window: eventTarget as unknown as Window,
      mount
    })

    expect(mount).not.toHaveBeenCalled()

    eventTarget.dispatchEvent(new Event('load'))
    eventTarget.dispatchEvent(new Event('load'))

    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('mounts immediately when page load has already completed', () => {
    const mount = vi.fn()

    setupContentUiMounting({
      document: { readyState: 'complete' },
      window: new EventTarget() as unknown as Window,
      mount
    })

    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('does not mount after disposal', () => {
    const eventTarget = new EventTarget()
    const mount = vi.fn()
    const lifecycle = setupContentUiMounting({
      document: { readyState: 'loading' },
      window: eventTarget as unknown as Window,
      mount
    })

    lifecycle.dispose()
    eventTarget.dispatchEvent(new Event('load'))

    expect(mount).not.toHaveBeenCalled()
  })
})
