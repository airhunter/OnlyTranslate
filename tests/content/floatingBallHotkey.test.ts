import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getConfiguredFloatingBallHotkeyParts,
  setupFloatingBallHotkey
} from '@/entrypoints/content/floatingBallHotkey'

function dispatchKey(type: 'keydown' | 'keyup', options: KeyboardEventInit) {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...options })
  document.dispatchEvent(event)
  return event
}

describe('floating ball hotkey', () => {
  let lifecycle: ReturnType<typeof setupFloatingBallHotkey> | undefined

  afterEach(() => {
    lifecycle?.dispose()
    lifecycle = undefined
    vi.useRealTimers()
  })

  it('normalizes configured hotkey parts', () => {
    expect(getConfiguredFloatingBallHotkeyParts({
      floatingBallHotkey: 'Ctrl+Shift+K'
    })).toEqual(['control', 'shift', 'k'])

    expect(getConfiguredFloatingBallHotkeyParts({
      floatingBallHotkey: 'custom',
      customFloatingBallHotkey: 'Option+X'
    })).toEqual(['alt', 'x'])

    expect(getConfiguredFloatingBallHotkeyParts({
      floatingBallHotkey: 'none'
    })).toEqual([])
  })

  it('dispatches the toggle event for an exact hotkey match', () => {
    const dispatchToggleEvent = vi.fn()
    lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Ctrl+Shift+K', on: true },
      document,
      window,
      navigator: { platform: 'Win32' },
      dispatchToggleEvent
    })

    const event = dispatchKey('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true
    })

    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([['Win32', 't'], ['MacIntel', '†']])('handles fast Alt+T presses on %s', (platform, key) => {
    vi.useFakeTimers({ now: 100 })
    const dispatchToggleEvent = vi.fn()
    lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Alt+T', on: true },
      document,
      window,
      navigator: { platform },
      dispatchToggleEvent
    })

    const tKey = { key, code: 'KeyT', altKey: true }
    dispatchKey('keydown', { key: 'Alt', code: 'AltLeft', altKey: true })
    vi.advanceTimersByTime(20)
    dispatchKey('keydown', tKey)
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)

    dispatchKey('keyup', tKey)
    vi.advanceTimersByTime(20)
    dispatchKey('keydown', tKey)
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(2)
  })

  it('only toggles once while Alt+T is held down', () => {
    vi.useFakeTimers({ now: 100 })
    const dispatchToggleEvent = vi.fn()
    lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Alt+T', on: true },
      document,
      window,
      navigator: { platform: 'Win32' },
      dispatchToggleEvent
    })

    const tKey = { key: 't', code: 'KeyT', altKey: true }
    dispatchKey('keydown', { key: 'Alt', code: 'AltLeft', altKey: true })
    vi.advanceTimersByTime(100)
    dispatchKey('keydown', tKey)
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500)
    const repeated = dispatchKey('keydown', { ...tKey, repeat: true })
    expect(repeated.defaultPrevented).toBe(true)
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    dispatchKey('keydown', tKey)
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(100)
    dispatchKey('keydown', { ...tKey, repeat: true })
    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch when the extension is disabled', () => {
    const dispatchToggleEvent = vi.fn()
    lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Ctrl+Shift+K', on: false },
      document,
      window,
      navigator: { platform: 'Win32' },
      dispatchToggleEvent
    })

    dispatchKey('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true
    })

    expect(dispatchToggleEvent).not.toHaveBeenCalled()
  })
})
