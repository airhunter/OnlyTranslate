export type ReaderKeyboardAction = 'previous' | 'next' | 'page-up' | 'page-down'

const READER_SHORTCUT_BLOCKING_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="slider"]',
].join(', ')

export function resolveReaderKeyboardAction(event: KeyboardEvent): ReaderKeyboardAction | undefined {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return undefined

  const eventTarget = event.target as (EventTarget & {
    closest?: (selector: string) => Element | null
    nodeType?: number
    ownerDocument?: Document | null
  }) | null
  if (eventTarget?.closest?.(READER_SHORTCUT_BLOCKING_SELECTOR)) return undefined

  const targetDocument = eventTarget?.nodeType === 9
    ? eventTarget as unknown as Document
    : eventTarget?.ownerDocument ?? undefined
  const selection = targetDocument?.getSelection()
  if (selection && !selection.isCollapsed) return undefined

  if (event.key === 'ArrowLeft' && !event.shiftKey && !event.repeat) return 'previous'
  if (event.key === 'ArrowRight' && !event.shiftKey && !event.repeat) return 'next'
  if (event.key === 'PageUp' && !event.shiftKey) return 'page-up'
  if (event.key === 'PageDown' && !event.shiftKey) return 'page-down'
  if (event.key === ' ') return event.shiftKey ? 'page-up' : 'page-down'
  return undefined
}
