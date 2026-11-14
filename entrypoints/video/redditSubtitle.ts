const REQUEST_TYPE = 'LOAD_REDDIT_VIDEO_SUBTITLE'
const CDN_ORIGIN = 'https://v.redd.it'
const VIDEO_ID = /^[a-z0-9]{6,20}$/

export interface RedditSubtitleRequest {
    type: typeof REQUEST_TYPE
    videoId: string
    captionUrl?: string
}

export type RedditSubtitleResult =
    | { status: 'ready'; url: string; data: string; language?: string }
    | { status: 'no-track' | 'failed' }

export function isRedditVideoSubtitleHost(hostname: string): boolean {
    return hostname === 'reddit.com' || hostname.endsWith('.reddit.com')
}

export function getRedditVideoId(value: string): string | undefined {
    try {
        const url = new URL(value)
        if (url.origin !== CDN_ORIGIN || url.username || url.password) return
        const id = url.pathname.split('/')[1]
        if (VIDEO_ID.test(id)) return id
    } catch {
        return
    }
}

function isCaptionUrl(value: string, videoId: string): boolean {
    try {
        const url = new URL(value)
        return getRedditVideoId(value) === videoId
            && new RegExp(`^/${videoId}/[a-zA-Z0-9_-]+\\.vtt$`).test(url.pathname)
    } catch {
        return false
    }
}

export function createRedditSubtitleRequest(videoId: string, captionUrl?: string): RedditSubtitleRequest {
    return { type: REQUEST_TYPE, videoId, captionUrl }
}

export function isRedditSubtitleRequest(message: unknown): message is RedditSubtitleRequest {
    if (!message || typeof message !== 'object') return false
    const { type, videoId, captionUrl } = message as RedditSubtitleRequest
    return type === REQUEST_TYPE && typeof videoId === 'string' && VIDEO_ID.test(videoId)
        && (captionUrl === undefined || (typeof captionUrl === 'string' && isCaptionUrl(captionUrl, videoId)))
}

export async function loadRedditSubtitle(
    request: RedditSubtitleRequest,
    fetcher: typeof fetch = fetch,
): Promise<RedditSubtitleResult> {
    if (!isRedditSubtitleRequest(request)) return { status: 'failed' }
    const url = request.captionUrl ?? `${CDN_ORIGIN}/${request.videoId}/wh_ben_en.vtt`
    try {
        const response = await fetcher(url, {
            credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
            signal: AbortSignal.timeout(15_000),
        })
        if (response.status === 404) return { status: 'no-track' }
        if (!response.ok) return { status: 'failed' }
        const data = await response.text()
        if (!data.replace(/^\uFEFF/, '').trimStart().startsWith('WEBVTT')) return { status: 'failed' }
        return {
            status: 'ready', url, data,
            language: new URL(url).pathname.match(/_([a-z]{2,3}(?:-[a-zA-Z0-9]+)?)\.vtt$/)?.[1],
        }
    } catch {
        return { status: 'failed' }
    }
}
