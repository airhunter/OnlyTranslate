export const INPUT_BOX_EDITOR_ATTRIBUTE = 'data-onlytranslate-input-editor'
export const INPUT_BOX_EDITOR_REQUEST = 'onlytranslate:input-editor-request'
export const INPUT_BOX_EDITOR_RESPONSE = 'onlytranslate:input-editor-response'

type EditorAction = 'read' | 'replace'

interface EditorBridgeResult {
  success: boolean
  text?: string
}

interface PendingEditorRequest {
  resolve: (result: EditorBridgeResult) => void
  timeoutId: number
}

export interface InputBoxEditorBridge {
  read: (element: HTMLElement) => Promise<string | null>
  replace: (element: HTMLElement, text: string) => Promise<boolean>
  dispose: () => void
}

export function findCodeMirrorRoot(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null
  const root = element.closest<HTMLElement>('.CodeMirror')
  if (!root || !root.querySelector('textarea')) return null
  return root
}

export function createInputBoxEditorBridge(targetWindow: Window): InputBoxEditorBridge {
  let requestSequence = 0
  const pendingRequests = new Map<string, PendingEditorRequest>()
  const markedEditors = new Set<HTMLElement>()

  const responseHandler = (event: MessageEvent) => {
    const data = event.data
    if (!data || data.channel !== INPUT_BOX_EDITOR_RESPONSE || typeof data.requestId !== 'string') return

    const pending = pendingRequests.get(data.requestId)
    if (!pending) return
    targetWindow.clearTimeout(pending.timeoutId)
    pendingRequests.delete(data.requestId)
    pending.resolve({
      success: data.success === true,
      text: typeof data.text === 'string' ? data.text : undefined
    })
  }

  targetWindow.addEventListener('message', responseHandler)

  const request = (
    root: HTMLElement,
    action: EditorAction,
    text?: string
  ): Promise<EditorBridgeResult> => {
    let editorId = root.getAttribute(INPUT_BOX_EDITOR_ATTRIBUTE)
    if (!editorId) {
      requestSequence += 1
      editorId = `${Date.now().toString(36)}-${requestSequence.toString(36)}`
      root.setAttribute(INPUT_BOX_EDITOR_ATTRIBUTE, editorId)
      markedEditors.add(root)
    }

    const requestId = `${editorId}-${action}-${++requestSequence}`
    return new Promise(resolve => {
      const timeoutId = targetWindow.setTimeout(() => {
        pendingRequests.delete(requestId)
        resolve({ success: false })
      }, 800)

      pendingRequests.set(requestId, { resolve, timeoutId })
      targetWindow.postMessage({
        channel: INPUT_BOX_EDITOR_REQUEST,
        requestId,
        editorId,
        action,
        text
      }, '*')
    })
  }

  return {
    async read(element) {
      const root = findCodeMirrorRoot(element)
      if (!root) return null
      const result = await request(root, 'read')
      return result.success ? result.text ?? '' : null
    },
    async replace(element, text) {
      const root = findCodeMirrorRoot(element)
      if (!root) return false
      return (await request(root, 'replace', text)).success
    },
    dispose() {
      targetWindow.removeEventListener('message', responseHandler)
      pendingRequests.forEach(({ resolve, timeoutId }) => {
        targetWindow.clearTimeout(timeoutId)
        resolve({ success: false })
      })
      pendingRequests.clear()
      markedEditors.forEach(root => root.removeAttribute(INPUT_BOX_EDITOR_ATTRIBUTE))
      markedEditors.clear()
    }
  }
}
