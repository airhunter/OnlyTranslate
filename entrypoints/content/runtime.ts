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

export interface ContentRuntimeLifecycle { dispose(): void }

export function startContentRuntime(_ctx: ContentScriptContext): ContentRuntimeLifecycle {
  const { request } = createContentFeatureRequester(browser.runtime)
  let disposed = false
  let floatingBallTranslated = false

  const requestFeature = (feature: Parameters<typeof request>[0], action?: unknown) => {
    return request(feature, action).catch(error => {
      console.error(`Failed to load OnlyTranslate ${feature} feature:`, error)
      throw error
    })
  }
  const autoTranslateEnglishPage = (scope?: string) => {
    void requestFeature('page', { type: 'translate-page', scope })
  }
  const restoreOriginalContent = () => { void requestFeature('page', { type: 'restore' }) }
  const handleTranslation = (x: number, y: number, delay?: number) => {
    void requestFeature('page', { type: 'translate-at', x, y, delay })
  }
  const mountFloatingBall = () => {
    void requestFeature('floating', { type: 'mount' })
      .then(() => requestFeature('floating', { type: 'set-state', translated: floatingBallTranslated }))
  }
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

  const pageStateHandler = (event: Event) => {
    floatingBallTranslated = (event as CustomEvent<string>).detail === 'translated'
  }
  document.addEventListener('onlytranslate-page-state-changed', pageStateHandler)

  const selectionActivation = setupSelectionTranslatorActivation({
    document,
    isEnabled: () => config.disableSelectionTranslator !== true && config.selectionTranslatorMode !== 'disabled',
    activate: mountSelectionTranslator
  })
  const manualTranslationTriggers = setupManualTranslationTriggers({
    config, document, window, navigator, handleTranslation, hasActiveTextSelection
  })
  const floatingBallHotkey = setupFloatingBallHotkey({
    config, document, window, navigator, isDev: process.env.NODE_ENV === 'development'
  })
  const pageTranslationLifecycle = setupPageTranslationLifecycle({
    config,
    document,
    runtime: browser.runtime,
    autoTranslateEnglishPage,
    restoreOriginalContent,
    onPageTranslationStateChange: isTranslated => {
      floatingBallTranslated = isTranslated
      void requestFeature('floating', { type: 'set-state', translated: isTranslated })
    }
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
    document.removeEventListener('onlytranslate-page-state-changed', pageStateHandler)
  }
  window.addEventListener('beforeunload', dispose, { once: true })
  return { dispose }
}
