import { detectPlatform, getAllSubtitlePatterns } from './platforms'
import { parseSubtitleData } from './parser'
import { buildSubtitleSegments, segmenterVersion } from './segmenter'
import {
    SubtitleTranslationScheduler,
    type SubtitleSchedulerSnapshot,
} from './scheduler'
import { SubtitleOverlay } from './overlay'
import type { SubtitleSegment } from './types'
import { buildSubtitleTrackKey, isSubtitleTrackForPage } from './track'
import {
    canUseStructuredSubtitleTranslation,
    SUBTITLE_TRANSLATION_PROMPT_VERSION,
    translateSubtitleBatch,
    type SubtitleQualityRequestResult,
} from './translator'
import {
    createVideoSubtitleCacheSession,
    normalizeSubtitleCacheEndpoint,
    sha256SubtitleCacheValue,
    type SubtitleCacheIdentity,
    type VideoSubtitleCacheSession,
} from './cache'
import { config } from '@/entrypoints/utils/config'
import { t } from '@/entrypoints/utils/i18n/content'
import { urls } from '@/entrypoints/utils/constant'
import { services, servicesType } from '@/entrypoints/utils/option'
import { REQUEST_POLICY_VERSION } from '@/entrypoints/utils/modelCapabilities'
import {
    resolveCustomProviderEndpoint,
    resolveOpenAICompatibleEndpoint,
} from '@/entrypoints/utils/providerEndpoint'
import { resolveConfiguredTranslationModel } from '@/entrypoints/utils/modelSelection'
import { isVideoFastModeEffective } from './fastMode'

const EVENT_TYPE = 'fr-subtitle-inject'
const QUICK_BTN_ID = 'fr-subtitle-quick-btn'
const STATUS_HINT_ID = 'fr-subtitle-status-hint'
const STATUS_HINT_COOLDOWN_MS = 15_000
const SUBTITLE_CONTEXT_VERSION = 'subtitle-neighborhood-v1'
type SubtitleLoadStatus = 'idle' | 'loading' | 'fetching' | 'waiting-cc' | 'ready' | 'no-track' | 'failed'
type VisibleSubtitleStatus = SubtitleLoadStatus | 'disabled' | 'starting' | 'catching-up' | 'buffered' | 'translation-failed'

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
let currentVideoTitle = ''
let currentCacheSession: VideoSubtitleCacheSession | null = null
let currentCacheRuntimeSignature = ''
let currentSessionReady = false
let translationStatus: SubtitleSchedulerSnapshot | null = null
let forcedFastMode = false
let consecutiveQualityTimeouts = 0
let statusHintTimer: number | null = null
let lastVisibleStatus: VisibleSubtitleStatus | null = null
const lastStatusHintAt = new Map<VisibleSubtitleStatus, number>()

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
        void handleSubtitleData(String(message.url), String(message.data))
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

