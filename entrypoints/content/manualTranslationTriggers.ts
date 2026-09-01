const gestureHotkeys = {
  DoubleClick: 'DoubleClick',
  LongPress: 'LongPress',
  MiddleClick: 'MiddleClick',
  TwoFinger: 'TwoFinger',
  ThreeFinger: 'ThreeFinger',
  FourFinger: 'FourFinger',
  DoubleClickScreen: 'DoubleClickScree',
  TripleClickScreen: 'TripleClickScreen'
} as const

function getCenterPoint(touches: TouchList, point: number): { x: number, y: number } | undefined {
  if (touches.length !== point) return

  let centerX = 0
  let centerY = 0
  for (let index = 0; index < touches.length; index += 1) {
    centerX += touches[index].clientX
    centerY += touches[index].clientY
  }
  return { x: centerX / touches.length, y: centerY / touches.length }
}

export interface ManualTranslationConfig {
  hotkey?: string
  customHotkey?: string
  on?: boolean
  disableSelectionTranslator?: boolean
  selectionTranslatorMode?: string
}

export interface ManualTranslationTriggerOptions {
  config: ManualTranslationConfig
  document: Document
  window: Window
  navigator: Pick<Navigator, 'platform'>
  handleTranslation: (x: number, y: number, delay?: number) => void
  hasActiveTextSelection?: () => boolean
  getCenterPoint?: typeof getCenterPoint
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
}

export interface ManualTranslationTriggerLifecycle {
  dispose: () => void
}

const specialKeys: Record<string, string> = {
  escape: 'escape',
  enter: 'enter',
  space: 'space',
  tab: 'tab',
  backspace: 'backspace',
  delete: 'delete',
  insert: 'insert',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright'
}

export function getConfiguredMouseHotkeyParts(config: ManualTranslationConfig): string[] {
  const hotkeyString = config.hotkey === 'custom'
    ? config.customHotkey
    : config.hotkey

  if (!hotkeyString || hotkeyString === 'none') {
    return []
  }

  if (!hotkeyString.includes('+')) {
    const normalizedKey = hotkeyString.toLowerCase()
    if (normalizedKey === 'ctrl') return ['control']
    if (normalizedKey === 'option') return ['alt']
    return [normalizedKey]
  }

  return hotkeyString.split('+').map(key => {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'ctrl') return 'control'
    if (normalizedKey === 'option') return 'alt'
    return normalizedKey
  })
}

function addKeyboardEventParts(event: KeyboardEvent, pressedKeys: Set<string>, isMac: boolean) {
  if (event.altKey) pressedKeys.add('alt')
  if (event.ctrlKey) pressedKeys.add('control')
  if (event.metaKey && !isMac) pressedKeys.add('control')
  if (event.shiftKey) pressedKeys.add('shift')

  const key = event.key.toLowerCase()
  const code = event.code?.toLowerCase()

  if (code && code.startsWith('key')) {
    pressedKeys.add(code.slice(3).toLowerCase())
  } else if (key.length === 1) {
    pressedKeys.add(key)
  } else if (/^f\d+$/.test(key)) {
    pressedKeys.add(key)
  } else if (specialKeys[key]) {
    pressedKeys.add(specialKeys[key])
  }
}

function removeKeyboardEventParts(event: KeyboardEvent, pressedKeys: Set<string>) {
  const releasedKey = event.key.toLowerCase()
  const releasedCode = event.code?.toLowerCase()

  if (releasedCode && releasedCode.startsWith('key')) {
    pressedKeys.delete(releasedCode.slice(3).toLowerCase())
  } else if (releasedKey.length === 1) {
    pressedKeys.delete(releasedKey)
  } else if (/^f\d+$/.test(releasedKey)) {
    pressedKeys.delete(releasedKey)
  } else if (specialKeys[releasedKey]) {
    pressedKeys.delete(specialKeys[releasedKey])
  }

  if (!event.altKey) pressedKeys.delete('alt')
  if (!event.ctrlKey) pressedKeys.delete('control')
  if (!event.metaKey) pressedKeys.delete('control')
  if (!event.shiftKey) pressedKeys.delete('shift')
}

