import { detectPlatform, getAllSubtitlePatterns } from './platforms'
import { parseSubtitleData } from './parser'
import { buildSubtitleSegments } from './segmenter'
import { SubtitleTranslationScheduler } from './scheduler'
import { SubtitleOverlay } from './overlay'
import type { SubtitleSegment } from './types'
import { buildSubtitleTrackKey, isSubtitleTrackForPage } from './track'
import { translateSubtitleBatch } from './translator'
import { config } from '@/entrypoints/utils/config'
import { t } from '@/entrypoints/utils/i18n'

const EVENT_TYPE = 'fr-subtitle-inject'
const QUICK_BTN_ID = 'fr-subtitle-quick-btn'
type SubtitleLoadStatus = 'idle' | 'loading' | 'fetching' | 'waiting-cc' | 'ready' | 'no-track' | 'failed'

const overlay = new SubtitleOverlay()
let scheduler: SubtitleTranslationScheduler | null = null
let listenerAttached = false
let navigationWatchAttached = false
let processingTrackKey = ''
let activeTrackKey = ''
let sessionGeneration = 0
let subtitleEnabled = true
let subtitleLoadStatus: SubtitleLoadStatus = 'idle'
let currentSegments: SubtitleSegment[] = []
let currentVideo: HTMLVideoElement | null = null
let currentSourceLanguage: string | undefined

export function initVideoSubtitle() {
    if (!config.enableVideoSubtitle) return
    attachMessageListener()
    watchNavigation()
    sendConfig()
    if (isYouTubeHost()) mountQuickButton()
    requestYouTubeSubtitle()
}

function isYouTubeHost(): boolean {
    return window.location.hostname.includes('youtube.com')
        || window.location.hostname.includes('youtubekids.com')
}

function sendConfig() {
    window.postMessage({
        eventType: EVENT_TYPE,
        type: 'config',
        patterns: getAllSubtitlePatterns(),
    }, '*')
}

function requestYouTubeSubtitle() {
    if (!subtitleEnabled || !isYouTubeHost()) return
    setSubtitleLoadStatus('loading')
    window.postMessage({
        eventType: EVENT_TYPE,
        type: 'youtube-auto-fetch',
    }, '*')
}

function cancelYouTubeSubtitleRequest() {
    if (!isYouTubeHost()) return
    window.postMessage({
        eventType: EVENT_TYPE,
        type: 'youtube-auto-cancel',
    }, '*')
}

function attachMessageListener() {
    if (listenerAttached) return
    listenerAttached = true

    window.addEventListener('message', event => {
        if (event.source !== window) return
        const message = event.data
        if (!message || message.eventType !== EVENT_TYPE) return
        if (message.type === 'youtube-subtitle-status') {
            handleYouTubeSubtitleStatus(message)
            return
        }
        if (message.type !== 'subtitle-captured') return
        if (!subtitleEnabled || !message.url || !message.data) return
        handleSubtitleData(String(message.url), String(message.data))
    })
}

function handleYouTubeSubtitleStatus(message: { status?: string; videoId?: string }) {
    if (!subtitleEnabled || !isStatusForCurrentVideo(message.videoId)) return
    const allowedStatuses: SubtitleLoadStatus[] = [
        'loading', 'fetching', 'waiting-cc', 'no-track', 'failed',
    ]
    if (allowedStatuses.includes(message.status as SubtitleLoadStatus)) {
        setSubtitleLoadStatus(message.status as SubtitleLoadStatus)
    }
}

function isStatusForCurrentVideo(videoId?: string): boolean {
    if (!videoId) return true
    try {
        const currentVideoId = new URL(window.location.href).searchParams.get('v')
        return !currentVideoId || currentVideoId === videoId
    } catch {
        return true
    }
}

function setSubtitleLoadStatus(status: SubtitleLoadStatus) {
    subtitleLoadStatus = status
    updateQuickButton()
}