async function handleSubtitleData(url: string, rawData: string) {
    if (!isSubtitleTrackForPage(url)) return
    const trackKey = buildSubtitleTrackKey(url)
    if (trackKey === activeTrackKey) {
        if (currentSegments.length) setSubtitleLoadStatus('ready')
        return
    }
    if (trackKey === processingTrackKey) return
    processingTrackKey = trackKey

    const parsed = parseSubtitleData(url, rawData)
    if (!parsed?.cues.length) {
        clearProcessingTrack(trackKey)
        setSubtitleLoadStatus('failed')
        return
    }
    const segments = buildSubtitleSegments(parsed.cues, parsed.sourceLanguage)
    if (!segments.length) {
        clearProcessingTrack(trackKey)
        setSubtitleLoadStatus('failed')
        return
    }

    const video = findVideo()
    if (!video) {
        clearProcessingTrack(trackKey)
        setSubtitleLoadStatus('failed')
        return
    }

    beginNewSession()
    processingTrackKey = trackKey

    currentVideo = video
    currentSegments = segments
    currentSourceLanguage = parsed.sourceLanguage
    currentVideoTitle = getVideoTitle()
    activeTrackKey = trackKey
    const generation = sessionGeneration
    translationStatus = createStartingSnapshot()
    setSubtitleLoadStatus('ready')

    let cacheSession: VideoSubtitleCacheSession | null = null
    const cacheRuntimeSignature = createSubtitleCacheRuntimeSignature(parsed.sourceLanguage)
    try {
        cacheSession = await createVideoSubtitleCacheSession({
            identity: await buildSubtitleCacheIdentity(trackKey, parsed.sourceLanguage),
            segments,
            useCache: config.useCache,
        })
        if (!isCurrentSession(generation, trackKey, video)) return

        if (cacheRuntimeSignature === createSubtitleCacheRuntimeSignature(parsed.sourceLanguage)) {
            const hits = await cacheSession.hydrate()
            if (!isCurrentSession(generation, trackKey, video)) return
            if (cacheRuntimeSignature === createSubtitleCacheRuntimeSignature(parsed.sourceLanguage)) {
                applyCacheHits(segments, hits)
            } else {
                cacheSession = null
            }
        } else {
            cacheSession = null
        }
    } catch {
        // Cache preparation and storage failures must never block live translation.
    }

    if (!isCurrentSession(generation, trackKey, video)) return
    currentCacheSession = cacheSession
    currentCacheRuntimeSignature = cacheRuntimeSignature

    overlay.mount(video, findMountTarget(video))
    overlay.setSegments(currentSegments)
    hideNativeSubtitle()
    mountQuickButton()
    scheduler = createScheduler(generation)
    currentSessionReady = true
    scheduler.start()
    clearProcessingTrack(trackKey)
}

function clearProcessingTrack(trackKey: string) {
    if (processingTrackKey === trackKey) processingTrackKey = ''
}

function isCurrentSession(generation: number, trackKey: string, video: HTMLVideoElement): boolean {
    return subtitleEnabled
        && generation === sessionGeneration
        && activeTrackKey === trackKey
        && currentVideo === video
        && video.isConnected
}

function createStartingSnapshot(): SubtitleSchedulerSnapshot {
    return {
        phase: 'starting',
        runwaySeconds: 0,
        activeRuns: 0,
        failedInImmediateWindow: false,
    }
}

function applyCacheHits(
    segments: SubtitleSegment[],
    hits: Array<{ id: string; translatedText: string }>,
) {
    const translatedById = new Map(hits.map(hit => [hit.id, hit.translatedText.trim()]))
    for (const segment of segments) {
        if (segment.status === 'translated') continue
        const translatedText = translatedById.get(segment.id)
        if (!translatedText) continue
        segment.translatedText = translatedText
        segment.status = 'translated'
    }
}

function createScheduler(generation: number): SubtitleTranslationScheduler {
    const cacheSession = currentCacheSession
    return new SubtitleTranslationScheduler({
        video: currentVideo!,
        segments: currentSegments,
        trackKey: activeTrackKey,
        sessionId: String(generation),
        title: currentVideoTitle,
        sourceLanguage: currentSourceLanguage,
        targetLanguage: resolveEffectiveSubtitleTarget(currentSourceLanguage),
        translateBatch: (job, options) => translateSubtitleBatch(job, {
            ...options,
            effectiveFastMode: resolveEffectiveFastMode(),
            onQualityRequestResult: result => handleQualityRequestResult(generation, result),
        }),
        onUpdate: () => {
            if (generation === sessionGeneration && subtitleEnabled) {
                overlay.setSegments([...currentSegments])
            }
        },
        onStatus: snapshot => {
            if (generation !== sessionGeneration || !subtitleEnabled) return
            translationStatus = snapshot
            updateQuickButton()
        },
        onTranslationCommitted: results => {
            if (
                generation !== sessionGeneration
                || !subtitleEnabled
                || !config.useCache
                || !cacheSession
                // Replacing the session object is the final guard against a quality-mode
                // result being written under the FastMode identity after a circuit break.
                || cacheSession !== currentCacheSession
                || currentCacheRuntimeSignature !== createSubtitleCacheRuntimeSignature(currentSourceLanguage)
            ) return
            const cacheable = results.filter(result => result.cacheable !== false)
            if (cacheable.length) void cacheSession.commitMany(cacheable)
        },
    })
}

