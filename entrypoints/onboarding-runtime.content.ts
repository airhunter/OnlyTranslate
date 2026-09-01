import { mountNewApiComponent, unmountNewApiComponent } from '@/entrypoints/utils/newApi'

type RuntimeWindow = Window & { __onlyTranslateOnboardingRuntime?: boolean }
export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateOnboardingRuntime) return
    runtimeWindow.__onlyTranslateOnboardingRuntime = true
    mountNewApiComponent()
    window.addEventListener('beforeunload', () => {
      unmountNewApiComponent()
      runtimeWindow.__onlyTranslateOnboardingRuntime = false
    }, { once: true })
  }
})
