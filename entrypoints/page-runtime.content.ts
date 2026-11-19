import { configReady } from '@/entrypoints/utils/config'
import { autoTranslateEnglishPage, handleTranslation, restoreOriginalContent, togglePageTranslation } from '@/entrypoints/main/trans'
import { cancelAllTranslations, simulateNextRuntimeUnavailableForDebug } from '@/entrypoints/utils/translateApi'
import type { ContentFeatureActionMessage } from '@/entrypoints/utils/contentFeatureProtocol'
import { consumeManualPageTranslationRequest } from '@/entrypoints/utils/pageTranslateOptOut'

type PageAction =
  | { type: 'translate-at'; x: number; y: number; delay?: number }
  | { type: 'translate-page'; scope?: string; manualToken?: string }
  | { type: 'toggle-page'; manualToken: string }
  | { type: 'restore' }
  | { type: 'debug-runtime-unavailable' }
type RuntimeWindow = Window & { __onlyTranslatePageRuntime?: boolean }

export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  async main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslatePageRuntime) return
    runtimeWindow.__onlyTranslatePageRuntime = true
    await configReady

    const listener = (message: unknown) => {
      const envelope = message as Partial<ContentFeatureActionMessage>
      if (envelope.type !== 'CONTENT_FEATURE_ACTION' || envelope.feature !== 'page') return
      const action = envelope.action as PageAction
      if (action?.type === 'translate-at') handleTranslation(action.x, action.y, action.delay)
      else if (action?.type === 'translate-page') {
        if (action.manualToken === undefined) autoTranslateEnglishPage(action.scope)
        else if (consumeManualPageTranslationRequest(action.manualToken)) autoTranslateEnglishPage(action.scope, true)
      } else if (action?.type === 'toggle-page') {
        if (consumeManualPageTranslationRequest(action.manualToken)) togglePageTranslation(true)
      }
      else if (action?.type === 'restore') restoreOriginalContent()
      else if (action?.type === 'debug-runtime-unavailable') simulateNextRuntimeUnavailableForDebug()
      return { success: true }
    }

    browser.runtime.onMessage.addListener(listener)
    window.addEventListener('beforeunload', () => {
      cancelAllTranslations()
      browser.runtime.onMessage.removeListener(listener)
      runtimeWindow.__onlyTranslatePageRuntime = false
    }, { once: true })
  }
})