function handleQualityRequestResult(
    generation: number,
    result: SubtitleQualityRequestResult,
) {
    if (generation !== sessionGeneration || forcedFastMode) return
    if (result !== 'timeout') {
        consecutiveQualityTimeouts = 0
        return
    }

    consecutiveQualityTimeouts++
    if (consecutiveQualityTimeouts >= 2) {
        void forceFastModeForCurrentSession(generation)
    }
}

async function forceFastModeForCurrentSession(generation: number) {
    if (
        forcedFastMode
        || generation !== sessionGeneration
        || !currentVideo
        || !activeTrackKey
    ) return

    // This flag is set before stopping the scheduler so simultaneous lane timeouts
    // cannot perform the restart twice.
    forcedFastMode = true
    const video = currentVideo
    const trackKey = activeTrackKey
    const oldScheduler = scheduler
    oldScheduler?.stop()
    scheduler = null
    sessionGeneration++
    const restartGeneration = sessionGeneration
    consecutiveQualityTimeouts = 0

    for (const segment of currentSegments) {
        if (segment.status === 'translated') continue
        segment.status = 'pending'
        segment.translatedText = undefined
    }

    // Assigning a different object reference (null now, a new session below) makes
    // late quality-mode commits fail the cacheSession !== currentCacheSession guard.
    currentCacheSession = null
    currentCacheRuntimeSignature = createSubtitleCacheRuntimeSignature(currentSourceLanguage)
    translationStatus = createStartingSnapshot()
    overlay.setSegments([...currentSegments])
    updateQuickButton()
    showForcedFastModeHint()

    let cacheSession: VideoSubtitleCacheSession | null = null
    try {
        cacheSession = await createVideoSubtitleCacheSession({
            identity: await buildSubtitleCacheIdentity(trackKey, currentSourceLanguage),
            segments: currentSegments,
            useCache: config.useCache,
        })
        if (!isCurrentSession(restartGeneration, trackKey, video)) return

        const runtimeSignature = createSubtitleCacheRuntimeSignature(currentSourceLanguage)
        if (runtimeSignature === currentCacheRuntimeSignature) {
            const hits = await cacheSession.hydrate()
            if (!isCurrentSession(restartGeneration, trackKey, video)) return
            if (runtimeSignature === createSubtitleCacheRuntimeSignature(currentSourceLanguage)) {
                applyCacheHits(currentSegments, hits)
            } else {
                cacheSession = null
            }
        } else {
            cacheSession = null
        }
    } catch {
        // Cache preparation must not prevent the FastMode runtime from restarting.
    }

    if (!isCurrentSession(restartGeneration, trackKey, video)) return
    currentCacheSession = cacheSession
    currentCacheRuntimeSignature = createSubtitleCacheRuntimeSignature(currentSourceLanguage)
    overlay.setSegments([...currentSegments])
    scheduler = createScheduler(restartGeneration)
    scheduler.start()
}

function resolveEffectiveFastMode(): boolean {
    return forcedFastMode || config.videoSubtitleFastMode !== false
}

function createSubtitleCacheRuntimeSignature(sourceLanguage?: string): string {
    const service = String(config.service || '')
    const fastMode = resolveEffectiveFastMode()
    const thinkingWanted = !fastMode && config.thinking?.[service] === true
    return JSON.stringify([
        service,
        canUseStructuredSubtitleTranslation() ? 'structured' : 'direct',
        resolveEffectiveSubtitleModel(service),
        normalizeSubtitleCacheEndpoint(resolveSubtitleEndpoint(service)),
        resolveEffectiveSubtitleTarget(sourceLanguage),
        config.system_role?.[service] || '',
        config.user_role?.[service] || '',
        Boolean(config.bidirectionalTranslation),
        config.bidirectionalTarget || '',
        Boolean(config.useCache),
        fastMode,
        ...(servicesType.isAI(service)
            ? [REQUEST_POLICY_VERSION, thinkingWanted]
            : []),
    ])
}

