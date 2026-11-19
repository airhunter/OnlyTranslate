import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setupPageTranslationLifecycle } from '@/entrypoints/content/translationLifecycle'
import type { PageTranslationStatus } from '@/entrypoints/utils/pageTranslationStatus'
import { captureManualPageTranslationRequest, consumeManualPageTranslationRequest } from '@/entrypoints/utils/pageTranslateOptOut'

function createRuntime() {
  let listener: ((message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean) | undefined

  return {
    runtime: {
      onMessage: {
        addListener: vi.fn((handler) => {
          listener = handler
        })
      }
    },
    send(message: unknown) {
      let response: unknown
      const handled = listener?.(message, {}, (value?: unknown) => {
        response = value
      })
      return { handled, response }
    }
  }
}

describe('page translation lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('starts auto translation when enabled', () => {
    const runtime = createRuntime()
    const autoTranslateEnglishPage = vi.fn()

    setupPageTranslationLifecycle({
      config: { autoTranslate: true, disableFloatingBall: false, on: true },
      runtime: runtime.runtime,
      getPageTranslationStatus: () => ({ phase: 'idle' }),
      autoTranslateEnglishPage,
      restoreOriginalContent: vi.fn()
    })

    expect(autoTranslateEnglishPage).toHaveBeenCalledWith()
  })

  it('binds delayed manual requests to one use and the same page', () => {
    const token = captureManualPageTranslationRequest()
    expect(consumeManualPageTranslationRequest(token + '-forged')).toBe(false)
    expect(consumeManualPageTranslationRequest(token)).toBe(true)
    expect(consumeManualPageTranslationRequest(token)).toBe(false)
    const url = window.location.href
    const oldPageToken = captureManualPageTranslationRequest()
    try {
      window.history.pushState(null, '', '#new-route')
      expect(consumeManualPageTranslationRequest(oldPageToken)).toBe(false)
    } finally {
      window.history.replaceState(null, '', url)
    }
  })

  it('does not start a privileged translation from a page-generated toggle event', () => {
    const runtime = createRuntime()
    const autoTranslateEnglishPage = vi.fn()
    const restoreOriginalContent = vi.fn()

    const lifecycle = setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: true, on: true },
      runtime: runtime.runtime,
      getPageTranslationStatus: () => ({ phase: 'idle' }),
      autoTranslateEnglishPage,
      restoreOriginalContent
    })

    document.dispatchEvent(new CustomEvent('onlytranslate-toggle-translation'))
    expect(autoTranslateEnglishPage).not.toHaveBeenCalled()
    expect(restoreOriginalContent).not.toHaveBeenCalled()

    lifecycle.dispose()
  })

  it('handles context menu translate, restore, disabled, and status messages', () => {
    const runtime = createRuntime()
    const autoTranslateEnglishPage = vi.fn()
    const restoreOriginalContent = vi.fn()
    let status: PageTranslationStatus = { phase: 'pending', source: 'manual' }

    setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: false, on: true },
      runtime: runtime.runtime,
      autoTranslateEnglishPage,
      restoreOriginalContent,
      getPageTranslationStatus: () => status
    })

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'fullPage', scope: 'smart' })).toEqual({
      handled: true,
      response: { status: 'success', action: 'started' }
    })
    expect(autoTranslateEnglishPage).toHaveBeenCalledWith('smart', true)

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'restore' })).toEqual({
      handled: true,
      response: { status: 'success', action: 'restored' }
    })
    expect(restoreOriginalContent).toHaveBeenCalledTimes(1)

    const translated = document.createElement('p')
    translated.setAttribute('data-fr-translated', 'true')
    document.body.append(translated)
    expect(runtime.send({ type: 'contextMenuTranslate', action: 'getStatus' })).toEqual({
      handled: true,
      response: { status: 'success', isTranslated: false, pageTranslation: { phase: 'pending', source: 'manual' } }
    })
    status = { phase: 'failed', source: 'auto' }
    expect(runtime.send({ type: 'contextMenuTranslate', action: 'getStatus' }).response).toEqual({
      status: 'success', isTranslated: false, pageTranslation: { phase: 'failed', source: 'auto' }
    })
    status = { phase: 'translated' }
    expect(runtime.send({ type: 'contextMenuTranslate', action: 'getStatus' }).response).toEqual({
      status: 'success', isTranslated: true, pageTranslation: { phase: 'translated' }
    })
  })

  it('responds disabled when the extension is off', () => {
    const runtime = createRuntime()

    setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: false, on: false },
      runtime: runtime.runtime,
      getPageTranslationStatus: () => ({ phase: 'idle' }),
      autoTranslateEnglishPage: vi.fn(),
      restoreOriginalContent: vi.fn()
    })

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'fullPage' })).toEqual({
      handled: true,
      response: { status: 'disabled' }
    })
  })

  it('returns the translation startup error when full page translation throws', () => {
    const runtime = createRuntime()

    setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: false, on: true },
      runtime: runtime.runtime,
      getPageTranslationStatus: () => ({ phase: 'idle' }),
      autoTranslateEnglishPage: vi.fn(() => {
        throw new Error('content root failed')
      }),
      restoreOriginalContent: vi.fn()
    })

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'fullPage' })).toEqual({
      handled: true,
      response: { status: 'error', error: 'content root failed' }
    })
  })
})