function handleSubtitleData(url: string, rawData: string) {
    if (!isSubtitleTrackForPage(url)) return
    const trackKey = buildSubtitleTrackKey(url)
    if (trackKey === activeTrackKey) {
        if (currentSegments.length) setSubtitleLoadStatus('ready')
        return
    }
    if (trackKey === processingTrackKey) return

    const parsed = parseSubtitleData(url, rawData)
    if (!parsed?.cues.length) {
        setSubtitleLoadStatus('failed')
        return
    }
    const segments = buildSubtitleSegments(parsed.cues, parsed.sourceLanguage)
    if (!segments.length) {
        setSubtitleLoadStatus('failed')
        return
    }

    const video = findVideo()
    if (!video) {
        setSubtitleLoadStatus('failed')
        return
    }

    processingTrackKey = trackKey
    beginNewSession()
    processingTrackKey = trackKey

    currentVideo = video
    currentSegments = segments
    currentSourceLanguage = parsed.sourceLanguage
    activeTrackKey = trackKey
    const generation = sessionGeneration

    overlay.mount(video, findMountTarget(video))
    overlay.setSegments(currentSegments)
    hideNativeSubtitle()
    mountQuickButton()
    scheduler = createScheduler(generation)
    scheduler.start()
    processingTrackKey = ''
    setSubtitleLoadStatus('ready')
}

function createScheduler(generation: number): SubtitleTranslationScheduler {
    return new SubtitleTranslationScheduler({
        video: currentVideo!,
        segments: currentSegments,
        trackKey: activeTrackKey,
        sessionId: String(generation),
        title: getVideoTitle(),
        sourceLanguage: currentSourceLanguage,
        targetLanguage: config.to,
        translateBatch: translateSubtitleBatch,
        onUpdate: () => {
            if (generation === sessionGeneration && subtitleEnabled) {
                overlay.setSegments([...currentSegments])
            }
        },
    })
}

function beginNewSession() {
    sessionGeneration++
    scheduler?.stop()
    scheduler = null
    restoreNativeSubtitle()
    overlay.cleanup()
    processingTrackKey = ''
    activeTrackKey = ''
    currentSegments = []
    currentVideo = null
    currentSourceLanguage = undefined
    setSubtitleLoadStatus('idle')
}

function getVideoTitle(): string {
    return document.title.replace(/\s+-\s+YouTube\s*$/i, '').trim()
}

function disableCurrentSession() {
    sessionGeneration++
    cancelYouTubeSubtitleRequest()
    scheduler?.stop()
    scheduler = null
    overlay.hide()
    restoreNativeSubtitle()
    updateQuickButton()
}

function resumeCurrentSession() {
    if (!currentVideo?.isConnected || !currentSegments.length) {
        requestYouTubeSubtitle()
        return
    }
    sessionGeneration++
    hideNativeSubtitle()
    overlay.show()
    scheduler = createScheduler(sessionGeneration)
    scheduler.start()
    setSubtitleLoadStatus('ready')
}

function mountQuickButton() {
    if (!isYouTubeHost() || document.getElementById(QUICK_BTN_ID)) return

    waitForElement('.ytp-right-controls', controls => {
        if (document.getElementById(QUICK_BTN_ID)) return

        const button = document.createElement('button')
        button.id = QUICK_BTN_ID
        button.title = t('video.subtitleButton')
        button.setAttribute('aria-label', t('video.subtitleTranslation'))
        button.style.cssText = [
            'background:transparent',
            'border:none',
            'cursor:pointer',
            'padding:0 6px',
            'height:100%',
            'display:inline-flex',
            'align-items:center',
            'position:relative',
            'opacity:0.9',
            'vertical-align:top',
        ].join(';')
        button.addEventListener('click', () => {
            subtitleEnabled = !subtitleEnabled
            updateQuickButton()
            if (subtitleEnabled) resumeCurrentSession()
            else disableCurrentSession()
        })

        controls.prepend(button)
        updateQuickButton()
    })
}

function updateQuickButton() {
    const button = document.getElementById(QUICK_BTN_ID) as HTMLButtonElement | null
    if (!button) return

    const visibleStatus = subtitleEnabled ? subtitleLoadStatus : 'disabled'
    button.dataset.subtitleStatus = visibleStatus
    button.title = getQuickButtonTitle(visibleStatus)
    button.setAttribute('aria-label', button.title)
    button.replaceChildren(buildBtnSvg(getQuickButtonColor(visibleStatus)), buildStatusDot(visibleStatus))
}

