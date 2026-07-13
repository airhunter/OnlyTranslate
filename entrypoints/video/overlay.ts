import type { SubtitleSegment } from './types'
import { config } from '@/entrypoints/utils/config'

const OVERLAY_ID = 'fr-subtitle-overlay'

export class SubtitleOverlay {
    private container: HTMLElement | null = null
    private video: HTMLVideoElement | null = null
    private segments: SubtitleSegment[] = []
    private rafId: number | null = null
    private lastRenderKey: string | null = null
    private mountTarget: HTMLElement | undefined
    private originalMountPosition: string | undefined

    mount(video: HTMLVideoElement, mountTarget: HTMLElement) {
        this.cleanup()
        this.video = video

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
        this.startLoop()
    }

    setSegments(segments: SubtitleSegment[]) {
        this.segments = segments
        this.lastRenderKey = null
        this.render(this.findSegment(this.video?.currentTime ?? -1))
    }

    show() {
        if (this.container) this.container.style.display = ''
    }

    hide() {
        if (this.container) this.container.style.display = 'none'
    }

    cleanup() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        this.container?.remove()
        if (this.mountTarget !== undefined && this.originalMountPosition !== undefined) {
            this.mountTarget.style.position = this.originalMountPosition
        }
        this.container = null
        this.video = null
        this.segments = []
        this.lastRenderKey = null
        this.mountTarget = undefined
        this.originalMountPosition = undefined
    }

    private startLoop() {
        const tick = () => {
            if (!this.video || !this.container) return
            const segment = this.findSegment(this.video.currentTime)
            const key = segment
                ? `${segment.id}|${segment.status}|${segment.translatedText ?? ''}`
                : ''

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

    private createLine(text: string, original = false): HTMLDivElement {
        const line = document.createElement('div')
        line.style.cssText = [
            'display:block',
            'background:rgba(8,8,8,0.80)',
            'color:#fff',
            'padding:4px 14px',
            'border-radius:4px',
            `font-size:${original ? '18px' : '22px'}`,
            'line-height:1.65',
            'white-space:pre-wrap',
            'word-break:break-word',
            'text-align:center',
            'margin-bottom:4px',
            original ? 'opacity:0.75' : '',
        ].filter(Boolean).join(';')
        line.textContent = text
        return line
    }

    private render(segment: SubtitleSegment | null) {
        if (!this.container) return
        this.container.replaceChildren()
        if (!segment) return

        const translatedText = segment.status === 'translated'
            && segment.translatedText
            && segment.translatedText.trim() !== segment.sourceText.trim()
            ? segment.translatedText
            : undefined
        const bilingual = config.display === 1

        if (bilingual && translatedText) {
            this.container.append(
                this.createLine(segment.sourceText, true),
                this.createLine(translatedText),
            )
            return
        }

        this.container.appendChild(this.createLine(translatedText ?? segment.sourceText))
    }
}
