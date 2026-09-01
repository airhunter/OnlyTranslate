import { hasActiveTextSelection } from '@/entrypoints/utils/selection'

export interface SelectionTranslatorActivationOptions {
  document: Document
  isEnabled: () => boolean
  activate: () => Promise<void>
  hasSelection?: () => boolean
}

export interface SelectionTranslatorActivationLifecycle {
  dispose(): void
}

export function setupSelectionTranslatorActivation(
  options: SelectionTranslatorActivationOptions
): SelectionTranslatorActivationLifecycle {
  let disposed = false
  let activating = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    options.document.removeEventListener('mouseup', handlePotentialSelection)
    options.document.removeEventListener('selectionchange', handlePotentialSelection)
  }

  const handlePotentialSelection = () => {
    if (disposed || activating || !options.isEnabled()) return
    if (!(options.hasSelection ?? hasActiveTextSelection)()) return

    activating = true
    void options.activate()
      .then(() => {
        dispose()
        options.document.dispatchEvent(new Event('selectionchange'))
      })
      .catch(error => {
        activating = false
        console.error('Failed to activate selection translator:', error)
      })
  }

  options.document.addEventListener('mouseup', handlePotentialSelection)
  options.document.addEventListener('selectionchange', handlePotentialSelection)

  return { dispose }
}
