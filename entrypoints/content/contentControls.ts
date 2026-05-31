interface ContentRuntime {
  onMessage: {
    addListener: (listener: RuntimeMessageListener) => void
    removeListener?: (listener: RuntimeMessageListener) => void
  }
}

type RuntimeMessageListener = (
  message: RuntimeMessage,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => boolean

interface RuntimeMessage {
  message?: string
  type?: string
  isEnabled?: boolean
  mode?: string
}

export interface ContentRuntimeControlOptions {
  runtime: ContentRuntime
  config: { selectionTranslatorMode?: string }
  document: Document
  cache: { clean: () => void }
  mountFloatingBall: () => void
  unmountFloatingBall: () => void
  mountSelectionTranslator: () => void
  unmountSelectionTranslator: () => void
}

export interface ContentUnloadCleanupOptions {
  window: Window
  cancelAllTranslations: () => void
  unmountFloatingBall: () => void
  unmountSelectionTranslator: () => void
}

export interface ContentControlLifecycle {
  dispose: () => void
}

export function setupContentRuntimeControls(options: ContentRuntimeControlOptions): ContentControlLifecycle {
  const {
    runtime,
    config,
    document,
    cache,
    mountFloatingBall,
    unmountFloatingBall,
    mountSelectionTranslator,
    unmountSelectionTranslator
  } = options

  const clearCacheHandler: RuntimeMessageListener = (message, _sender, sendResponse) => {
    if (message.message === 'clearCache') {
      cache.clean()
      sendResponse()
      return true
    }
    return false
  }

  const floatingBallHandler: RuntimeMessageListener = (message, _sender, sendResponse) => {
    if (message.type === 'toggleFloatingBall') {
      if (message.isEnabled) {
        mountFloatingBall()
      } else {
        unmountFloatingBall()
      }
      sendResponse()
      return true
    }
    return false
  }

  const selectionTranslatorHandler: RuntimeMessageListener = (message, _sender, sendResponse) => {
    if (message.type === 'updateSelectionTranslatorMode') {
      config.selectionTranslatorMode = message.mode

      if (message.mode === 'disabled') {
        unmountSelectionTranslator()
      } else if (!document.getElementById('only-translate-selection-translator-container')) {
        mountSelectionTranslator()
      }

      sendResponse()
      return true
    }
    return false
  }

  const listeners = [clearCacheHandler, floatingBallHandler, selectionTranslatorHandler]
  listeners.forEach(listener => runtime.onMessage.addListener(listener))

  return {
    dispose() {
      listeners.forEach(listener => runtime.onMessage.removeListener?.(listener))
    }
  }
}

export function setupContentUnloadCleanup(options: ContentUnloadCleanupOptions): ContentControlLifecycle {
  const {
    window,
    cancelAllTranslations,
    unmountFloatingBall,
    unmountSelectionTranslator
  } = options

  const beforeUnloadHandler = () => {
    cancelAllTranslations()
    unmountFloatingBall()
    unmountSelectionTranslator()
  }

  window.addEventListener('beforeunload', beforeUnloadHandler)

  return {
    dispose() {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
    }
  }
}
