import { configReady } from '@/entrypoints/utils/config'
import { t } from '@/entrypoints/utils/i18n/content'
import {
    isYouTubePlayerMessage,
    isYouTubeVideoId,
    YOUTUBE_EMBED_MARKER,
    YOUTUBE_EMBED_PATH,
    YOUTUBE_EMBED_QUERY,
    YOUTUBE_ORIGIN,
    YOUTUBE_PLAYER_AUTHORIZE,
    YOUTUBE_PLAYER_READY,
} from '@/entrypoints/video/youtubeEmbed'
import { PREPARE_YOUTUBE_EMBED_REQUEST } from '@/entrypoints/video/youtubeEmbedRequest'

// The player is embedded in a website. Keep its script inside the extension
// so Firefox can load it without contacting the local development server.
export default defineUnlistedScript(async () => {
    await configReady
    const id = location.hash.slice(1)
    const status = document.querySelector<HTMLElement>('#player-status')!
    status.textContent = t('video.youtubePlayerLoading')

    try {
        await loadPlayer(id, status)
    } catch {
        status.textContent = t('video.youtubePlayerFailed')
    }
})

async function loadPlayer(id: string, status: HTMLElement) {
    if (!isYouTubeVideoId(id) || window === window.top) throw new Error('Invalid embedded player')
    const requestReady = await browser.runtime.sendMessage({ type: PREPARE_YOUTUBE_EMBED_REQUEST })
    if (!requestReady) throw new Error('Could not prepare embedded player request')

    const frame = document.createElement('iframe')
    frame.src = `${YOUTUBE_EMBED_PATH}${id}${YOUTUBE_EMBED_QUERY}${YOUTUBE_EMBED_MARKER}`
    frame.title = t('video.youtubePlayerTitle')
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'
    frame.allowFullscreen = true
    frame.hidden = true
    frame.style.cssText = 'width:100%;height:100dvh;border:0'

    const onReady = (event: MessageEvent) => {
        if (!isYouTubePlayerMessage(event, frame.contentWindow, YOUTUBE_ORIGIN, YOUTUBE_PLAYER_READY)) return
        window.clearTimeout(timeout)
        window.removeEventListener('message', onReady)
        frame.contentWindow?.postMessage(YOUTUBE_PLAYER_AUTHORIZE, YOUTUBE_ORIGIN)
        status.remove()
        frame.hidden = false
        frame.style.display = 'block'
    }
    const timeout = window.setTimeout(() => {
        window.removeEventListener('message', onReady)
        frame.remove()
        status.textContent = t('video.youtubePlayerFailed')
    }, 15_000)
    window.addEventListener('message', onReady)
    document.body.append(frame)
}
