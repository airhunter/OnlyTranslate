import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setupPageTranslationLifecycle } from '@/entrypoints/content/translationLifecycle'

function createRuntime() {
  let listener: ((message: any, sender: unknown, sendResponse: (response?: unknown) => void) => boolean) | undefined

  return {
    runtime: {
      onMessage: {
        addListener: vi.fn((handler) => {
          listener = handler
        })
      }
    },
    send(message: any) {
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
      document,
      runtime: runtime.runtime,
      autoTranslateEnglishPage,
      restoreOriginalContent: vi.fn()
    })

    expect(autoTranslateEnglishPage).toHaveBeenCalledWith()
  })

  it('toggles full page translation from the floating-ball hotkey only when the ball is disabled', () => {
    const runtime = createRuntime()
    const autoTranslateEnglishPage = vi.fn()
    const restoreOriginalContent = vi.fn()

    const lifecycle = setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: true, on: true },
      document,
      runtime: runtime.runtime,
      autoTranslateEnglishPage,
      restoreOriginalContent
    })

    document.dispatchEvent(new CustomEvent('onlytranslate-toggle-translation'))
    document.dispatchEvent(new CustomEvent('onlytranslate-toggle-translation'))

    expect(autoTranslateEnglishPage).toHaveBeenCalledTimes(1)
    expect(restoreOriginalContent).toHaveBeenCalledTimes(1)

    lifecycle.dispose()
  })

  it('handles context menu translate, restore, disabled, and status messages', () => {
    const runtime = createRuntime()
    const autoTranslateEnglishPage = vi.fn()
    const restoreOriginalContent = vi.fn()

    setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: false, on: true },
      document,
      runtime: runtime.runtime,
      autoTranslateEnglishPage,
      restoreOriginalContent
    })

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'fullPage', scope: 'smart' })).toEqual({
      handled: true,
      response: { status: 'success', action: 'translated' }
    })
    expect(autoTranslateEnglishPage).toHaveBeenCalledWith('smart')

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
      response: { status: 'success', isTranslated: true }
    })
  })

  it('responds disabled when the extension is off', () => {
    const runtime = createRuntime()

    setupPageTranslationLifecycle({
      config: { autoTranslate: false, disableFloatingBall: false, on: false },
      document,
      runtime: runtime.runtime,
      autoTranslateEnglishPage: vi.fn(),
      restoreOriginalContent: vi.fn()
    })

    expect(runtime.send({ type: 'contextMenuTranslate', action: 'fullPage' })).toEqual({
      handled: true,
      response: { status: 'disabled' }
    })
  })
})
