import { detectPlatform, getAllSubtitlePatterns } from './platforms'
import { detectSubtitleFormat, parseYouTubeXML, parseYouTubeJSON3, parseVTT, type SubtitleCue } from './parser'
import { SubtitleOverlay } from './overlay'
import { translateText } from '@/entrypoints/utils/translateApi'
import { config } from '@/entrypoints/utils/config'

// ── 常量 ──────────────────────────────────────────────────────────────────────
const EVENT_TYPE = 'fr-subtitle-inject'
const BATCH_SIZE = 5          // 每批翻译的句子组数
const MERGE_GAP_MS  = 600    // 相邻 cue 间隔 < 此值（毫秒）则合并为同一句
const MAX_WORDS     = 20     // 单组超过此词数强制断开
const QUICK_BTN_ID = 'fr-subtitle-quick-btn'

// ── 类型 ──────────────────────────────────────────────────────────────────────
interface SentenceGroup {
    cues: SubtitleCue[]
    text: string
}

// ── 模块状态 ──────────────────────────────────────────────────────────────────
const overlay = new SubtitleOverlay()
let listenerAttached = false
let processingUrl = ''   // 去重：同一字幕 URL 只翻译一次
let subtitleEnabled = true

// ── 公开入口 ──────────────────────────────────────────────────────────────────

/** 由 content.ts 调用，初始化视频字幕翻译 */
export function initVideoSubtitle() {
    console.log('[FR] initVideoSubtitle called, enableVideoSubtitle=', config.enableVideoSubtitle, 'hostname=', window.location.hostname)
    if (!config.enableVideoSubtitle) return
    // 拦截脚本已由 WXT 以 MAIN world content script 形式在 document_start 注入，
    // 此处只需推送动态配置并开始监听消息。
    sendConfig()
    attachMessageListener()
    watchNavigation()
    // 在 YouTube 上立即挂载快捷按钮，无需等待字幕捕获
    if (window.location.hostname.includes('youtube.com')) {
        console.log('[FR] on YouTube, calling mountQuickButton')
        mountQuickButton()
    }
}

// ── 私有实现 ──────────────────────────────────────────────────────────────────

/** 向注入脚本发送字幕 URL 正则列表（动态更新，覆盖注入脚本内置的默认规则） */
function sendConfig() {
    window.postMessage({
        eventType: EVENT_TYPE,
        type: 'config',
        patterns: getAllSubtitlePatterns(),
    }, '*')
}

/** 监听来自注入脚本的 postMessage */
function attachMessageListener() {
    if (listenerAttached) return
    listenerAttached = true

    window.addEventListener('message', async (event) => {
        if (event.source !== window) return
        const msg = event.data
        if (!msg || msg.eventType !== EVENT_TYPE) return

        if (msg.type === 'subtitle-captured') {
            const { url, data } = msg
            if (!url || !data) return
            if (!subtitleEnabled) return
            // 同一 URL 不重复处理
            if (url === processingUrl) return
            processingUrl = url
            try {
                await handleSubtitleData(url, data)
            } finally {
                processingUrl = ''
            }
        }
    })
}

/** 解析字幕 → 初始化 overlay → 批量翻译 */
async function handleSubtitleData(url: string, rawData: string) {
    const format = detectSubtitleFormat(url, rawData)
    if (!format) return

    const cues: SubtitleCue[] =
        format === 'youtube-xml'   ? parseYouTubeXML(rawData) :
        format === 'youtube-json3' ? parseYouTubeJSON3(rawData) :
        parseVTT(rawData)

    if (!cues.length) return

    const video = findVideo()
    if (!video) return

    const mountTarget = findMountTarget(video)
    overlay.mount(video, mountTarget)
    overlay.setCues([...cues])   // 先用原文渲染，避免空白等待

    hideNativeSubtitle()
    mountQuickButton()

    // 分批翻译，边翻译边更新 overlay
    await translateCuesBatched(cues, () => overlay.setCues([...cues]))
}

