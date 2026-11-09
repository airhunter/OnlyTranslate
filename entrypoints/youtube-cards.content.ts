import { config, configReady } from '@/entrypoints/utils/config'
import { mountYouTubeCards } from '@/entrypoints/video/youtubeCards'

export default defineContentScript({
    matches: ['https://x.com/*', 'https://twitter.com/*', 'https://threads.com/*', 'https://www.threads.com/*'],
    runAt: 'document_end',
    async main() {
        await configReady
        if (config.on !== false && config.enableVideoSubtitle) mountYouTubeCards()
    },
})
