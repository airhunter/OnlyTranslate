export const YOUTUBE_ORIGIN = 'https://www.youtube.com'
export const YOUTUBE_EMBED_PATH = `${YOUTUBE_ORIGIN}/embed/`
export const YOUTUBE_EMBED_QUERY = '?autoplay=1&mute=1&onlytranslate_player=1'
export const YOUTUBE_EMBED_MARKER = '#onlytranslate-player'
export const YOUTUBE_EMBED_MATCH = `${YOUTUBE_EMBED_PATH}*`
export const YOUTUBE_PLAYER_PAGE = '/youtube-player.html'
export const YOUTUBE_PLAYER_READY = 'onlytranslate-youtube-player-ready'
export const YOUTUBE_PLAYER_AUTHORIZE = 'onlytranslate-youtube-player-authorize'
const VIDEO_ID = /^[\w-]{11}$/

export function isYouTubeVideoId(value: string): boolean {
    return VIDEO_ID.test(value)
}

export function getYouTubeVideoId(value: string): string | null {
    if (!URL.canParse(value)) return null
    let url = new URL(value)
    if (url.origin === 'https://l.threads.com') {
        const target = url.searchParams.get('u')
        if (!target || !URL.canParse(target)) return null
        url = new URL(target)
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null

    let id: string | null = null
    if (url.hostname === 'youtu.be') {
        id = url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1] ?? null
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
        id = url.pathname === '/watch'
            ? url.searchParams.get('v')
            : url.pathname.match(/^\/(?:live|shorts|embed)\/([\w-]{11})\/?$/)?.[1] ?? null
    }
    return id && isYouTubeVideoId(id) ? id : null
}

export function getYouTubeCardVideoId(anchor: HTMLAnchorElement): string | null {
    return getYouTubeVideoId(anchor.href)
        ?? (anchor.href.startsWith('https://t.co/') ? getYouTubeVideoId(anchor.title) : null)
}

export function isOnlyTranslateYouTubeEmbed(url: string): boolean {
    if (!URL.canParse(url)) return false
    const player = new URL(url)
    return player.origin === YOUTUBE_ORIGIN
        && /^\/embed\/[\w-]{11}$/.test(player.pathname)
        && player.search === YOUTUBE_EMBED_QUERY
        && player.hash === YOUTUBE_EMBED_MARKER
}

export function isYouTubePlayerMessage(event: MessageEvent, source: Window | null, origin: string, data: string): boolean {
    return source !== null && event.source === source && event.origin === origin && event.data === data
}
