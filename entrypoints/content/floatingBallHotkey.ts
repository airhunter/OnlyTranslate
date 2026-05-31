export interface FloatingBallHotkeyConfig {
  floatingBallHotkey?: string
  customFloatingBallHotkey?: string
  on?: boolean
}

export interface FloatingBallHotkeyOptions {
  config: FloatingBallHotkeyConfig
  document: Document
  window: Window
  navigator: Pick<Navigator, 'platform'>
  dispatchToggleEvent?: () => void
  now?: () => number
  isDev?: boolean
  log?: (message: string) => void
}

export interface FloatingBallHotkeyLifecycle {
  dispose: () => void
}

const specialKeys: Record<string, string> = {
  escape: 'escape',
  enter: 'enter',
  space: 'space',
  tab: 'tab',
  backspace: 'backspace',
  delete: 'delete',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  insert: 'insert'
}

export function getConfiguredFloatingBallHotkeyParts(config: FloatingBallHotkeyConfig): string[] {
  const hotkeyString = config.floatingBallHotkey === 'custom'
    ? config.customFloatingBallHotkey
    : config.floatingBallHotkey

  if (!hotkeyString || hotkeyString === 'none') {
    return []
  }

  return hotkeyString.split('+').map(key => {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'ctrl') return 'control'
    if (normalizedKey === 'option') return 'alt'
    return normalizedKey
  })
}

export function setupFloatingBallHotkey(options: FloatingBallHotkeyOptions): FloatingBallHotkeyLifecycle {
  const {
    config,
    document,
    window,
    navigator,
    dispatchToggleEvent = () => document.dispatchEvent(new CustomEvent('onlytranslate-toggle-translation')),
    now = Date.now,
    isDev = false,
    log = console.log
  } = options

  if (config.floatingBallHotkey === 'none') {
    return { dispose: () => {} }
  }

  const hotkeysPressed = new Set<string>()
  let lastKeyDownTime = 0
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  if (isDev) {
    log(`[OnlyTranslate] 设置悬浮球快捷键: ${config.floatingBallHotkey}, 系统: ${isMac ? 'macOS' : '其他'}`)
  }

  const keydownHandler = (event: KeyboardEvent) => {
    const currentTime = now()
    if (currentTime - lastKeyDownTime < 50) return
    lastKeyDownTime = currentTime

    if (isMac && event.metaKey) {
      return
    }

    if (event.altKey) hotkeysPressed.add('alt')
    if (event.ctrlKey) hotkeysPressed.add('control')
    if (event.metaKey && !isMac) hotkeysPressed.add('control')
    if (event.shiftKey) hotkeysPressed.add('shift')

    const key = event.key.toLowerCase()
    const code = event.code?.toLowerCase()

    if (code && code.startsWith('key')) {
      hotkeysPressed.add(code.slice(3).toLowerCase())
    } else if (key.length === 1) {
      hotkeysPressed.add(key)
    } else if (/^f\d+$/.test(key)) {
      hotkeysPressed.add(key)
    } else if (specialKeys[key]) {
      hotkeysPressed.add(specialKeys[key])
    }

    const hotkeyParts = getConfiguredFloatingBallHotkeyParts(config)
    if (hotkeyParts.length === 0) {
      return
    }

    const allKeysPressed = hotkeyParts.every(key => hotkeysPressed.has(key))
    const exactMatch = allKeysPressed && hotkeyParts.length === hotkeysPressed.size

    if (!exactMatch || !config.on) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    dispatchToggleEvent()

    if (isDev) {
      const activeHotkey = config.floatingBallHotkey === 'custom'
        ? config.customFloatingBallHotkey
        : config.floatingBallHotkey
      log(`[OnlyTranslate] 触发悬浮球翻译，快捷键: ${activeHotkey}`)
    }
  }

  const keyupHandler = (event: KeyboardEvent) => {
    const releasedKey = event.key.toLowerCase()
    const releasedCode = event.code?.toLowerCase()

    if (releasedCode && releasedCode.startsWith('key')) {
      hotkeysPressed.delete(releasedCode.slice(3).toLowerCase())
    } else if (releasedKey.length === 1) {
      hotkeysPressed.delete(releasedKey)
    } else if (/^f\d+$/.test(releasedKey)) {
      hotkeysPressed.delete(releasedKey)
    } else if (specialKeys[releasedKey]) {
      hotkeysPressed.delete(specialKeys[releasedKey])
    }

    if (!event.altKey) hotkeysPressed.delete('alt')
    if (!event.ctrlKey) hotkeysPressed.delete('control')
    if (!event.metaKey) hotkeysPressed.delete('control')
    if (!event.shiftKey) hotkeysPressed.delete('shift')
  }

  const blurHandler = () => {
    hotkeysPressed.clear()
  }

  document.addEventListener('keydown', keydownHandler)
  document.addEventListener('keyup', keyupHandler)
  window.addEventListener('blur', blurHandler)

  return {
    dispose() {
      document.removeEventListener('keydown', keydownHandler)
      document.removeEventListener('keyup', keyupHandler)
      window.removeEventListener('blur', blurHandler)
    }
  }
}
