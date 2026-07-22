import { describe, expect, it, vi } from 'vitest'

import {
  readCodeMirrorEditor,
  replaceCodeMirrorEditor,
  installInputBoxMainWorldBridge
} from '@/entrypoints/content/inputBoxMainWorldBridge'
import { createInputBoxEditorBridge } from '@/entrypoints/content/inputBoxEditorBridge'

describe('input box main-world editor bridge', () => {
  it('reads and replaces the complete CodeMirror document through its page model', () => {
    const root = document.createElement('div') as HTMLDivElement & { CodeMirror?: unknown }
    let value = '第一句。第二句。那就没必要写正文'
    const replaceRange = vi.fn((text: string) => {
      value = text
    })
    const setCursor = vi.fn()
    const save = vi.fn()
    const focus = vi.fn()
    root.CodeMirror = {
      getDoc: () => ({
        getValue: () => value,
        firstLine: () => 0,
        lastLine: () => 0,
        getLine: () => value,
        replaceRange,
        setCursor
      }),
      save,
      focus
    }

    expect(readCodeMirrorEditor(root)).toBe(value)
    expect(replaceCodeMirrorEditor(root, 'Complete translation')).toBe(true)
    expect(value).toBe('Complete translation')
    expect(replaceRange).toHaveBeenCalledWith(
      'Complete translation',
      { line: 0, ch: 0 },
      { line: 0, ch: '第一句。第二句。那就没必要写正文'.length },
      '+input'
    )
    expect(setCursor).toHaveBeenCalledWith({ line: 0, ch: 'Complete translation'.length })
    expect(save).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
  })

  it('passes CodeMirror reads and replacements through the window bridge', async () => {
    document.body.innerHTML = '<div class="CodeMirror"><textarea></textarea></div>'
    const root = document.querySelector('.CodeMirror') as HTMLDivElement & { CodeMirror?: unknown }
    const proxy = document.querySelector('textarea')!
    let value = '完整输入内容'
    root.CodeMirror = {
      getValue: () => value,
      setValue: (text: string) => { value = text }
    }
    const disposeMainBridge = installInputBoxMainWorldBridge(window, document)
    const editorBridge = createInputBoxEditorBridge(window)

    await expect(editorBridge.read(proxy)).resolves.toBe('完整输入内容')
    await expect(editorBridge.replace(proxy, 'Complete input')).resolves.toBe(true)
    expect(value).toBe('Complete input')

    editorBridge.dispose()
    disposeMainBridge()
  })

  it('tracks instances created with fromTextArea when the wrapper has no editor property', async () => {
    document.body.innerHTML = `
      <textarea id="source"></textarea>
      <div class="CodeMirror"><textarea></textarea></div>
    `
    const source = document.querySelector<HTMLTextAreaElement>('#source')!
    const root = document.querySelector<HTMLDivElement>('.CodeMirror')!
    const proxy = root.querySelector('textarea')!
    let value = '在正式提交之前，你可以点击预览查看完整渲染效果'
    const editor = {
      getValue: vi.fn(() => value),
      setValue: vi.fn((text: string) => { value = text }),
      getWrapperElement: vi.fn(() => root)
    }
    const codeMirrorFactory = {
      fromTextArea: vi.fn((_textarea: HTMLTextAreaElement) => editor)
    }
    const disposeMainBridge = installInputBoxMainWorldBridge(window, document)
    const editorBridge = createInputBoxEditorBridge(window)
    ;(window as Window & { CodeMirror?: typeof codeMirrorFactory }).CodeMirror = codeMirrorFactory
    document.dispatchEvent(new Event('DOMContentLoaded'))
    codeMirrorFactory.fromTextArea(source)

    await expect(editorBridge.read(proxy)).resolves.toBe(value)
    await expect(editorBridge.replace(proxy, 'See the complete rendering before publishing.')).resolves.toBe(true)
    expect(value).toBe('See the complete rendering before publishing.')

    editorBridge.dispose()
    disposeMainBridge()
    delete (window as Window & { CodeMirror?: typeof codeMirrorFactory }).CodeMirror
  })
})
