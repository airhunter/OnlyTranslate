import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupSelectionTranslatorActivation } from '@/entrypoints/content/selectionTranslatorActivation'

describe('selection translator activation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not load the translator before an eligible selection exists', () => {
    const activate = vi.fn(async () => {})
    const lifecycle = setupSelectionTranslatorActivation({
      document,
      isEnabled: () => true,
      activate,
      hasSelection: () => false
    })

    document.dispatchEvent(new Event('selectionchange'))
    document.dispatchEvent(new MouseEvent('mouseup'))

    expect(activate).not.toHaveBeenCalled()
    lifecycle.dispose()
  })

  it('loads once on the first eligible selection and replays selectionchange', async () => {
    const activate = vi.fn(async () => {})
    const replayed = vi.fn()
    const lifecycle = setupSelectionTranslatorActivation({
      document,
      isEnabled: () => true,
      activate,
      hasSelection: () => true
    })
    document.addEventListener('selectionchange', replayed)

    document.dispatchEvent(new MouseEvent('mouseup'))
    await Promise.resolve()
    await Promise.resolve()
    document.dispatchEvent(new MouseEvent('mouseup'))

    expect(activate).toHaveBeenCalledTimes(1)
    expect(replayed).toHaveBeenCalledTimes(1)
    lifecycle.dispose()
    document.removeEventListener('selectionchange', replayed)
  })

  it('keeps the module unloaded while the feature is disabled', () => {
    const activate = vi.fn(async () => {})
    const lifecycle = setupSelectionTranslatorActivation({
      document,
      isEnabled: () => false,
      activate,
      hasSelection: () => true
    })

    document.dispatchEvent(new Event('selectionchange'))

    expect(activate).not.toHaveBeenCalled()
    lifecycle.dispose()
  })
})
