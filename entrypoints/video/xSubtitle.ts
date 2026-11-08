const REQUEST_TYPE = 'LOAD_X_VIDEO_SUBTITLE'
const CDN_ORIGIN = 'https://video.twimg.com'
const MEDIA_KEY = /^(?:amplify_video|ext_tw_video)\/\d+$/
const MASTER_PATH = /\/pl\/[^/]+\.m3u8$/

export interface XSubtitleRequest {
    type: typeof REQUEST_TYPE
    postId?: string
    mediaKey?: string
    masterUrl?: string
}

export type XSubtitleResult =
    | { status: 'ready'; url: string; data: string; language?: string }
    | { status: 'no-track' | 'failed' }

export function isXVideoSubtitleHost(hostname: string): boolean {
    return ['x.com', 'twitter.com', 'teapaw.org', 'teapawt.org']
        .some(host => hostname === host || hostname.endsWith(`.${host}`))
}

export function getXMediaKey(value: string): string | undefined {
    try {
        const url = new URL(value)
        if (url.origin !== CDN_ORIGIN && url.origin !== 'https://pbs.twimg.com') return
        const match = url.pathname.match(/^\/(?:subtitles\/)?(amplify_video|ext_tw_video)(?:_thumb)?\/(\d+)\//)
        if (match) return `${match[1]}/${match[2]}`
    } catch {
        return
    }
}

export function getXMasterUrl(value: string, mediaKey: string): string | undefined {
    try {
        const url = new URL(value)
        if (url.origin === CDN_ORIGIN && getXMediaKey(url.href) === mediaKey
            && MASTER_PATH.test(url.pathname)) return url.href
    } catch {
        return
    }
}

export function createXSubtitleRequest(postId?: string, mediaKey?: string, masterUrl?: string): XSubtitleRequest {
    return { type: REQUEST_TYPE, postId, mediaKey, masterUrl }
}

export function isXSubtitleRequest(message: unknown): message is XSubtitleRequest {
    if (!message || typeof message !== 'object') return false
    const { type, postId, mediaKey, masterUrl } = message as XSubtitleRequest
    return type === REQUEST_TYPE
        && (postId === undefined || (typeof postId === 'string' && /^\d{1,20}$/.test(postId)))
        && (mediaKey === undefined || (typeof mediaKey === 'string' && MEDIA_KEY.test(mediaKey)))
        && (masterUrl === undefined || (typeof masterUrl === 'string' && !!mediaKey && !!getXMasterUrl(masterUrl, mediaKey)))
}

interface XMediaVariant {
    url?: string
}

interface XPublicPost {
    id_str?: string
    mediaDetails?: Array<{ type?: string; video_info?: { variants?: XMediaVariant[] } }>
    video?: { variants?: Array<{ src?: string }> }
}

function findMasterInPost(post: XPublicPost, postId: string, mediaKey?: string): string | undefined {
    if (post.id_str !== postId) throw new Error('Unexpected X post metadata')
    const videos = Array.isArray(post.mediaDetails) ? post.mediaDetails.filter(media => media?.type === 'video') : []
    const variants = videos.length
        ? videos.flatMap(media => Array.isArray(media.video_info?.variants)
            ? media.video_info.variants.map(variant => variant?.url) : [])
        : Array.isArray(post.video?.variants) ? post.video.variants.map(variant => variant?.src) : []
    const masters = new Set<string>()
    for (const variant of variants) {
        if (typeof variant !== 'string') continue
        const key = getXMediaKey(variant)
        if (!key || (mediaKey && mediaKey !== key)) continue
        const master = getXMasterUrl(variant, key)
        if (master) masters.add(master)
    }
    if (masters.size === 1 && (mediaKey || videos.length <= 1)) return masters.values().next().value
}

function readPlaylist(text: string): string[] {
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines[0] !== '#EXTM3U') throw new Error('Invalid X subtitle playlist')
    return lines
}

function findSubtitleTrack(lines: string[]) {
    const tracks = lines.filter(line => line.startsWith('#EXT-X-MEDIA:')).flatMap(line => {
        const attributes = new Map(Array.from(line.matchAll(/([A-Z-]+)=("([^"]*)"|[^,]*)/g),
            match => [match[1], match[3] ?? match[2]]))
        const uri = attributes.get('URI')
        if (attributes.get('TYPE') !== 'SUBTITLES' || attributes.get('FORCED') === 'YES' || !uri) return []
        return [{
            uri,
            language: attributes.get('LANGUAGE'),
            isDefault: attributes.get('DEFAULT') === 'YES',
            automatic: attributes.get('CHARACTERISTICS')?.split(',').includes('twitter.auto-generated'),
        }]
    })
    return tracks.find(track => track.isDefault)
        ?? tracks.find(track => !track.automatic)
        ?? tracks[0]
}

function resolveSubtitleUrl(value: string, base: string, mediaKey: string, extension: 'm3u8' | 'vtt'): string {
    const url = new URL(value, base)
    if (url.origin !== CDN_ORIGIN || getXMediaKey(url.href) !== mediaKey
        || !url.pathname.endsWith(`.${extension}`)) throw new Error('Unexpected X subtitle URL')
    return url.href
}

export async function loadXSubtitle(
    request: XSubtitleRequest,
    fetcher: typeof fetch = fetch,
): Promise<XSubtitleResult> {
    const options: RequestInit = {
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
        signal: AbortSignal.timeout(15_000),
    }
    const read = async (url: string) => {
        const response = await fetcher(url, options)
        if (!response.ok) throw new Error(`X subtitle resource returned ${response.status}`)
        return response.text()
    }

    try {
        let master = request.masterUrl
        if (!master && request.postId) {
            // X's public embed endpoint uses a token derived from the post ID.
            const token = ((Number(request.postId) / 1e15) * Math.PI).toString(36).replace(/0|\./g, '')
            const endpoint = new URL('https://cdn.syndication.twimg.com/tweet-result')
            endpoint.search = new URLSearchParams({ id: request.postId, token }).toString()
            const post = JSON.parse(await read(endpoint.href)) as XPublicPost
            master = findMasterInPost(post, request.postId, request.mediaKey)
        }
        const mediaKey = master && getXMediaKey(master)
        if (!master || !mediaKey) return { status: 'no-track' }

        const track = findSubtitleTrack(readPlaylist(await read(master)))
        if (!track) return { status: 'no-track' }
        const playlist = resolveSubtitleUrl(track.uri, master, mediaKey, 'm3u8')
        const files = [...new Set(readPlaylist(await read(playlist)).filter(line => !line.startsWith('#'))
            .map(line => resolveSubtitleUrl(line, playlist, mediaKey, 'vtt')))]
        if (!files.length) return { status: 'no-track' }

        const fragments: string[] = []
        for (let i = 0; i < files.length; i += 4) {
            fragments.push(...await Promise.all(files.slice(i, i + 4).map(async url => {
                const vtt = await read(url)
                if (!vtt.trimStart().startsWith('WEBVTT')) throw new Error('Invalid X WebVTT')
                return vtt
            })))
        }
        return {
            status: 'ready',
            url: files.length === 1 ? files[0] : playlist,
            data: fragments.join('\n\n'),
            language: track.language,
        }
    } catch {
        return { status: 'failed' }
    }
}
