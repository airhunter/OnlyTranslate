import { describe, expect, it, vi } from 'vitest'

import {
  setupContentRuntimeControls,
  setupContentUnloadCleanup
} from '@/entrypoints/content/contentControls'

function createRuntime() {
  const listeners: Array<(message: any, sender: unknown, sendResponse: (response?: unknown) => void) => boolean> = []

  return {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => listeners.push(listener)),
        removeListener: vi.fn((listener) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) listeners.splice(index, 1)
        })
      }
    },
    send(message: any) {
      const responses: unknown[] = []
      const handled = listeners.some(listener => listener(message, {}, response => responses.push(response)))
      return { handled, responses }
    }
  }
}

describe('content controls', () => {
  it('handles cache and floating ball runtime messages', () => {
    const runtime = createRuntime()
    const cache = { clean: vi.fn() }
    const mountFloatingBall = vi.fn()
    const unmountFloatingBall = vi.fn()

    const lifecycle = setupContentRuntimeControls({
      runtime: runtime.runtime,
      config: {},
      document,
      cache,
      mountFloatingBall,
      unmountFloatingBall,
      mountSelectionTranslator: vi.fn(),
      unmountSelectionTranslator: vi.fn()
    })

    expect(runtime.send({ message: 'clearCache' })).toEqual({ handled: true, responses: [undefined] })
    expect(cache.clean).toHaveBeenCalledTimes(1)

    expect(runtime.send({ type: 'toggleFloatingBall', isEnabled: true })).toEqual({ handled: true, responses: [undefined] })
    expect(mountFloatingBall).toHaveBeenCalledTimes(1)

    expect(runtime.send({ type: 'toggleFloatingBall', isEnabled: false })).toEqual({ handled: true, responses: [undefined] })
    expect(unmountFloatingBall).toHaveBeenCalledTimes(1)

    lifecycle.dispose()
    expect(runtime.runtime.onMessage.removeListener).toHaveBeenCalledTimes(3)
  })

  it('updates the selection translator mode from runtime messages', () => {
    document.body.innerHTML = ''
    const runtime = createRuntime()
    const config: { selectionTranslatorMode?: string } = {}
    const mountSelectionTranslator = vi.fn()
    const unmountSelectionTranslator = vi.fn()

    const lifecycle = setupContentRuntimeControls({
      runtime: runtime.runtime,
      config,
      document,
      cache: { clean: vi.fn() },
      mountFloatingBall: vi.fn(),
      unmountFloatingBall: vi.fn(),
      mountSelectionTranslator,
      unmountSelectionTranslator
    })

    runtime.send({ type: 'updateSelectionTranslatorMode', mode: 'disabled' })
    expect(config.selectionTranslatorMode).toBe('disabled')
    expect(unmountSelectionTranslator).toHaveBeenCalledTimes(1)

    runtime.send({ type: 'updateSelectionTranslatorMode', mode: 'icon' })
    expect(config.selectionTranslatorMode).toBe('icon')
    expect(mountSelectionTranslator).toHaveBeenCalledTimes(1)

    lifecycle.dispose()
  })

  it('cleans translation resources before unload', () => {
    const cancelAllTranslations = vi.fn()
    const unmountFloatingBall = vi.fn()
    const unmountSelectionTranslator = vi.fn()

    const lifecycle = setupContentUnloadCleanup({
      window,
      cancelAllTranslations,
      unmountFloatingBall,
      unmountSelectionTranslator
    })

    window.dispatchEvent(new Event('beforeunload'))

    expect(cancelAllTranslations).toHaveBeenCalledTimes(1)
    expect(unmountFloatingBall).toHaveBeenCalledTimes(1)
    expect(unmountSelectionTranslator).toHaveBeenCalledTimes(1)

    lifecycle.dispose()
  })
})
