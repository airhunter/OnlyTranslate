export interface ContentUiMountingOptions {
  document: Pick<Document, 'readyState'>
  window: Pick<Window, 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'>
  mount: () => void
  schedule?: (callback: () => void, delay: number) => number
  cancelScheduled?: (handle: number) => void
}

export interface ContentUiMountingLifecycle {
  dispose: () => void
}

export const CONTENT_UI_MOUNT_FALLBACK_MS = 2000

export function setupContentUiMounting(options: ContentUiMountingOptions): ContentUiMountingLifecycle {
  let disposed = false
  let mounted = false
  let fallbackTimer: number | undefined
  const schedule = options.schedule
    ?? ((callback, delay) => options.window.setTimeout(callback, delay))
  const cancelScheduled = options.cancelScheduled
    ?? (handle => options.window.clearTimeout(handle))

  const mount = () => {
    if (disposed || mounted) return

    mounted = true
    options.window.removeEventListener('load', mount)
    if (fallbackTimer !== undefined) {
      cancelScheduled(fallbackTimer)
      fallbackTimer = undefined
    }
    options.mount()
  }

  if (options.document.readyState === 'complete') {
    mount()
  } else {
    options.window.addEventListener('load', mount, { once: true })
    fallbackTimer = schedule(mount, CONTENT_UI_MOUNT_FALLBACK_MS)
  }

  return {
    dispose() {
      disposed = true
      options.window.removeEventListener('load', mount)
      if (fallbackTimer !== undefined) {
        cancelScheduled(fallbackTimer)
        fallbackTimer = undefined
      }
    }
  }
}
