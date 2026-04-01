import type { SubtitleCue } from './parser'
import { config } from '@/entrypoints/utils/config'

const OVERLAY_ID = 'fr-subtitle-overlay'

export class SubtitleOverlay {
    private container: HTMLElement | null = null
    private video: HTMLVideoElement | null = null
    private cues: SubtitleCue[] = []
    private rafId: number | null = null
    private lastCueKey: string | null = null  // 避免每帧重复 DOM 操作

    /** 在视频容器内创建字幕层，开始时间轴循环 */
    mount(video: HTMLVideoElement, mountTarget: HTMLElement) {
        this.video = video
        this.cleanup()

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
            'max-width:84%',
        ].join(';')

        // 确保挂载目标有定位上下文
        const pos = window.getComputedStyle(mountTarget).position
        if (pos === 'static') mountTarget.style.position = 'relative'

        mountTarget.appendChild(overlay)
        this.container = overlay
        this.startLoop()
    }

    /** 更新全部字幕数据（解析完成 / 翻译进度更新时调用） */
    setCues(cues: SubtitleCue[]) {
        this.cues = cues
        this.lastCueKey = null   // 强制刷新一次显示
    }

    show() {
        if (this.container) this.container.style.display = ''
    }

    hide() {
        if (this.container) this.container.style.display = 'none'
    }

    /** 停止渲染并移除 DOM */
    cleanup() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        document.getElementById(OVERLAY_ID)?.remove()
        this.container = null
        this.cues = []
        this.lastCueKey = null
    }

    // ── 内部方法 ──────────────────────────────────────────────────────────────

    private startLoop() {
        const tick = () => {
            if (!this.video || !this.container) return
            const t = this.video.currentTime
            const cue = this.findCue(t)
            const key = cue ? `${cue.start}~${cue.end}` : ''

            if (key !== this.lastCueKey) {
                this.lastCueKey = key
                this.render(cue)
            }
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
    }

    private findCue(time: number): SubtitleCue | null {
        let lo = 0, hi = this.cues.length - 1
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1
            const cue = this.cues[mid]
            if (time < cue.start) {
                hi = mid - 1
            } else if (time >= cue.end) {
                lo = mid + 1
            } else {
                return cue
            }
        }
        return null
    }

    private render(cue: SubtitleCue | null) {
        if (!this.container) return
        this.container.replaceChildren()
        if (!cue) return

        const isBilingual = config.display === 1   // 1 = 双语对照
        const hasTranslation = !!cue.translatedText

        const lineStyle = [
            'display:block',
            'background:rgba(8,8,8,0.80)',
            'color:#fff',
            'padding:4px 14px',
            'border-radius:4px',
            'font-size:18px',
            'line-height:1.65',
            'white-space:pre-wrap',
            'word-break:break-word',
            'text-align:center',
            'margin-bottom:4px',
        ].join(';')

        const originalStyle = lineStyle + ';opacity:0.75;font-size:15px'

        if (isBilingual && cue.text) {
            const div = document.createElement('div')
            div.style.cssText = originalStyle
            div.textContent = cue.text
            this.container.appendChild(div)
        }

        const mainDiv = document.createElement('div')
        mainDiv.style.cssText = lineStyle
        mainDiv.textContent = hasTranslation ? cue.translatedText! : cue.text
        this.container.appendChild(mainDiv)
    }
}
