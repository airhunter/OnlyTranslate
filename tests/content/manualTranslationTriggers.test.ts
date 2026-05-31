import { describe, expect, it, vi } from 'vitest'

import {
  getConfiguredMouseHotkeyParts,
  setupManualTranslationTriggers
} from '@/entrypoints/content/manualTranslationTriggers'

describe('manual translation triggers', () => {
  it('normalizes mouse hotkey parts', () => {
    expect(getConfiguredMouseHotkeyParts({ hotkey: 'Ctrl' })).toEqual(['control'])
    expect(getConfiguredMouseHotkeyParts({ hotkey: 'Option+X' })).toEqual(['alt', 'x'])
    expect(getConfiguredMouseHotkeyParts({ hotkey: 'custom', customHotkey: 'Ctrl+Shift+K' })).toEqual([
      'control',
      'shift',
      'k'
    ])
    expect(getConfiguredMouseHotkeyParts({ hotkey: 'none' })).toEqual([])
  })

  it('translates from the double click position', () => {
    const handleTranslation = vi.fn()
    const lifecycle = setupManualTranslationTriggers({
      config: { hotkey: 'DoubleClick', on: true },
      document,
      window,
      navigator: { platform: 'Win32' } as Navigator,
      handleTranslation
    })

    document.body.dispatchEvent(new MouseEvent('dblclick', {
      clientX: 42,
      clientY: 64,
      bubbles: true
    }))

    expect(handleTranslation).toHaveBeenCalledWith(42, 64)

    lifecycle.dispose()
  })

  it('defers double click translation to the selection translator when text is selected', () => {
    const handleTranslation = vi.fn()
    const lifecycle = setupManualTranslationTriggers({
      config: {
        hotkey: 'DoubleClick',
        on: true,
        disableSelectionTranslator: false,
        selectionTranslatorMode: 'icon'
      },
      document,
      window,
      navigator: { platform: 'Win32' } as Navigator,
      handleTranslation,
      hasActiveTextSelection: () => true
    })

    document.body.dispatchEvent(new MouseEvent('dblclick', {
      clientX: 42,
      clientY: 64,
      bubbles: true
    }))

    expect(handleTranslation).not.toHaveBeenCalled()

    lifecycle.dispose()
  })

  it('translates while the configured mouse hotkey is held and the pointer moves', () => {
    const handleTranslation = vi.fn()
    const lifecycle = setupManualTranslationTriggers({
      config: { hotkey: 'Ctrl', on: true, disableSelectionTranslator: true },
      document,
      window,
      navigator: { platform: 'Win32' } as Navigator,
      handleTranslation
    })

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control',
      code: 'ControlLeft',
      ctrlKey: true,
      bubbles: true
    }))
    document.body.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 11,
      clientY: 22,
      bubbles: true
    }))
    window.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Control',
      code: 'ControlLeft',
      bubbles: true
    }))

    expect(handleTranslation).toHaveBeenCalledTimes(1)
    expect(handleTranslation).toHaveBeenCalledWith(11, 22, 50)

    lifecycle.dispose()
  })
})
