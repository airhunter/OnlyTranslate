import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getInputBoxAnchorRect,
  isInputElement,
  removeTriggerSymbols,
  setInputBoxText,
  setupInputBoxTranslation,
  type InputBoxTranslationConfig,
  type InputBoxTranslationLifecycle
} from '@/entrypoints/content/inputBoxTranslation'

const messages: Record<string, string> = {
  'runtime.inputTranslationTranslating': 'Translating',
  'runtime.inputTranslationCandidate': 'Translation suggestion',
  'runtime.inputTranslationAccept': 'Accept',
  'runtime.inputTranslationCancel': 'Cancel',
  'runtime.inputTranslationUnchanged': 'No translation needed',
  'runtime.inputTranslationFailed': 'Translation failed',
  'runtime.inputTranslationRateLimited': 'Too many translation requests',
  'runtime.inputTranslationReloadPage': 'Refresh this page and try again',
  'runtime.inputTranslationUnsupportedEditor': 'Unsupported editor',
  'runtime.translationRequestTimeout': 'Translation request timed out',
  'runtime.microsoftTranslateFailed': 'Microsoft Translator failed'
}

const t = (key: string) => messages[key] ?? key

describe('input box translation', () => {
  let lifecycle: InputBoxTranslationLifecycle | undefined

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    lifecycle?.dispose()
    lifecycle = undefined
    vi.useRealTimers()
  })

  function setup(
    config: InputBoxTranslationConfig,
    translatedText = '你好',
    extra: Partial<Parameters<typeof setupInputBoxTranslation>[0]> = {}
  ) {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({ success: true, translatedText })
    }
    lifecycle = setupInputBoxTranslation({
      config: { animations: false, ...config },
      document,
      window,
      runtime,
      t,
      ...extra
    })
    return runtime
  }

  it('detects editable text targets and rejects sensitive or immutable fields', () => {
    const textInput = document.createElement('input')
    textInput.type = 'text'
    const passwordInput = document.createElement('input')
    passwordInput.type = 'password'
    const readonlyInput = document.createElement('input')
    readonlyInput.readOnly = true
    const disabledTextarea = document.createElement('textarea')
    disabledTextarea.disabled = true
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const textarea = document.createElement('textarea')
    const contentEditable = document.createElement('div')
    contentEditable.contentEditable = 'true'

    expect(isInputElement(textInput)).toBe(true)
    expect(isInputElement(textarea)).toBe(true)
    expect(isInputElement(contentEditable)).toBe(true)
    expect(isInputElement(passwordInput)).toBe(false)
    expect(isInputElement(readonlyInput)).toBe(false)
    expect(isInputElement(disabledTextarea)).toBe(false)
    expect(isInputElement(checkbox)).toBe(false)
  })

  it('removes trailing trigger symbols before translation', () => {
    expect(removeTriggerSymbols('hello    ', 'triple_space')).toBe('hello  ')
    expect(removeTriggerSymbols('hello===', 'triple_equal')).toBe('hello=')
    expect(removeTriggerSymbols('hello---', 'triple_dash')).toBe('hello-')
    expect(removeTriggerSymbols('  hello  ', 'ctrl_enter')).toBe('  hello  ')
    expect(removeTriggerSymbols('  hello  ', 'auto_pause')).toBe('  hello  ')
    expect(removeTriggerSymbols('hello==', 'triple_equal', 0)).toBe('hello==')
  })

  it('keeps outer whitespace unchanged while previewing and cancelling a manual suggestion', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = '  hello\n\n  '
    textarea.focus()
    const runtime = setup({
      inputBoxTranslationTrigger: 'ctrl_enter',
      inputBoxTranslationTarget: 'zh-Hans'
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull())
    expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inputBoxTranslation',
      text: 'hello',
      targetLang: 'zh-Hans'
    }))
    expect(textarea.value).toBe('  hello\n\n  ')

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    }))
    expect(textarea.value).toBe('  hello\n\n  ')
  })

  it('shows a Ctrl+Enter suggestion without replacing text until Tab is pressed', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    const inputListener = vi.fn()
    const changeListener = vi.fn()
    textarea.addEventListener('input', inputListener)
    textarea.addEventListener('change', changeListener)
    const runtime = setup({
      inputBoxTranslationTrigger: 'ctrl_enter',
      inputBoxTranslationTarget: 'zh-Hans'
    })

    const triggerEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(triggerEvent)

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('你好')
    })
    expect(textarea.value).toBe('hello')
    expect(triggerEvent.defaultPrevented).toBe(true)
    expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inputBoxTranslation',
      text: 'hello',
      targetLang: 'zh-Hans'
    }))
    expect(inputListener).not.toHaveBeenCalled()
    expect(changeListener).not.toHaveBeenCalled()

    const acceptEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(acceptEvent)

    expect(acceptEvent.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(textarea.value).toBe('你好'))
    expect(inputListener).toHaveBeenCalledTimes(1)
    expect(changeListener).toHaveBeenCalledTimes(1)
    expect(document.getElementById('fluent-input-translation-tooltip')).toBeNull()
  })

  it('does not intercept Tab when no suggestion is visible', () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.focus()
    const runtime = setup({ inputBoxTranslationTrigger: 'ctrl_enter' })
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    })

    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('dismisses a suggestion with Escape and keeps the original text', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    setup({ inputBoxTranslationTrigger: 'ctrl_enter' })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull())

    const cancelEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(cancelEvent)

    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(textarea.value).toBe('hello')
    expect(document.getElementById('fluent-input-translation-tooltip')).toBeNull()
  })

  it('ignores a stale translation after the user edits the input', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    let resolveTranslation: ((value: { success: boolean; translatedText: string }) => void) | undefined
    const runtime = {
      sendMessage: vi.fn().mockReturnValue(new Promise(resolve => {
        resolveTranslation = resolve
      }))
    }
    lifecycle = setupInputBoxTranslation({
      config: { inputBoxTranslationTrigger: 'ctrl_enter', animations: false },
      document,
      window,
      runtime,
      t
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => expect(runtime.sendMessage).toHaveBeenCalledOnce())

    textarea.value = 'hello again'
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: ' again' }))
    resolveTranslation?.({ success: true, translatedText: '你好' })
    await Promise.resolve()
    await Promise.resolve()

    expect(textarea.value).toBe('hello again')
    expect(document.querySelector('.fluent-input-candidate-text')).toBeNull()
  })

  it('generates a suggestion after typing pauses in automatic mode', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<input type="text">'
    const input = document.querySelector('input')!
    input.value = 'hello'
    input.focus()
    const runtime = setup(
      { inputBoxTranslationTrigger: 'auto_pause' },
      '你好',
      { autoPreviewDelay: 120 }
    )

    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'o' }))
    expect(runtime.sendMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(120)
    await Promise.resolve()

    expect(runtime.sendMessage).toHaveBeenCalledOnce()
    expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('你好')
    expect(input.value).toBe('hello')
  })

  it('stops the loading state and reports a timeout when the background does not respond', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    const runtime = {
      sendMessage: vi.fn().mockReturnValue(new Promise(() => undefined))
    }
    lifecycle = setupInputBoxTranslation({
      config: { inputBoxTranslationTrigger: 'ctrl_enter', animations: true },
      document,
      window,
      runtime,
      t,
      logger: { error: vi.fn() },
      requestTimeout: 100
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await Promise.resolve()
    expect(runtime.sendMessage).toHaveBeenCalledOnce()
    expect(textarea.classList.contains('fluent-input-translating')).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(textarea.classList.contains('fluent-input-translating')).toBe(false)
    expect(document.getElementById('fluent-input-translation-tooltip')?.textContent)
      .toContain('Translation request timed out')
  })

  it('binds browser timer functions to Window before showing a suggestion', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    const guardedSetTimeout = vi.fn(function (
      this: Window,
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) {
      if (this !== window) throw new TypeError('Illegal invocation')
      return window.setTimeout(handler, timeout, ...args)
    }) as unknown as Window['setTimeout']
    const guardedClearTimeout = vi.fn(function (this: Window, timeoutId?: number) {
      if (this !== window) throw new TypeError('Illegal invocation')
      window.clearTimeout(timeoutId)
    }) as unknown as Window['clearTimeout']

    setup(
      { inputBoxTranslationTrigger: 'ctrl_enter', animations: true },
      '你好',
      { setTimeout: guardedSetTimeout, clearTimeout: guardedClearTimeout }
    )

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('你好')
    })
    expect(guardedSetTimeout).toHaveBeenCalled()
  })

  it('keeps triple-space triggering while removing the control spaces', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello  '
    textarea.focus()
    const runtime = setup({ inputBoxTranslationTrigger: 'triple_space' })

    for (let index = 0; index < 3; index += 1) {
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true
      })
      document.dispatchEvent(event)
      if (!event.defaultPrevented) {
        textarea.value += ' '
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: ' ' }))
      }
    }

    await vi.waitFor(() => expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull())
    expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inputBoxTranslation',
      text: 'hello',
      targetLang: 'en'
    }))
    expect(textarea.value).toBe('hello  ')
    expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('你好  ')
  })

  it('reads and replaces the complete CodeMirror document instead of its hidden input buffer', async () => {
    const fullText = '你在标题中描述内容要点。如果一件事情在标题的长度内就可以说清楚，那就没必要写正文'
    document.body.innerHTML = `
      <div class="CodeMirror">
        <div class="CodeMirror-cursor"></div>
        <pre class="CodeMirror-line">${fullText}</pre>
        <textarea></textarea>
      </div>
    `
    const proxy = document.querySelector('textarea')!
    proxy.value = '那就没必要写正文'
    proxy.focus()
    let editorText = fullText
    const editorBridge = {
      read: vi.fn(async () => editorText),
      replace: vi.fn(async (_element: HTMLElement, text: string) => {
        editorText = text
        return true
      }),
      dispose: vi.fn()
    }
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        success: true,
        translatedText: 'Describe the key point in the title; otherwise, there is no need to write the main text.'
      })
    }
    lifecycle = setupInputBoxTranslation({
      config: {
        inputBoxTranslationTrigger: 'triple_space',
        inputBoxTranslationTarget: 'en',
        animations: false
      },
      document,
      window,
      runtime,
      editorBridge,
      t
    })

    for (let index = 0; index < 3; index += 1) {
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true
      })
      document.dispatchEvent(event)
      if (!event.defaultPrevented) {
        editorText += ' '
        proxy.value += ' '
        proxy.dispatchEvent(new InputEvent('input', { bubbles: true, data: ' ' }))
      }
    }

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull()
    })
    expect(runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inputBoxTranslation',
      text: fullText,
      targetLang: 'en'
    }))
    expect(editorBridge.replace).toHaveBeenCalledWith(proxy, fullText)
    expect(proxy.value).toContain('那就没必要写正文')

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => {
      expect(editorText).toBe('Describe the key point in the title; otherwise, there is no need to write the main text.')
    })
  })

  it('does not translate a partial CodeMirror DOM when its complete document is unavailable', async () => {
    document.body.innerHTML = `
      <div class="CodeMirror">
        <pre class="CodeMirror-line">在正式提交之前，你可以点击预览查看完整渲染效果</pre>
        <textarea></textarea>
      </div>
    `
    const proxy = document.querySelector('textarea')!
    proxy.value = '完整渲染效果'
    proxy.focus()
    const editorBridge = {
      read: vi.fn(async () => null),
      replace: vi.fn(async () => false),
      dispose: vi.fn()
    }
    const runtime = setup({
      inputBoxTranslationTrigger: 'ctrl_enter',
      inputBoxTranslationTarget: 'en'
    }, 'Complete rendering effect', {
      editorBridge,
      logger: { error: vi.fn() }
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-tooltip.error')?.textContent).toContain('Translation failed')
    })
    expect(runtime.sendMessage).not.toHaveBeenCalled()
    expect(editorBridge.replace).not.toHaveBeenCalled()
  })

  it('retranslates the current suggestion when its target language is changed', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = '你好'
    textarea.focus()
    const runtime = {
      sendMessage: vi.fn(async (message: { targetLang?: string }) => ({
        success: true,
        translatedText: message.targetLang === 'ja' ? 'こんにちは' : 'Hello'
      }))
    }
    lifecycle = setupInputBoxTranslation({
      config: {
        inputBoxTranslationTrigger: 'ctrl_enter',
        inputBoxTranslationTarget: 'en',
        animations: false
      },
      document,
      window,
      runtime,
      t
    })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('Hello')
    })

    const select = document.querySelector<HTMLSelectElement>('.fluent-input-target-select')!
    select.value = 'ja'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-candidate-text')?.textContent).toBe('こんにちは')
    })
    expect(runtime.sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'inputBoxTranslation',
      text: '你好',
      targetLang: 'ja'
    }))
    expect(textarea.value).toBe('你好')
  })

  it('anchors a CodeMirror suggestion to the visible cursor', () => {
    document.body.innerHTML = `
      <div class="CodeMirror">
        <div class="CodeMirror-cursor"></div>
        <textarea></textarea>
      </div>
    `
    const proxy = document.querySelector('textarea')!
    const cursor = document.querySelector<HTMLElement>('.CodeMirror-cursor')!
    cursor.getBoundingClientRect = () => ({
      x: 240,
      y: 80,
      left: 240,
      top: 80,
      right: 241,
      bottom: 98,
      width: 1,
      height: 18,
      toJSON: () => ({})
    }) as DOMRect

    const rect = getInputBoxAnchorRect(proxy, document, window)

    expect(rect.left).toBe(240)
    expect(rect.bottom).toBe(98)
  })

  it('does not intercept Tab while focus is inside the candidate controls', async () => {
    document.body.innerHTML = '<textarea></textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.value = 'hello'
    textarea.focus()
    setup({ inputBoxTranslationTrigger: 'ctrl_enter' })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull())

    const select = document.querySelector<HTMLSelectElement>('.fluent-input-target-select')!
    select.focus()
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    })
    select.dispatchEvent(tabEvent)

    expect(tabEvent.defaultPrevented).toBe(false)
    expect(textarea.value).toBe('hello')
    expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull()
  })

  it('rejects unknown hidden editor proxies instead of translating their partial buffer', async () => {
    document.body.innerHTML = `
      <div class="monaco-editor">
        <textarea class="inputarea" style="opacity: 0"></textarea>
      </div>
    `
    const proxy = document.querySelector('textarea')!
    proxy.value = '最后一小段'
    proxy.focus()
    const runtime = setup({ inputBoxTranslationTrigger: 'ctrl_enter' })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-tooltip.error')?.textContent).toContain('Unsupported editor')
    })
    expect(runtime.sendMessage).not.toHaveBeenCalled()
    expect(proxy.value).toBe('最后一小段')
  })

  it('protects structured rich-text content from destructive plain-text replacement', async () => {
    document.body.innerHTML = `
      <div class="ProseMirror" contenteditable="true"><p>Hello <strong>world</strong></p></div>
    `
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]')!
    const originalHtml = editor.innerHTML
    editor.focus()
    const runtime = setup({ inputBoxTranslationTrigger: 'ctrl_enter' })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-tooltip.error')?.textContent).toContain('Unsupported editor')
    })
    expect(runtime.sendMessage).not.toHaveBeenCalled()
    expect(editor.innerHTML).toBe(originalHtml)
  })

  it('shows a useful message when the selected service is rate limited', async () => {
    document.body.innerHTML = '<textarea>hello</textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.focus()
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        success: false,
        error: 'Microsoft Translator failed: 429 Too Many Requests'
      })
    }
    setup(
      { inputBoxTranslationTrigger: 'ctrl_enter' },
      '',
      { runtime, logger: { error: vi.fn() } }
    )

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-tooltip.error')?.textContent)
        .toContain('Too many translation requests')
    })
  })

  it('asks for a page refresh after the extension context is invalidated', async () => {
    document.body.innerHTML = '<textarea>hello</textarea>'
    const textarea = document.querySelector('textarea')!
    textarea.focus()
    const runtime = {
      sendMessage: vi.fn().mockRejectedValue(new Error('Extension context invalidated.'))
    }
    setup(
      { inputBoxTranslationTrigger: 'ctrl_enter' },
      '',
      { runtime, logger: { error: vi.fn() } }
    )

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => {
      expect(document.querySelector('.fluent-input-tooltip.error')?.textContent)
        .toContain('Refresh this page and try again')
    })
  })

  it('supports accepting a candidate in a contenteditable field', async () => {
    document.body.innerHTML = '<div contenteditable="true">hello</div>'
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]')!
    editor.focus()
    setup({ inputBoxTranslationTrigger: 'ctrl_enter' })

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
    await vi.waitFor(() => expect(document.querySelector('.fluent-input-candidate-text')).not.toBeNull())
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    }))

    await vi.waitFor(() => expect(editor.textContent).toBe('你好'))
  })

  it('updates standard inputs through replacement events', () => {
    const input = document.createElement('input')
    const listener = vi.fn()
    input.addEventListener('input', listener)

    setInputBoxText(input, 'translated')

    expect(input.value).toBe('translated')
    expect(listener).toHaveBeenCalledOnce()
  })
})
