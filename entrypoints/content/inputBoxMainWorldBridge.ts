import {
  INPUT_BOX_EDITOR_ATTRIBUTE,
  INPUT_BOX_EDITOR_REQUEST,
  INPUT_BOX_EDITOR_RESPONSE
} from './inputBoxEditorBridge'

interface CodeMirrorDocumentLike {
  firstLine?: () => number
  lastLine?: () => number
  getLine?: (line: number) => string
  getValue?: () => string
  replaceRange?: (text: string, from: { line: number; ch: number }, to: { line: number; ch: number }, origin?: string) => void
  setCursor?: (position: { line: number; ch: number }) => void
  setValue?: (text: string) => void
}

interface CodeMirrorLike extends CodeMirrorDocumentLike {
  focus?: () => void
  getDoc?: () => CodeMirrorDocumentLike
  getWrapperElement?: () => HTMLElement
  save?: () => void
}

interface CodeMirrorFactoryLike {
  fromTextArea?: (textarea: HTMLTextAreaElement, options?: unknown) => CodeMirrorLike
}

type CodeMirrorResolver = (root: HTMLElement) => CodeMirrorLike | null

function getCodeMirrorFromElement(root: HTMLElement): CodeMirrorLike | null {
  const editor = (root as HTMLElement & { CodeMirror?: CodeMirrorLike }).CodeMirror
  return editor && typeof editor === 'object' ? editor : null
}

function createCodeMirrorResolver(
  targetWindow: Window,
  targetDocument: Document
): { resolve: CodeMirrorResolver; dispose: () => void } {
  const editors = new WeakMap<HTMLElement, CodeMirrorLike>()
  let patchedFactory: CodeMirrorFactoryLike | null = null
  let originalFromTextArea: CodeMirrorFactoryLike['fromTextArea'] | null = null

  const register = (editor: CodeMirrorLike): void => {
    const wrapper = editor.getWrapperElement?.()
    if (wrapper) editors.set(wrapper, editor)
  }

  const patchFactory = (): void => {
    const factory = (targetWindow as Window & { CodeMirror?: CodeMirrorFactoryLike }).CodeMirror
    const fromTextArea = factory?.fromTextArea
    if (!factory || typeof fromTextArea !== 'function' || factory === patchedFactory) return

    originalFromTextArea = fromTextArea
    factory.fromTextArea = function patchedFromTextArea(textarea, options) {
      const editor = fromTextArea.call(this, textarea, options)
      register(editor)
      return editor
    }
    patchedFactory = factory
  }

  // CodeMirror is normally loaded after document_start. This capture listener
  // patches the factory before the page creates its editor on DOMContentLoaded.
  patchFactory()
  targetDocument.addEventListener('DOMContentLoaded', patchFactory, true)

  return {
    resolve(root) {
      return getCodeMirrorFromElement(root) ?? editors.get(root) ?? null
    },
    dispose() {
      targetDocument.removeEventListener('DOMContentLoaded', patchFactory, true)
      if (patchedFactory && originalFromTextArea && patchedFactory.fromTextArea !== originalFromTextArea) {
        patchedFactory.fromTextArea = originalFromTextArea
      }
      patchedFactory = null
      originalFromTextArea = null
    }
  }
}

export function readCodeMirrorEditor(
  root: HTMLElement,
  resolveEditor: CodeMirrorResolver = getCodeMirrorFromElement
): string | null {
  const editor = resolveEditor(root)
  const doc = editor?.getDoc?.() ?? editor
  if (!doc || typeof doc.getValue !== 'function') return null
  return doc.getValue()
}

export function replaceCodeMirrorEditor(
  root: HTMLElement,
  text: string,
  resolveEditor: CodeMirrorResolver = getCodeMirrorFromElement
): boolean {
  const editor = resolveEditor(root)
  const doc = editor?.getDoc?.() ?? editor
  if (!editor || !doc) return false

  if (
    typeof doc.replaceRange === 'function'
    && typeof doc.firstLine === 'function'
    && typeof doc.lastLine === 'function'
    && typeof doc.getLine === 'function'
  ) {
    const firstLine = doc.firstLine()
    const lastLine = doc.lastLine()
    const end = { line: lastLine, ch: doc.getLine(lastLine).length }
    doc.replaceRange(text, { line: firstLine, ch: 0 }, end, '+input')
  } else if (typeof doc.setValue === 'function') {
    doc.setValue(text)
  } else {
    return false
  }

  const lines = text.split('\n')
  doc.setCursor?.({ line: lines.length - 1, ch: lines.at(-1)?.length ?? 0 })
  editor.save?.()
  editor.focus?.()
  return true
}

export function installInputBoxMainWorldBridge(targetWindow: Window, targetDocument: Document): () => void {
  const codeMirrorResolver = createCodeMirrorResolver(targetWindow, targetDocument)
  const requestHandler = (event: MessageEvent) => {
    const data = event.data
    if (
      !data
      || data.channel !== INPUT_BOX_EDITOR_REQUEST
      || typeof data.requestId !== 'string'
      || typeof data.editorId !== 'string'
    ) {
      return
    }

    const root = targetDocument.querySelector<HTMLElement>(
      `[${INPUT_BOX_EDITOR_ATTRIBUTE}="${data.editorId}"]`
    )
    let success = false
    let text: string | undefined

    if (root && data.action === 'read') {
      const editorText = readCodeMirrorEditor(root, codeMirrorResolver.resolve)
      success = editorText !== null
      text = editorText ?? undefined
    } else if (root && data.action === 'replace' && typeof data.text === 'string') {
      success = replaceCodeMirrorEditor(root, data.text, codeMirrorResolver.resolve)
    }

    targetWindow.postMessage({
      channel: INPUT_BOX_EDITOR_RESPONSE,
      requestId: data.requestId,
      success,
      text
    }, '*')
  }

  targetWindow.addEventListener('message', requestHandler)
  return () => {
    targetWindow.removeEventListener('message', requestHandler)
    codeMirrorResolver.dispose()
  }
}
