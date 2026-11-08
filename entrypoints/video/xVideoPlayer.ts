import { createXSubtitleRequest, getXMasterUrl, getXMediaKey } from './xSubtitle'
import { t } from '@/entrypoints/utils/i18n/content'

function installFullscreenStyles() {
    if (document.getElementById('onlytranslate-video-fullscreen-style')) return
    const style = document.createElement('style')
    style.id = 'onlytranslate-video-fullscreen-style'
    style.textContent = `
        [data-only-translate-fullscreen-target]:fullscreen {
            background: #000 !important;
            max-width: none !important;
            max-height: none !important;
            padding: 0 !important;
        }
        [data-only-translate-fullscreen-target]:fullscreen video[data-only-translate-fullscreen-video] {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
            object-fit: contain !important;
        }
    `
    document.head.append(style)
}

export function mountXVideoFullscreen(
    video: HTMLVideoElement,
    parent: HTMLElement,
    subtitleButton: HTMLButtonElement,
    activate: () => void,
): (() => void) | undefined {
    const target = video.closest<HTMLElement>('[data-testid="videoPlayer"]') ?? parent
    if (!document.fullscreenEnabled || typeof target.requestFullscreen !== 'function') return

    installFullscreenStyles()
    video.dataset.onlyTranslateFullscreenVideo = ''
    target.dataset.onlyTranslateFullscreenTarget = ''
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.onlyTranslateFullscreen = ''
    const svgNamespace = 'http://www.w3.org/2000/svg'
    const icon = document.createElementNS(svgNamespace, 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('width', '18')
    icon.setAttribute('height', '18')
    icon.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(svgNamespace, 'path')
    path.setAttribute('d', 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '2')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    icon.append(path)
    button.append(icon)
    button.style.cssText = [
        'position:absolute', 'top:8px', 'right:46px', 'width:30px', 'height:30px',
        'display:grid', 'place-items:center', 'box-sizing:border-box', 'padding:0',
        'border:0', 'border-radius:6px', 'background:rgba(0,0,0,.78)',
        'color:white', 'cursor:pointer', 'z-index:2',
    ].join(';')
    parent.append(button)

    const controlsList = (video as HTMLVideoElement & { controlsList?: DOMTokenList }).controlsList
    const hideNativeButton = video.controls && controlsList && !controlsList.contains('nofullscreen')
    if (hideNativeButton) controlsList.add('nofullscreen')

    const inFullscreen = () => document.fullscreenElement?.contains(video) === true
    const sync = () => {
        const fullscreen = document.fullscreenElement
        const isFullscreen = inFullscreen()
        const label = t(isFullscreen ? 'video.subtitleExitFullscreen' : 'video.subtitleFullscreen')
        button.title = label
        button.setAttribute('aria-label', label)
        const position = fullscreen?.contains(button) ? 'fixed' : 'absolute'
        button.style.position = position
        subtitleButton.style.position = position
        if (isFullscreen) activate()
    }
    button.addEventListener('click', event => {
        event.stopPropagation()
        const change = inFullscreen() ? document.exitFullscreen() : target.requestFullscreen()
        void change.catch(() => undefined)
    })
    document.addEventListener('fullscreenchange', sync)
    sync()

    return () => {
        document.removeEventListener('fullscreenchange', sync)
        button.remove()
        if (hideNativeButton) controlsList.remove('nofullscreen')
        delete video.dataset.onlyTranslateFullscreenVideo
        if (!target.querySelector('video[data-only-translate-fullscreen-video]')) {
            delete target.dataset.onlyTranslateFullscreenTarget
        }
    }
}

function getPostId(url: string): string | undefined {
    try {
        return new URL(url, location.href).pathname.match(/^\/[^/]+\/status\/(\d{1,20})(?:\/|$)/)?.[1]
    } catch {
        return
    }
}

export function getXVideoContext(video: HTMLVideoElement) {
    const source = video.src || video.querySelector<HTMLSourceElement>('source[src]')?.src || video.currentSrc
    const mediaKey = getXMediaKey(source) || getXMediaKey(video.getAttribute('poster') || '')
    const teapawPost = video.closest('.quote, .timeline-item')
    const xPost = video.closest('[data-testid="tweet"]')
    const postLink = teapawPost?.querySelector<HTMLAnchorElement>('.tweet-date a')
        || xPost?.querySelector('time')?.closest('a')
    const postId = (postLink && getPostId(postLink.href)) || getPostId(location.href)
    return { postId, mediaKey }
}

export function getXVideoContextKey(video: HTMLVideoElement): string {
    const { postId, mediaKey } = getXVideoContext(video)
    return `${postId ?? ''}|${mediaKey ?? ''}`
}

export function isXVideoForCurrentPost(video: HTMLVideoElement): boolean {
    const postId = getPostId(location.href)
    return !!postId && getXVideoContext(video).postId === postId
}

export function getXVideoRequest(video: HTMLVideoElement) {
    const { postId, mediaKey } = getXVideoContext(video)
    // X may already have loaded this manifest, including for posts without public embed data.
    const masterUrl = mediaKey && performance.getEntriesByType('resource')
        .map(entry => getXMasterUrl(entry.name, mediaKey))
        .find(Boolean)
    return createXSubtitleRequest(postId, mediaKey, masterUrl || undefined)
}

export function watchXVideoPlayers(
    mount: (video: HTMLVideoElement) => void,
    unmount: (video: HTMLVideoElement) => void,
    onChange: () => void,
    onPlay: (video: HTMLVideoElement) => void,
) {
    const scan = (root: ParentNode, visit: (video: HTMLVideoElement) => void) => {
        if (root instanceof HTMLVideoElement) visit(root)
        root.querySelectorAll('video').forEach(visit)
    }
    const unmountIfDetached = (video: HTMLVideoElement) => {
        if (!video.isConnected) unmount(video)
    }
    scan(document, mount)
    new MutationObserver(records => {
        for (const record of records) {
            if (record.target instanceof HTMLVideoElement) mount(record.target)
            for (const node of record.addedNodes) {
                if (node instanceof HTMLElement) scan(node, mount)
            }
            for (const node of record.removedNodes) {
                if (node instanceof HTMLElement) scan(node, unmountIfDetached)
            }
        }
        onChange()
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['poster', 'src'] })
    window.addEventListener('popstate', onChange)
    document.addEventListener('loadedmetadata', onChange, true)
    document.addEventListener('play', event => {
        if (event.target instanceof HTMLVideoElement) onPlay(event.target)
    }, true)
    onChange()
}
