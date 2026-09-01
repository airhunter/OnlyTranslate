import { configReady } from '@/entrypoints/utils/config'
import { initVideoSubtitle } from '@/entrypoints/video/manager'
import { isSupportedVideoSubtitleHost } from '@/entrypoints/content/videoSubtitleSetup'

type RuntimeWindow = Window & { __onlyTranslateVideoRuntime?: boolean }
export default defineContentScript({
  registration: 'runtime',
  matches: ['*://*.youtube.com/*', '*://*.youtubekids.com/*', '*://*.udemy.com/*', '*://*.coursera.org/*', '*://*.khanacademy.org/*'],
  runAt: 'document_end',
  async main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateVideoRuntime || !isSupportedVideoSubtitleHost(location.hostname)) return
    runtimeWindow.__onlyTranslateVideoRuntime = true
    await configReady
    initVideoSubtitle()
  }
})
