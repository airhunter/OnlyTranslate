import { config, configReady } from '@/entrypoints/utils/config'
import { initializeSelectionTranslator, mountSelectionTranslator, unmountSelectionTranslator } from '@/entrypoints/utils/selectionTranslator'
import type { ContentFeatureActionMessage } from '@/entrypoints/utils/contentFeatureProtocol'

type SelectionAction = { type: 'mount' | 'unmount' }
type RuntimeWindow = Window & { __onlyTranslateSelectionRuntime?: boolean }

export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  async main(ctx) {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateSelectionRuntime) return
    runtimeWindow.__onlyTranslateSelectionRuntime = true
    await configReady
    initializeSelectionTranslator(ctx)

    const listener = (message: unknown) => {
      const envelope = message as Partial<ContentFeatureActionMessage>
      if (envelope.type !== 'CONTENT_FEATURE_ACTION' || envelope.feature !== 'selection') return
      const action = envelope.action as SelectionAction
      if (action?.type === 'mount') void mountSelectionTranslator()
      if (action?.type === 'unmount') unmountSelectionTranslator()
      return { success: true }
    }
    browser.runtime.onMessage.addListener(listener)
    if (config.disableSelectionTranslator !== true && config.selectionTranslatorMode !== 'disabled') await mountSelectionTranslator()
    window.addEventListener('beforeunload', () => {
      unmountSelectionTranslator()
      browser.runtime.onMessage.removeListener(listener)
      runtimeWindow.__onlyTranslateSelectionRuntime = false
    }, { once: true })
  }
})