async function buildSubtitleCacheIdentity(
    trackKey: string,
    sourceLanguage?: string,
): Promise<SubtitleCacheIdentity> {
    const service = String(config.service || '')
    const mode = canUseStructuredSubtitleTranslation() ? 'structured' : 'direct'
    const fastMode = resolveEffectiveFastMode()
    const thinkingWanted = !fastMode && config.thinking?.[service] === true
    const promptSource = mode === 'structured'
        ? [
            mode,
            SUBTITLE_TRANSLATION_PROMPT_VERSION,
            Boolean(config.bidirectionalTranslation),
            config.bidirectionalTarget || '',
        ]
        : [
            mode,
            config.system_role?.[service] || '',
            config.user_role?.[service] || '',
            Boolean(config.bidirectionalTranslation),
            config.bidirectionalTarget || '',
        ]

    return {
        trackKey,
        title: currentVideoTitle,
        sourceLanguage,
        targetLanguage: resolveEffectiveSubtitleTarget(sourceLanguage),
        segmenterVersion,
        contextVersion: SUBTITLE_CONTEXT_VERSION,
        promptVersion: SUBTITLE_TRANSLATION_PROMPT_VERSION,
        mode,
        service,
        model: resolveEffectiveSubtitleModel(service),
        endpoint: normalizeSubtitleCacheEndpoint(resolveSubtitleEndpoint(service)),
        fastMode,
        promptFingerprint: await sha256SubtitleCacheValue(JSON.stringify(promptSource)),
        ...(servicesType.isAI(service)
            ? {
                requestPolicyVersion: REQUEST_POLICY_VERSION,
                thinkingWanted,
            }
            : {}),
    }
}

function normalizeSubtitleLanguage(language?: string): string {
    const normalized = String(language || '').trim().replace('_', '-').toLowerCase()
    if (!normalized) return ''
    if (normalized === 'zh-hant' || /^(zh-(tw|hk|mo))/.test(normalized)) return 'zh-Hant'
    if (normalized === 'zh-hans' || normalized === 'zh' || /^zh-(cn|sg)/.test(normalized)) return 'zh-Hans'
    return normalized.split('-')[0]
}

function resolveEffectiveSubtitleTarget(sourceLanguage?: string): string {
    if (
        config.bidirectionalTranslation
        && config.bidirectionalTarget
        && normalizeSubtitleLanguage(sourceLanguage) === normalizeSubtitleLanguage(config.to)
    ) {
        return config.bidirectionalTarget
    }
    return config.to
}

function resolveEffectiveSubtitleModel(service: string): string {
    return resolveConfiguredTranslationModel(service, config)
}

function resolveSubtitleEndpoint(service: string): string {
    if (service.startsWith('custom_')) {
        return resolveCustomProviderEndpoint(
            config.customProviders?.find(item => item.id === service),
        )
    }
    if (service === services.newapi) return resolveOpenAICompatibleEndpoint(config.newApiUrl || '')
    if (config.proxy?.[service]) return config.proxy[service]
    if (service === services.gemini) return 'https://generativelanguage.googleapis.com/v1beta/models'
    if (service === services.minimax) return 'https://api.minimax.chat/v1/text'
    if (service === services.custom) return config.custom || ''
    return urls[service] || `builtin:${service}`
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
    currentVideoTitle = ''
    currentCacheSession = null
    currentCacheRuntimeSignature = ''
    currentSessionReady = false
    translationStatus = null
    forcedFastMode = false
    consecutiveQualityTimeouts = 0
    resetStatusHintState()
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
    translationStatus = null
    overlay.hide()
    restoreNativeSubtitle()
    resetStatusHintState()
    updateQuickButton()
}

