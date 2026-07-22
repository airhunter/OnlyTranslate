export interface ContentUiMountingOptions {
  document: Pick<Document, 'readyState'>
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>
  mount: () => void
}

export interface ContentUiMountingLifecycle {
  dispose: () => void
}

export function setupContentUiMounting(options: ContentUiMountingOptions): ContentUiMountingLifecycle {
  let disposed = false

  const mount = () => {
    if (disposed) return

    options.window.removeEventListener('load', mount)
    options.mount()
  }

  if (options.document.readyState === 'complete') {
    mount()
  } else {
    options.window.addEventListener('load', mount, { once: true })
  }

  return {
    dispose() {
      disposed = true
      options.window.removeEventListener('load', mount)
    }
  }
}
