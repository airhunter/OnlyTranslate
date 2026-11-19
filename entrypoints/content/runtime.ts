import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { config, onConfigChange } from '@/entrypoints/utils/config'
import { hasActiveTextSelection } from '@/entrypoints/utils/selection'
import { setupPageTranslationLifecycle } from './translationLifecycle'
import { setupFloatingBallHotkey } from './floatingBallHotkey'
import { setupManualTranslationTriggers } from './manualTranslationTriggers'
import { setupContentRuntimeControls } from './contentControls'
import { setupContentUiMounting } from './contentUiMounting'
import { setupSelectionTranslatorActivation } from './selectionTranslatorActivation'
import { isSupportedVideoSubtitleHost } from './videoSubtitleSetup'
import { cleanPageTranslationCache, cleanPageTranslationCacheIfNeeded } from './contentCacheMaintenance'
import { createContentFeatureRequester } from './contentFeatureRequester'
import { publishPageTranslationStatus, readPageTranslationStatus } from '@/entrypoints/utils/pageTranslationStatus'
import { resolvePdfDocumentSource } from '@/entrypoints/pdf/url'
import { captureManualPageTranslationRequest } from '@/entrypoints/utils/pageTranslateOptOut'

export interface ContentRuntimeLifecycle { dispose(): void }

export function startContentRuntime(_ctx: ContentScriptContext): ContentRuntimeLifecycle {
  const { request } = createContentFeatureRequester(browser.runtime)
  let disposed = false

  const requestFeature = (feature: Parameters<typeof request>[0], action?: unknown) => {
    return request(feature, action).catch(error => {
      console.error(`Failed to load OnlyTranslate ${feature} feature:`, error)
      throw error
    })
  }
  const requestPageTranslation = (action: unknown, manual: boolean) => {
    void requestFeature('page', action).catch(() =>
      publishPageTranslationStatus({ phase: 'failed', source: manual ? 'manual' : 'auto' }))
  }
  const autoTranslateEnglishPage = (scope?: string, manual = false) => {
    const manualToken = manual ? captureManualPageTranslationRequest() : undefined
    requestPageTranslation({ type: 'translate-page', scope, manualToken }, manual)
  }
  const restoreOriginalContent = () => { void requestFeature('page', { type: 'restore' }) }
  const handleTranslation = (x: number, y: number, delay?: number) => {
    void requestFeature('page', { type: 'translate-at', x, y, delay })
  }
  const mountFloatingBall = () => { void requestFeature('floating', { type: 'mount' }) }
  const unmountFloatingBall = () => { void requestFeature('floating', { type: 'unmount' }) }
  const mountSelectionTranslator = async () => {
    await requestFeature('selection', { type: 'mount' })
  }
  const unmountSelectionTranslator = () => { void requestFeature('selection', { type: 'unmount' }) }

  if (process.env.NODE_ENV === 'development') {
    const simulateRuntimeUnavailable = () => {
      void requestFeature('page', { type: 'debug-runtime-unavailable' })
    }
    document.addEventListener('onlytranslate-debug-runtime-unavailable', simulateRuntimeUnavailable)
    window.addEventListener('beforeunload', () => {
      document.removeEventListener('onlytranslate-debug-runtime-unavailable', simulateRuntimeUnavailable)
    }, { once: true })
  }


  const selectionActivation = setupSelectionTranslatorActivation({
    document,
    isEnabled: () => config.disableSelectionTranslator !== true && config.selectionTranslatorMode !== 'disabled',
    activate: mountSelectionTranslator
  })
  const manualTranslationTriggers = setupManualTranslationTriggers({
    config, document, window, navigator, handleTranslation, hasActiveTextSelection
  })
  const floatingBallHotkey = setupFloatingBallHotkey({
    config, document, window, navigator, isDev: process.env.NODE_ENV === 'development',
    dispatchToggleEvent: () => {
      const pdf = config.disableFloatingBall !== true
        && resolvePdfDocumentSource(window.location.href, document.contentType)
      if (pdf) void browser.runtime.sendMessage({ type: 'openPdfReader', sourceUrl: pdf })
      else requestPageTranslation({ type: 'toggle-page', manualToken: captureManualPageTranslationRequest() }, true)
    }
  })
  const pageTranslationLifecycle = setupPageTranslationLifecycle({
    config,
    runtime: browser.runtime,
    autoTranslateEnglishPage,
    restoreOriginalContent,
    getPageTranslationStatus: readPageTranslationStatus
  })
  const contentUiMounting = setupContentUiMounting({
    document,
    window,
    mount: () => {
      if (config.disableFloatingBall !== true) mountFloatingBall()
      void requestFeature('onboarding')
    }
  })

  if (isSupportedVideoSubtitleHost(location.hostname)) void requestFeature('video')
  if (config.inputBoxTranslationTrigger !== 'disabled') void requestFeature('input')
  cleanPageTranslationCacheIfNeeded()

  const stopWatchingConfig = onConfigChange(nextConfig => {
    if (nextConfig.inputBoxTranslationTrigger !== 'disabled') void requestFeature('input')
  })
  const runtimeControls = setupContentRuntimeControls({
    runtime: browser.runtime,
    config,
    document,
    cache: { clean: cleanPageTranslationCache },
    mountFloatingBall,
    unmountFloatingBall,
    mountSelectionTranslator: () => { void mountSelectionTranslator() },
    unmountSelectionTranslator
  })

  const dispose = () => {
    if (disposed) return
    disposed = true
    stopWatchingConfig()
    runtimeControls.dispose()
    contentUiMounting.dispose()
    pageTranslationLifecycle.dispose()
    floatingBallHotkey.dispose()
    manualTranslationTriggers.dispose()
    selectionActivation.dispose()
  }
  window.addEventListener('beforeunload', dispose, { once: true })
  return { dispose }
}
