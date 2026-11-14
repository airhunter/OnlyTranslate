import type { SubtitleSegment } from './types'
import { config } from '@/entrypoints/utils/config'

const OVERLAY_ID = 'fr-subtitle-overlay'
const NATIVE_CONTROL_AREA_HEIGHT = 80
const X_CONTROL_AREA_HEIGHT = 72

export class SubtitleOverlay {
    private container: HTMLElement | null = null
    private video: HTMLVideoElement | null = null
    private segments: SubtitleSegment[] = []
    private rafId: number | null = null
    private lastRenderKey: string | null = null
    private mountTarget: HTMLElement | undefined
    private originalMountPosition: string | undefined
    private useNativeFullscreen = false
    private visible = true
    private readonly nativeTracks = new WeakMap<HTMLVideoElement, TextTrack>()
    private nativeTrack: TextTrack | null = null
    private nativeCue: VTTCue | null = null

    mount(video: HTMLVideoElement, mountTarget: HTMLElement, useNativeFullscreen = false) {
        this.cleanup()
        this.video = video
        this.visible = true
        this.useNativeFullscreen = useNativeFullscreen

        const overlay = document.createElement('div')
        overlay.id = OVERLAY_ID
        overlay.style.cssText = [
            'position:absolute',
            'bottom:8%',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:2147483640',
            'text-align:center',
            'pointer-events:none',
            'width:max-content',
            'max-width:94%',
        ].join(';')

        if (window.getComputedStyle(mountTarget).position === 'static') {
            this.originalMountPosition = mountTarget.style.position
            mountTarget.style.position = 'relative'
        }

        mountTarget.appendChild(overlay)
        this.mountTarget = mountTarget
        this.container = overlay
        if (useNativeFullscreen) {
            mountTarget.addEventListener('pointermove', this.handlePointerMove)
            mountTarget.addEventListener('pointerleave', this.restoreCaptionOpacity)
            mountTarget.addEventListener('focusin', this.handleControlFocus)
            mountTarget.addEventListener('focusout', this.restoreCaptionOpacity)
        }
        this.startLoop()
    }

    setSegments(segments: SubtitleSegment[]) {
        this.segments = segments
        this.lastRenderKey = null
        this.render(this.findSegment(this.video?.currentTime ?? -1))
    }

    show() {
        this.visible = true
        this.lastRenderKey = null
        if (this.container) this.container.style.display = ''
    }

    hide() {
        this.visible = false
        this.clearNativeTrack()
        if (this.container) this.container.style.display = 'none'
    }

    cleanup() {
        this.clearNativeTrack()
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        this.container?.remove()
        if (this.useNativeFullscreen && this.mountTarget) {
            this.mountTarget.removeEventListener('pointermove', this.handlePointerMove)
            this.mountTarget.removeEventListener('pointerleave', this.restoreCaptionOpacity)
            this.mountTarget.removeEventListener('focusin', this.handleControlFocus)
            this.mountTarget.removeEventListener('focusout', this.restoreCaptionOpacity)
        }
        if (this.mountTarget !== undefined && this.originalMountPosition !== undefined) {
            this.mountTarget.style.position = this.originalMountPosition
        }
        this.container = null
        this.video = null
        this.segments = []
        this.lastRenderKey = null
        this.mountTarget = undefined
        this.originalMountPosition = undefined
        this.useNativeFullscreen = false
    }

    private isInControlArea(x: number, y: number): boolean {
        if (!this.video || !this.container) return false
        const bounds = this.video.getBoundingClientRect()
        const height = this.video.controls ? NATIVE_CONTROL_AREA_HEIGHT : X_CONTROL_AREA_HEIGHT
        const scale = this.video.offsetHeight ? bounds.height / this.video.offsetHeight : 1
        const controlTop = bounds.bottom - height * scale
        return x >= bounds.left && x <= bounds.right
            && y >= controlTop && y <= bounds.bottom
            && this.container.getBoundingClientRect().bottom > controlTop
    }

    private handlePointerMove = (event: PointerEvent) => {
        if (!this.container) return
        this.container.style.opacity = this.isInControlArea(event.clientX, event.clientY) ? '0' : ''
    }