export function setupManualTranslationTriggers(options: ManualTranslationTriggerOptions): ManualTranslationTriggerLifecycle {
  const {
    config,
    document,
    window,
    navigator,
    handleTranslation,
    hasActiveTextSelection = () => false,
    getCenterPoint: getTouchCenterPoint = getCenterPoint,
    setTimeout: setTimeoutFn = setTimeout,
    clearTimeout: clearTimeoutFn = clearTimeout
  } = options

  const body = document.body
  if (!body) {
    return { dispose: () => {} }
  }

  const screen = {
    mouseX: 0,
    mouseY: 0,
    hotkeyPressed: false,
    otherKeyPressed: false,
    hasSlideTranslation: false
  }
  const mouseHotkeysPressed = new Set<string>()
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  let longPressTimer: ReturnType<typeof setTimeout> | undefined
  let touchTimer: ReturnType<typeof setTimeout> | undefined
  let touchCount = 0
  const startPos = { x: 0, y: 0 }

  const shouldDeferToSelectionTranslator = () => {
    return config.disableSelectionTranslator !== true
      && config.selectionTranslatorMode !== 'disabled'
      && hasActiveTextSelection()
  }

  const checkMouseHotkey = () => {
    const hotkeyParts = getConfiguredMouseHotkeyParts(config)
    if (hotkeyParts.length === 0) return false

    const allKeysPressed = hotkeyParts.every(key => mouseHotkeysPressed.has(key))
    return allKeysPressed && hotkeyParts.length === mouseHotkeysPressed.size
  }

  const cancelLongPressTimer = () => {
    if (longPressTimer !== undefined) {
      clearTimeoutFn(longPressTimer)
    }
  }

  const cancelTouchTimer = () => {
    if (touchTimer !== undefined) {
      clearTimeoutFn(touchTimer)
    }
  }

  const blurHandler = () => {
    screen.hotkeyPressed = false
    screen.otherKeyPressed = false
    screen.hasSlideTranslation = false
    mouseHotkeysPressed.clear()
  }

  const keydownHandler = (event: KeyboardEvent) => {
    if (event.repeat) return
    if (isMac && event.metaKey) return

    addKeyboardEventParts(event, mouseHotkeysPressed, isMac)

    if (checkMouseHotkey()) {
      screen.hotkeyPressed = true
      screen.otherKeyPressed = false
    } else if (screen.hotkeyPressed) {
      screen.otherKeyPressed = true
    }
  }

  const keyupHandler = (event: KeyboardEvent) => {
    removeKeyboardEventParts(event, mouseHotkeysPressed)

    if (
      screen.hotkeyPressed
      && mouseHotkeysPressed.size === 0
      && !screen.otherKeyPressed
      && !screen.hasSlideTranslation
      && config.on
      && !shouldDeferToSelectionTranslator()
    ) {
      handleTranslation(screen.mouseX, screen.mouseY)
    }

    if (mouseHotkeysPressed.size === 0) {
      screen.hotkeyPressed = false
      screen.otherKeyPressed = false
      screen.hasSlideTranslation = false
    }
  }

  const hoverMousemoveHandler = (event: MouseEvent) => {
    screen.mouseX = event.clientX
    screen.mouseY = event.clientY
    if (screen.hotkeyPressed && config.on && !shouldDeferToSelectionTranslator()) {
      screen.hasSlideTranslation = true
      handleTranslation(screen.mouseX, screen.mouseY, 50)
    }
  }

  const touchCenterHandler = (event: TouchEvent) => {
    let coordinate: { x: number, y: number } | undefined
    switch (config.hotkey) {
      case gestureHotkeys.TwoFinger:
        coordinate = getTouchCenterPoint(event.touches, 2)
        break
      case gestureHotkeys.ThreeFinger:
        coordinate = getTouchCenterPoint(event.touches, 3)
        break
      case gestureHotkeys.FourFinger:
        coordinate = getTouchCenterPoint(event.touches, 4)
        break
      default:
        return
    }

    if (config.on && coordinate) {
      handleTranslation(coordinate.x, coordinate.y)
    }
  }

  const dblclickHandler = (event: MouseEvent) => {
    if (config.hotkey === gestureHotkeys.DoubleClick && config.on && !shouldDeferToSelectionTranslator()) {
      handleTranslation(event.clientX, event.clientY)
    }
  }

  const mouseupHandler = () => cancelLongPressTimer()

  const mousedownHandler = (event: MouseEvent) => {
    if (config.hotkey === gestureHotkeys.LongPress) {
      cancelLongPressTimer()
      startPos.x = event.clientX
      startPos.y = event.clientY
      longPressTimer = setTimeoutFn(() => {
        if (config.on && !shouldDeferToSelectionTranslator()) {
          handleTranslation(event.clientX, event.clientY)
        }
      }, 500)
    }

    if (config.hotkey === gestureHotkeys.MiddleClick && config.on && !shouldDeferToSelectionTranslator() && event.button === 1) {
      handleTranslation(event.clientX, event.clientY)
    }
  }

  const cancelLongPressMousemoveHandler = (event: MouseEvent) => {
    if (Math.abs(event.clientX - startPos.x) > 10 || Math.abs(event.clientY - startPos.y) > 10) {
      cancelLongPressTimer()
    }
  }

  const touchMultiTapHandler = (event: TouchEvent) => {
    if (![gestureHotkeys.DoubleClickScreen, gestureHotkeys.TripleClickScreen].includes(config.hotkey as never) || event.touches.length !== 1) {
      return
    }

    const requiredTouches = config.hotkey === gestureHotkeys.DoubleClickScreen ? 2 : 3
    touchCount++

    if (touchCount === 1) {
      touchTimer = setTimeoutFn(() => {
        touchCount = 0
      }, 500)
    } else if (touchCount === requiredTouches) {
      cancelTouchTimer()
      touchCount = 0
      if (config.on) {
        handleTranslation(event.touches[0].clientX, event.touches[0].clientY)
      }
    }
  }

  window.addEventListener('blur', blurHandler)
  window.addEventListener('keydown', keydownHandler)
  window.addEventListener('keyup', keyupHandler)
  body.addEventListener('mousemove', hoverMousemoveHandler)
  body.addEventListener('touchstart', touchCenterHandler)
  body.addEventListener('dblclick', dblclickHandler)
  body.addEventListener('mouseup', mouseupHandler)
  body.addEventListener('mousedown', mousedownHandler)
  body.addEventListener('mousemove', cancelLongPressMousemoveHandler)
  body.addEventListener('touchstart', touchMultiTapHandler)

  return {
    dispose() {
      window.removeEventListener('blur', blurHandler)
      window.removeEventListener('keydown', keydownHandler)
      window.removeEventListener('keyup', keyupHandler)
      body.removeEventListener('mousemove', hoverMousemoveHandler)
      body.removeEventListener('touchstart', touchCenterHandler)
      body.removeEventListener('dblclick', dblclickHandler)
      body.removeEventListener('mouseup', mouseupHandler)
      body.removeEventListener('mousedown', mousedownHandler)
      body.removeEventListener('mousemove', cancelLongPressMousemoveHandler)
      body.removeEventListener('touchstart', touchMultiTapHandler)
      cancelLongPressTimer()
      cancelTouchTimer()
    }
  }
}