function resumeCurrentSession() {
    if (!currentSessionReady) {
        beginNewSession()
        requestYouTubeSubtitle()
        return
    }
    if (
        currentCacheRuntimeSignature
        && currentCacheRuntimeSignature !== createSubtitleCacheRuntimeSignature(currentSourceLanguage)
    ) {
        beginNewSession()
        requestYouTubeSubtitle()
        return
    }
    if (!currentVideo?.isConnected || !currentSegments.length) {
        requestYouTubeSubtitle()
        return
    }
    sessionGeneration++
    translationStatus = createStartingSnapshot()
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

    const visibleStatus = resolveVisibleStatus()
    const statusText = getQuickButtonStatusText(visibleStatus)
    button.dataset.subtitleStatus = visibleStatus
    button.title = `${statusText}${getFastModeTitleSuffix(visibleStatus)}`
    button.setAttribute('aria-label', button.title)
    button.setAttribute('aria-pressed', String(subtitleEnabled))
    button.replaceChildren(buildBtnSvg(getQuickButtonColor(visibleStatus)), buildStatusDot(visibleStatus))
    ensureStatusHint(button)
    handleVisibleStatusChange(visibleStatus, statusText, button)
}

function resolveVisibleStatus(): VisibleSubtitleStatus {
    if (!subtitleEnabled) return 'disabled'
    if (
        subtitleLoadStatus === 'loading'
        || subtitleLoadStatus === 'fetching'
        || subtitleLoadStatus === 'waiting-cc'
    ) return subtitleLoadStatus
    if (subtitleLoadStatus === 'no-track' || subtitleLoadStatus === 'failed') return subtitleLoadStatus
    if (subtitleLoadStatus === 'ready') {
        if (translationStatus?.phase === 'failed') return 'translation-failed'
        if (translationStatus?.phase) return translationStatus.phase
        return 'starting'
    }
    return subtitleLoadStatus
}

function getQuickButtonStatusText(status: VisibleSubtitleStatus): string {
    if (status === 'disabled') return t('video.subtitleButtonOff')
    if (status === 'loading' || status === 'fetching') return t('video.subtitleLoading')
    if (status === 'waiting-cc') return t('video.subtitleWaitingCc')
    if (status === 'no-track') return t('video.subtitleNoTrack')
    if (status === 'failed') return t('video.subtitleLoadFailed')
    if (status === 'translation-failed') return t('video.subtitleTranslationFailed')
    if (status === 'starting') return t('video.subtitleTranslationStarting')
    if (status === 'catching-up') {
        return t('video.subtitleTranslationCatchingUp', {
            seconds: Math.max(0, translationStatus?.runwaySeconds || 0),
        })
    }
    if (status === 'buffered') return t('video.subtitleTranslationBuffered')
    if (status === 'ready') return t('video.subtitleReady')
    return t('video.subtitleButtonOn')
}

function getFastModeTitleSuffix(status: VisibleSubtitleStatus): string {
    if (
        status === 'disabled'
        || !resolveEffectiveFastMode()
        || !['starting', 'catching-up', 'buffered', 'translation-failed', 'ready'].includes(status)
    ) return ''

    const effect = isVideoFastModeEffective(String(config.service || ''), config)
        ? t('video.subtitleFastModeActive')
        : t('video.subtitleFastModeInactive')
    const forced = forcedFastMode ? ` · ${t('video.subtitleForcedFastMode')}` : ''
    return ` · ${effect}${forced}`
}

function getQuickButtonColor(status: VisibleSubtitleStatus): string {
    if (
        status === 'loading'
        || status === 'fetching'
        || status === 'waiting-cc'
        || status === 'starting'
        || status === 'catching-up'
    ) return '#f6c344'
    if (status === 'failed' || status === 'translation-failed') return '#ff5c5c'
    if (status === 'no-track' || status === 'disabled') return 'rgba(255,255,255,0.35)'
    return '#fff'
}

