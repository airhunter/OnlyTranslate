import { describe, expect, it, vi } from 'vitest'

import {
  isInputElement,
  removeTriggerSymbols,
  setupInputBoxTranslation
} from '@/entrypoints/content/inputBoxTranslation'

describe('input box translation', () => {
  it('detects editable input targets', () => {
    const textInput = document.createElement('input')
    textInput.type = 'text'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const textarea = document.createElement('textarea')
    const contentEditable = document.createElement('div')
    contentEditable.contentEditable = 'true'

    expect(isInputElement(textInput)).toBe(true)
    expect(isInputElement(checkbox)).toBe(false)
    expect(isInputElement(textarea)).toBe(true)
    expect(isInputElement(contentEditable)).toBe(true)
  })

  it('removes trailing trigger symbols before translation', () => {
    expect(removeTriggerSymbols('hello   ', 'triple_space')).toBe('hello')
    expect(removeTriggerSymbols('hello===', 'triple_equal')).toBe('hello')
    expect(removeTriggerSymbols('hello---', 'triple_dash')).toBe('hello')
    expect(removeTriggerSymbols('hello', 'ctrl_enter')).toBe('hello')
  })

  it('translates focused text input with Ctrl+Enter', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    const inputListener = vi.fn()
    const changeListener = vi.fn()
    textarea.addEventListener('input', inputListener)
    textarea.addEventListener('change', changeListener)

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        success: true,
        translatedText: '你好'
      })
    }
    const lifecycle = setupInputBoxTranslation({
      config: {
        inputBoxTranslationTrigger: 'ctrl_enter',
        inputBoxTranslationTarget: 'zh-Hans',
        animations: false
      },
      document,
      window,
      runtime,
      t: (key) => key
    })

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(event)

    await vi.waitFor(() => expect(textarea.value).toBe('你好'))
    expect(event.defaultPrevented).toBe(true)
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: 'inputBoxTranslation',
      text: 'hello',
      targetLang: 'zh-Hans'
    })
    expect(inputListener).toHaveBeenCalledTimes(1)
    expect(changeListener).toHaveBeenCalledTimes(1)

    lifecycle.dispose()
  })
})
