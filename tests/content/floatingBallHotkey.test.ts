import { describe, expect, it, vi } from 'vitest'

import {
  getConfiguredFloatingBallHotkeyParts,
  setupFloatingBallHotkey
} from '@/entrypoints/content/floatingBallHotkey'

describe('floating ball hotkey', () => {
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
    const lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Ctrl+Shift+K', on: true },
      document,
      window,
      navigator: { platform: 'Win32' } as Navigator,
      dispatchToggleEvent,
      now: () => 100
    })

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })

    document.dispatchEvent(event)

    expect(dispatchToggleEvent).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)

    lifecycle.dispose()
  })

  it('does not dispatch when the extension is disabled', () => {
    const dispatchToggleEvent = vi.fn()
    const lifecycle = setupFloatingBallHotkey({
      config: { floatingBallHotkey: 'Ctrl+Shift+K', on: false },
      document,
      window,
      navigator: { platform: 'Win32' } as Navigator,
      dispatchToggleEvent,
      now: () => 100
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }))

    expect(dispatchToggleEvent).not.toHaveBeenCalled()

    lifecycle.dispose()
  })
})
