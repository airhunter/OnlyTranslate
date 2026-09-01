import { config, configReady } from '@/entrypoints/utils/config'
import { setupInputBoxTranslation } from '@/entrypoints/content/inputBoxTranslation'
import { t } from '@/entrypoints/utils/i18n/content'

type RuntimeWindow = Window & { __onlyTranslateInputRuntime?: boolean }
export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  async main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateInputRuntime) return
    runtimeWindow.__onlyTranslateInputRuntime = true
    await configReady
    if (config.inputBoxTranslationTrigger === 'disabled') {
      runtimeWindow.__onlyTranslateInputRuntime = false
      return
    }
    const lifecycle = setupInputBoxTranslation({ config, document, window, runtime: browser.runtime, t })
    window.addEventListener('beforeunload', () => {
      lifecycle.dispose()
      runtimeWindow.__onlyTranslateInputRuntime = false
    }, { once: true })
  }
})
