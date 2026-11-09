import { config, configReady } from '@/entrypoints/utils/config'
import {
    isOnlyTranslateYouTubeEmbed,
    isYouTubePlayerMessage,
    YOUTUBE_EMBED_MATCH,
    YOUTUBE_PLAYER_AUTHORIZE,
    YOUTUBE_PLAYER_READY,
} from '@/entrypoints/video/youtubeEmbed'

export default defineContentScript({
    matches: [YOUTUBE_EMBED_MATCH],
    allFrames: true,
    runAt: 'document_end',
    main() {
        if (window.parent === window.top || !isOnlyTranslateYouTubeEmbed(location.href)) return

        // 网络层补发的 Referer 不会出现在 document.referrer 中。
        const extension = new URL(browser.runtime.getURL('/'))
        const playerOrigin = `${extension.protocol}//${extension.host}`
        const authorize = async (event: MessageEvent) => {
            if (!isYouTubePlayerMessage(event, window.parent, playerOrigin, YOUTUBE_PLAYER_AUTHORIZE)) return
            window.removeEventListener('message', authorize)
            await configReady
            if (config.on === false || !config.enableVideoSubtitle) return
            const { initVideoSubtitle } = await import('@/entrypoints/video/manager')
            initVideoSubtitle()
        }
        window.addEventListener('message', authorize)
        window.parent.postMessage(YOUTUBE_PLAYER_READY, playerOrigin)
    },
})