function buildStatusDot(status: VisibleSubtitleStatus): HTMLSpanElement {
    const dot = document.createElement('span')
    const colors: Partial<Record<VisibleSubtitleStatus, string>> = {
        loading: '#f6c344',
        fetching: '#f6c344',
        'waiting-cc': '#f6c344',
        starting: '#f6c344',
        'catching-up': '#f6c344',
        ready: '#42d392',
        buffered: '#42d392',
        'no-track': '#999',
        failed: '#ff5c5c',
        'translation-failed': '#ff5c5c',
    }
    const color = colors[status]
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

function createStatusHint(): HTMLSpanElement {
    const hint = document.createElement('span')
    hint.id = STATUS_HINT_ID
    hint.hidden = true
    hint.setAttribute('role', 'status')
    hint.setAttribute('aria-live', 'polite')
    hint.setAttribute('aria-atomic', 'true')
    hint.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'max-width:min(360px,80vw)',
        'padding:7px 10px',
        'border-radius:7px',
        'background:rgba(20,20,20,0.92)',
        'color:#fff',
        'font-size:13px',
        'font-weight:500',
        'line-height:1.35',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'pointer-events:none',
        'box-shadow:0 2px 10px rgba(0,0,0,0.35)',
    ].join(';')
    return hint
}

function ensureStatusHint(button: HTMLButtonElement): HTMLElement | null {
    const existing = document.getElementById(STATUS_HINT_ID)
    if (existing) return existing
    const hint = createStatusHint()
    button.parentElement?.append(hint)
    return hint.isConnected ? hint : null
}

function positionStatusHint(button: HTMLButtonElement, hint: HTMLElement) {
    const rect = button.getBoundingClientRect()
    hint.style.left = `${Math.max(8, rect.right - 6)}px`
    hint.style.top = `${Math.max(8, rect.top - 8)}px`
    hint.style.transform = 'translate(-100%,-100%)'
}

function handleVisibleStatusChange(
    status: VisibleSubtitleStatus,
    text: string,
    button: HTMLButtonElement,
) {
    if (status === lastVisibleStatus) return
    lastVisibleStatus = status
    hideStatusHint()

    const duration = getStatusHintDuration(status)
    if (!duration) return
    const now = Date.now()
    const previousShownAt = lastStatusHintAt.get(status) || 0
    if (now - previousShownAt < STATUS_HINT_COOLDOWN_MS) return
    lastStatusHintAt.set(status, now)

    const hint = document.getElementById(STATUS_HINT_ID)
    if (!hint) return
    positionStatusHint(button, hint)
    hint.hidden = false
    hint.textContent = text
    statusHintTimer = window.setTimeout(hideStatusHint, duration)
}

function getStatusHintDuration(status: VisibleSubtitleStatus): number {
    if (status === 'starting' || status === 'catching-up') return 4_000
    if (status === 'buffered') return 2_000
    if (status === 'translation-failed' || status === 'no-track' || status === 'failed') return 5_000
    return 0
}

function hideStatusHint() {
    if (statusHintTimer !== null) {
        window.clearTimeout(statusHintTimer)
        statusHintTimer = null
    }
    const hint = document.getElementById(STATUS_HINT_ID)
    if (!hint) return
    hint.hidden = true
    hint.textContent = ''
}

function showForcedFastModeHint() {
    const button = document.getElementById(QUICK_BTN_ID) as HTMLButtonElement | null
    const hint = button ? ensureStatusHint(button) : null
    if (!button || !hint) return
    hideStatusHint()
    positionStatusHint(button, hint)
    hint.hidden = false
    hint.textContent = t('video.subtitleForcedFastMode')
    statusHintTimer = window.setTimeout(hideStatusHint, 5_000)
}

function resetStatusHintState() {
    hideStatusHint()
    document.getElementById(STATUS_HINT_ID)?.remove()
    lastVisibleStatus = null
    lastStatusHintAt.clear()
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