/**
 * 按时间间隔合并相邻 cue：
 * - 相邻两条 cue 的间隔 < MERGE_GAP_MS → 合并为同一句（说话中的正常停顿）
 * - 间隔 ≥ MERGE_GAP_MS 或词数超过 MAX_WORDS → 断开（句子之间的自然停顿）
 * 这样"united states"等跨 cue 短语能被合并进同一组，避免词级切断的翻译错误。
 */
function mergeByTimeGap(cues: SubtitleCue[]): SentenceGroup[] {
    const groups: SentenceGroup[] = []
    let current: SubtitleCue[] = []

    const flush = (arr: SubtitleCue[]) => groups.push({
        cues: [...arr],
        text: arr.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim(),
    })

    for (let i = 0; i < cues.length; i++) {
        current.push(cues[i])
        const next = cues[i + 1]
        const wordCount = current.reduce((n, c) => n + c.text.split(/\s+/).length, 0)
        const gapMs = next ? (next.start - cues[i].end) * 1000 : Infinity
        const bigGap = !next || gapMs >= MERGE_GAP_MS
        const tooLong = wordCount >= MAX_WORDS

        if (bigGap || tooLong) {
            if (tooLong && !bigGap && current.length > 1) {
                // 词数超限但下一条紧跟（小间隔）→ 末尾 cue 进位到下一组，
                // 避免碎片句（如 "but the seeds"）因超限被孤立
                const carryOver = current.pop()!
                flush(current)
                current = [carryOver]
            } else {
                flush(current)
                current = []
            }
        }
    }
    if (current.length) flush(current)
    return groups
}

/**
 * 将 cue 按时间间隔合并为句子组后批量翻译。
 * 组内所有 cue 共享同一译文，消除跨 cue 词级切断问题。
 */
async function translateCuesBatched(cues: SubtitleCue[], onProgress: () => void) {
    const groups = mergeByTimeGap(cues)
    const instruction =
        'Video subtitle segments. Translate each [N] line. ' +
        'Return the same number of [N] lines, no extra explanation.\n\n'

    for (let i = 0; i < groups.length; i += BATCH_SIZE) {
        const batch = groups.slice(i, i + BATCH_SIZE)

        const prevContext = i > 0
            ? `[context: ...${groups[i - 1].text.split(' ').slice(-8).join(' ')}]\n`
            : ''

        const joined = instruction + prevContext
            + batch.map((g, j) => `[${j + 1}] ${g.text}`).join('\n')

        try {
            const translated = await translateText(joined, document.title)
            const map = new Map<number, string>()
            for (const line of translated.split('\n')) {
                const m = line.match(/^\[(\d+)\]\s*(.*)/)
                if (m) map.set(parseInt(m[1]), m[2].trim())
            }
            batch.forEach((group, j) => {
                const translation = map.get(j + 1) || group.text
                group.cues.forEach(cue => { cue.translatedText = translation })
            })
        } catch {
            batch.forEach(group => {
                group.cues.forEach(cue => { cue.translatedText = cue.text })
            })
        }

        onProgress()
    }
}

// ── YouTube 工具栏快捷按钮 ─────────────────────────────────────────────────────

/**
 * 在 YouTube 播放器右侧控制栏注入一个翻译开关按钮。
 * 点击可切换字幕翻译的显示/隐藏，不影响原生字幕。
 */