    private handleControlFocus = (event: FocusEvent) => {
        if (!this.container || !(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) return
        const bounds = event.target.getBoundingClientRect()
        const y = event.target === this.video ? bounds.bottom : bounds.top + bounds.height / 2
        if (this.isInControlArea(bounds.left + bounds.width / 2, y)) this.container.style.opacity = '0'
    }

    private restoreCaptionOpacity = () => {
        if (this.container) this.container.style.opacity = ''
    }

    private startLoop() {
        const tick = () => {
            if (!this.video || !this.container) return
            const segment = this.findSegment(this.video.currentTime)
            const fullscreen = this.fullscreenMode()
            const segmentKey = segment
                ? `${segment.id}|${segment.status}|${segment.translatedText ?? ''}`
                : ''
            const key = `${fullscreen}|${segmentKey}`

            if (key !== this.lastRenderKey) {
                this.lastRenderKey = key
                this.render(segment)
            }
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
    }

    private findSegment(time: number): SubtitleSegment | null {
        let left = 0
        let right = this.segments.length - 1
        while (left <= right) {
            const mid = (left + right) >>> 1
            const segment = this.segments[mid]
            if (time < segment.start) {
                right = mid - 1
            } else if (time >= segment.end) {
                left = mid + 1
            } else {
                return segment
            }
        }
        return null
    }

    private createLine(text: string, original: boolean, fullscreen: boolean): HTMLDivElement {
        const line = document.createElement('div')
        let fontSize = original ? '18px' : '22px'
        if (this.useNativeFullscreen) {
            fontSize = fullscreen
                ? (original ? 'clamp(20px, 2.3vw, 30px)' : 'clamp(24px, 2.8vw, 36px)')
                : (original ? '14px' : '17px')
        }
        line.style.cssText = [
            'display:block',
            'background:rgba(8,8,8,0.80)',
            'color:#fff',
            'padding:4px 14px',
            'border-radius:4px',
            `font-size:${fontSize}`,
            this.useNativeFullscreen ? 'line-height:1.4' : 'line-height:1.65',
            'white-space:pre-wrap',
            'word-break:break-word',
            'text-align:center',
            'margin-bottom:4px',
            original ? 'opacity:0.75' : '',
        ].filter(Boolean).join(';')
        line.textContent = text
        return line
    }

    private fullscreenMode(): 'native' | 'player' | 'none' {
        if (!this.useNativeFullscreen) return 'none'
        let fullscreen = document.fullscreenElement
        while (fullscreen?.shadowRoot?.fullscreenElement) fullscreen = fullscreen.shadowRoot.fullscreenElement
        if (fullscreen === this.video) return 'native'
        let node: Node | null = this.container
        while (node) {
            if (node === fullscreen) return 'player'
            node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null)
        }
        return 'none'
    }

    private clearNativeTrack() {
        if (!this.nativeTrack) return
        if (this.nativeCue) this.nativeTrack.removeCue(this.nativeCue)
        this.nativeTrack.mode = 'disabled'
        this.nativeTrack = null
        this.nativeCue = null
    }

    private renderNativeCaption(segment: SubtitleSegment | null, text = '') {
        if (!this.video || typeof VTTCue !== 'function') return
        if (!segment && !this.nativeCue) return
        if (!this.nativeTrack) {
            // A source-less <track> fails to load in Chromium and can discard programmatic cues.
            const track = this.nativeTracks.get(this.video) ?? this.video.addTextTrack('subtitles', 'OnlyTranslate')
            this.nativeTracks.set(this.video, track)
            track.mode = 'showing'
            this.nativeTrack = track
        }
        const track = this.nativeTrack
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        if (this.nativeCue && segment && this.nativeCue.text === escaped
            && this.nativeCue.startTime === segment.start && this.nativeCue.endTime === segment.end) return
        if (this.nativeCue) track.removeCue(this.nativeCue)
        this.nativeCue = segment ? new VTTCue(segment.start, segment.end, escaped) : null
        if (this.nativeCue) track.addCue(this.nativeCue)
    }

    private render(segment: SubtitleSegment | null) {
        if (!this.container || !this.visible) return
        const fullscreen = this.fullscreenMode()
        this.container.style.position = fullscreen === 'player' ? 'fixed' : 'absolute'
        this.container.replaceChildren()
        if (fullscreen !== 'native') this.clearNativeTrack()
        if (!segment) {
            if (fullscreen === 'native') this.renderNativeCaption(null)
            return
        }

        const translatedText = segment.status === 'translated'
            && segment.translatedText
            && segment.translatedText.trim() !== segment.sourceText.trim()
            ? segment.translatedText
            : undefined
        const bilingual = config.display === 1

        if (fullscreen === 'native') {
            const text = bilingual && translatedText
                ? `${segment.sourceText}\n${translatedText}` : translatedText ?? segment.sourceText
            this.renderNativeCaption(segment, text)
            return
        }
        if (bilingual && translatedText) {
            this.container.append(
                this.createLine(segment.sourceText, true, fullscreen === 'player'),
                this.createLine(translatedText, false, fullscreen === 'player'),
            )
            return
        }

        this.container.appendChild(this.createLine(translatedText ?? segment.sourceText, false, fullscreen === 'player'))
    }
}