function getQuickButtonTitle(status: SubtitleLoadStatus | 'disabled'): string {
    if (status === 'disabled') return t('video.subtitleButtonOff')
    if (status === 'loading' || status === 'fetching') return t('video.subtitleLoading')
    if (status === 'waiting-cc') return t('video.subtitleWaitingCc')
    if (status === 'ready') return t('video.subtitleReady')
    if (status === 'no-track') return t('video.subtitleNoTrack')
    if (status === 'failed') return t('video.subtitleLoadFailed')
    return t('video.subtitleButtonOn')
}

function getQuickButtonColor(status: SubtitleLoadStatus | 'disabled'): string {
    if (status === 'loading' || status === 'fetching' || status === 'waiting-cc') return '#f6c344'
    if (status === 'failed') return '#ff5c5c'
    if (status === 'no-track' || status === 'disabled') return 'rgba(255,255,255,0.35)'
    return '#fff'
}

function buildStatusDot(status: SubtitleLoadStatus | 'disabled'): HTMLSpanElement {
    const dot = document.createElement('span')
    const colors: Partial<Record<SubtitleLoadStatus, string>> = {
        loading: '#f6c344',
        fetching: '#f6c344',
        'waiting-cc': '#f6c344',
        ready: '#42d392',
        'no-track': '#999',
        failed: '#ff5c5c',
    }
    const color = colors[status as SubtitleLoadStatus]
    dot.setAttribute('aria-hidden', 'true')
    dot.style.cssText = [
        'position:absolute',
        'right:3px',
        'bottom:8px',
        'width:6px',
        'height:6px',
        'border-radius:50%',
        `background:${color || 'transparent'}`,
        `box-shadow:${color ? '0 0 0 1px rgba(0,0,0,0.45)' : 'none'}`,
    ].join(';')
    return dot
}

function buildBtnSvg(color: string): SVGElement {
    const namespace = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(namespace, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', color)
    svg.style.transition = 'fill 0.2s ease'
    const path = document.createElementNS(namespace, 'path')
    path.setAttribute('d', 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z')
    svg.appendChild(path)
    return svg
}

function waitForElement(selector: string, callback: (element: Element) => void, maxMs = 10000) {
    const existing = document.querySelector(selector)
    if (existing) {
        callback(existing)
        return
    }

    const start = Date.now()
    const timer = window.setInterval(() => {
        const found = document.querySelector(selector)
        if (found) {
            window.clearInterval(timer)
            callback(found)
        } else if (Date.now() - start > maxMs) {
            window.clearInterval(timer)
        }
    }, 300)
}

function findVideo(): HTMLVideoElement | null {
    const platform = detectPlatform(window.location.hostname)
    return document.querySelector<HTMLVideoElement>(platform.videoSelector)
        || document.querySelector<HTMLVideoElement>('video')
}

function findMountTarget(video: HTMLVideoElement): HTMLElement {
    const platform = detectPlatform(window.location.hostname)
    if (platform.containerSelector) {
        const container = document.querySelector<HTMLElement>(platform.containerSelector)
        if (container) return container
    }
    return video.parentElement || document.body
}

function hideNativeSubtitle() {
    const selector = detectPlatform(window.location.hostname).hideNativeSelector
    if (!selector) return
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
        if (element.dataset.frOrigDisplay === undefined) {
            element.dataset.frOrigDisplay = element.style.display
        }
        element.style.setProperty('display', 'none', 'important')
    })
}

function restoreNativeSubtitle() {
    const selector = detectPlatform(window.location.hostname).hideNativeSelector
    if (!selector) return
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
        const original = element.dataset.frOrigDisplay
        if (original !== undefined) {
            element.style.display = original
            delete element.dataset.frOrigDisplay
        } else {
            element.style.removeProperty('display')
        }
    })
}

function watchNavigation() {
    if (navigationWatchAttached) return
    navigationWatchAttached = true
    let lastUrl = window.location.href

    const onUrlChange = () => {
        const currentUrl = window.location.href
        if (currentUrl === lastUrl) return
        lastUrl = currentUrl
        beginNewSession()
        document.getElementById(QUICK_BTN_ID)?.remove()
        subtitleEnabled = true
        if (isYouTubeHost()) {
            mountQuickButton()
            requestYouTubeSubtitle()
        }
    }

    window.addEventListener('yt-navigate-finish', onUrlChange)
    const title = document.querySelector('title')
    if (title) new MutationObserver(onUrlChange).observe(title, { childList: true })
}
