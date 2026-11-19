import { config, configReady } from '@/entrypoints/utils/config'
import { configureFloatingBallTranslationActions, mountFloatingBall, setFloatingBallTranslationState, unmountFloatingBall } from '@/entrypoints/utils/floatingBall'
import { createContentFeatureRequester } from '@/entrypoints/content/contentFeatureRequester'
import type { ContentFeatureActionMessage } from '@/entrypoints/utils/contentFeatureProtocol'

import { PAGE_TRANSLATION_STATUS_EVENT, publishPageTranslationStatus, readPageTranslationStatus } from '@/entrypoints/utils/pageTranslationStatus'
import { captureManualPageTranslationRequest } from '@/entrypoints/utils/pageTranslateOptOut'

type FloatingAction = { type: 'mount' | 'unmount' }
type RuntimeWindow = Window & { __onlyTranslateFloatingRuntime?: boolean }

export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  async main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateFloatingRuntime) return
    runtimeWindow.__onlyTranslateFloatingRuntime = true
    await configReady

    const { request } = createContentFeatureRequester(browser.runtime)
    configureFloatingBallTranslationActions({
      togglePageTranslation: () => {
        const manualToken = captureManualPageTranslationRequest()
        void request('page', { type: 'toggle-page', manualToken }).catch(() =>
          publishPageTranslationStatus({ phase: 'failed', source: 'manual' }))
      }
    })

    const listener = (message: unknown) => {
      const envelope = message as Partial<ContentFeatureActionMessage>
      if (envelope.type !== 'CONTENT_FEATURE_ACTION' || envelope.feature !== 'floating') return
      const action = envelope.action as FloatingAction
      if (action?.type === 'mount') mountFloatingBall()
      if (action?.type === 'unmount') unmountFloatingBall()
      return { success: true }
    }
    const pageStateHandler = () => setFloatingBallTranslationState(readPageTranslationStatus())

    browser.runtime.onMessage.addListener(listener)
    document.addEventListener(PAGE_TRANSLATION_STATUS_EVENT, pageStateHandler)
    if (config.disableFloatingBall !== true) mountFloatingBall()
    window.addEventListener('beforeunload', () => {
      unmountFloatingBall()
      browser.runtime.onMessage.removeListener(listener)
      document.removeEventListener(PAGE_TRANSLATION_STATUS_EVENT, pageStateHandler)
      runtimeWindow.__onlyTranslateFloatingRuntime = false
    }, { once: true })
  }
})
