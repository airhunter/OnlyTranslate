import { createRedditSubtitleRequest, getRedditVideoId } from './redditSubtitle'

function getPlayer(video: HTMLVideoElement): HTMLElement | null {
    const root = video.getRootNode()
    if (root instanceof ShadowRoot) {
        // The real player is a direct child of shreddit-player's open shadow root.
        // Seek thumbnails live in a different, nested shadow root and must be ignored.
        return root.host.matches('shreddit-player') ? root.host as HTMLElement : null
    }
    return video.closest<HTMLElement>('shreddit-player, [data-mpd-url], [data-hls-url]')
}

export function getRedditVideoContext(video: HTMLVideoElement) {
    const player = getPlayer(video)
    if (video.getRootNode() instanceof ShadowRoot && !player) return
    const sources = [
        player?.getAttribute('src'), player?.getAttribute('data-mpd-url'), player?.getAttribute('data-hls-url'),
        video.src, video.currentSrc, video.querySelector<HTMLSourceElement>('source[src]')?.src,
    ]
    const videoId = sources.map(value => value ? getRedditVideoId(value) : undefined).find(Boolean)
    if (!videoId) return
    const captionUrl = player?.getAttribute('caption-url') || undefined
    return { videoId, captionUrl, postId: player?.getAttribute('post-id')?.replace(/^t3_/, '') }
}

export function getRedditVideoContextKey(video: HTMLVideoElement): string {
    const context = getRedditVideoContext(video)
    return context ? `${context.postId ?? ''}|${context.videoId}|${context.captionUrl ?? ''}` : ''
}

export function getRedditVideoRequest(video: HTMLVideoElement) {
    const context = getRedditVideoContext(video)
    return context ? createRedditSubtitleRequest(context.videoId, context.captionUrl) : undefined
}

export function isRedditVideoForCurrentPost(video: HTMLVideoElement): boolean {
    const postId = location.pathname.match(/\/(?:comments|mediaembed)\/([a-z0-9]+)(?:\/|$)/)?.[1]
    return !!postId && getRedditVideoContext(video)?.postId === postId
}

export function getRedditVideoMountTarget(video: HTMLVideoElement): HTMLElement | null {
    const root = video.getRootNode()
    if (!(root instanceof ShadowRoot)) return video.parentElement
    if (!root.host.matches('shreddit-player')) return null
    let target = root.querySelector<HTMLElement>('[data-onlytranslate-reddit-ui]')
    if (!target) {
        target = document.createElement('div')
        target.dataset.onlytranslateRedditUi = ''
        target.style.cssText = 'position:absolute;inset:0;z-index:10;pointer-events:none'
        root.append(target)
    }
    return target
}

export function setRedditNativeSubtitleHidden(video: HTMLVideoElement, hidden: boolean) {
    const root = getPlayer(video)?.shadowRoot
    const caption = root?.querySelector('shreddit-media-ui')?.shadowRoot
        ?.querySelector<HTMLElement>('shreddit-caption-overlay')
    if (!caption) return
    if (hidden) {
        caption.dataset.onlytranslateVisibility ??= caption.style.visibility
        caption.style.visibility = 'hidden'
    } else if (caption.dataset.onlytranslateVisibility !== undefined) {
        caption.style.visibility = caption.dataset.onlytranslateVisibility
        delete caption.dataset.onlytranslateVisibility
    }
}

export function watchRedditVideoPlayers(
    mount: (video: HTMLVideoElement) => void,
    unmount: (video: HTMLVideoElement) => void,
    onChange: () => void,
    onPlay: (video: HTMLVideoElement) => void,
) {
    const videos = new Set<HTMLVideoElement>()
    const shadows = new Map<HTMLElement, MutationObserver>()
    let stopped = false
    let queued = false
    const options = {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'caption-url', 'post-id', 'data-mpd-url', 'data-hls-url'],
    }
    const onVideoPlay = (event: Event) => onPlay(event.currentTarget as HTMLVideoElement)
    const refresh = () => {
        queued = false
        if (stopped) return
        const candidates = new Set(document.querySelectorAll<HTMLVideoElement>('video'))
        const players = new Set(document.querySelectorAll<HTMLElement>('shreddit-player'))
        for (const [player, observer] of shadows) {
            if (!players.has(player)) {
                observer.disconnect()
                shadows.delete(player)
            }
        }
        for (const player of players) {
            if (!player.shadowRoot) continue
            if (!shadows.has(player)) {
                const observer = new MutationObserver(schedule)
                observer.observe(player.shadowRoot, options)
                shadows.set(player, observer)
            }
            const video = player.shadowRoot.querySelector('video')
            if (video) candidates.add(video)
        }
        for (const video of candidates) {
            if (!getRedditVideoContext(video)) candidates.delete(video)
        }
        for (const video of videos) {
            if (candidates.has(video)) continue
            video.removeEventListener('play', onVideoPlay)
            video.removeEventListener('loadedmetadata', schedule)
            videos.delete(video)
            unmount(video)
        }
        for (const video of candidates) {
            if (!videos.has(video)) {
                videos.add(video)
                video.addEventListener('play', onVideoPlay)
                video.addEventListener('loadedmetadata', schedule)
            }
            mount(video)
        }
        onChange()
    }
    function schedule() {
        if (stopped || queued) return
        queued = true
        queueMicrotask(refresh)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, options)
    window.addEventListener('popstate', schedule)
    // Lit creates the shadow root when the lazy custom element upgrades.
    void customElements.whenDefined('shreddit-player').then(schedule)
    refresh()
    return () => {
        stopped = true
        observer.disconnect()
        shadows.forEach(observer => observer.disconnect())
        window.removeEventListener('popstate', schedule)
        for (const video of videos) {
            video.removeEventListener('play', onVideoPlay)
            video.removeEventListener('loadedmetadata', schedule)
            unmount(video)
        }
    }
}