function mountQuickButton() {
    console.log('[FR] mountQuickButton called, existing=', !!document.getElementById(QUICK_BTN_ID))
    if (document.getElementById(QUICK_BTN_ID)) return

    // YouTube 右侧控制栏，等待其出现
    console.log('[FR] waiting for .ytp-right-controls, current=', document.querySelector('.ytp-right-controls'))
    waitForElement('.ytp-right-controls', (controls) => {
        console.log('[FR] .ytp-right-controls found, inserting button')
        if (document.getElementById(QUICK_BTN_ID)) return

        const btn = document.createElement('button')
        btn.id = QUICK_BTN_ID
        btn.title = '流畅阅读：字幕翻译'
        btn.setAttribute('aria-label', '字幕翻译')
        btn.style.cssText = [
            'background:transparent',
            'border:none',
            'cursor:pointer',
            'padding:0 6px',
            'height:100%',
            'display:inline-flex',
            'align-items:center',
            'opacity:0.9',
            'vertical-align:top',
        ].join(';')

        btn.appendChild(buildBtnSvg(subtitleEnabled))

        btn.addEventListener('click', () => {
            subtitleEnabled = !subtitleEnabled
            btn.replaceChildren(buildBtnSvg(subtitleEnabled))
            btn.title = subtitleEnabled ? '流畅阅读：字幕翻译（开）' : '流畅阅读：字幕翻译（关）'
            if (subtitleEnabled) {
                hideNativeSubtitle()
                overlay.show()
            } else {
                overlay.hide()
                restoreNativeSubtitle()
            }
        })

        // 插入到右侧控制栏最左边
        controls.prepend(btn)
    })
}

function buildBtnSvg(active: boolean): SVGElement {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', active ? '#fff' : 'rgba(255,255,255,0.4)')
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z')
    svg.appendChild(path)
    return svg
}

/** 轮询等待目标元素出现 */
function waitForElement(selector: string, callback: (el: Element) => void, maxMs = 10000) {
    const el = document.querySelector(selector)
    if (el) { callback(el); return }

    const start = Date.now()
    const timer = setInterval(() => {
        const found = document.querySelector(selector)
        if (found) {
            clearInterval(timer)
            callback(found)
        } else if (Date.now() - start > maxMs) {
            clearInterval(timer)
        }
    }, 300)
}

// ── DOM 工具 ──────────────────────────────────────────────────────────────────

function findVideo(): HTMLVideoElement | null {
    const platform = detectPlatform(window.location.hostname)
    if (platform.videoSelector) {
        const v = document.querySelector<HTMLVideoElement>(platform.videoSelector)
        if (v) return v
    }
    return document.querySelector<HTMLVideoElement>('video')
}

function findMountTarget(video: HTMLVideoElement): HTMLElement {
    const platform = detectPlatform(window.location.hostname)
    if (platform.containerSelector) {
        const el = document.querySelector<HTMLElement>(platform.containerSelector)
        if (el) return el
    }
    return (video.parentElement as HTMLElement) || document.body
}

function hideNativeSubtitle() {
    const platform = detectPlatform(window.location.hostname)
    if (!platform.hideNativeSelector) return
    // 用 display:none 彻底隐藏，visibility:hidden 仍占位且有时被 YouTube 重置
    document.querySelectorAll<HTMLElement>(platform.hideNativeSelector)
        .forEach(el => el.style.setProperty('display', 'none', 'important'))
}

function restoreNativeSubtitle() {
    const platform = detectPlatform(window.location.hostname)
    if (!platform.hideNativeSelector) return
    document.querySelectorAll<HTMLElement>(platform.hideNativeSelector)
        .forEach(el => el.style.removeProperty('display'))
}

// ── SPA 导航监听 ──────────────────────────────────────────────────────────────

function watchNavigation() {
    let lastUrl = location.href

    const onUrlChange = () => {
        const cur = location.href
        if (cur !== lastUrl) {
            lastUrl = cur
            overlay.cleanup()
            document.getElementById(QUICK_BTN_ID)?.remove()
            processingUrl = ''
            subtitleEnabled = true
            restoreNativeSubtitle()
            // SPA 导航到视频页时重新挂载按钮
            if (window.location.hostname.includes('youtube.com')) {
                mountQuickButton()
            }
        }
    }

    window.addEventListener('yt-navigate-finish', onUrlChange)

    const titleEl = document.querySelector('title')
    if (titleEl) {
        new MutationObserver(onUrlChange).observe(titleEl, { childList: true })
    }
}
