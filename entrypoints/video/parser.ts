export interface SubtitleCue {
    start: number           // 开始时间（秒）
    end: number             // 结束时间（秒）
    text: string            // 原文
    translatedText?: string // 译文（翻译后填入）
}

// ── YouTube timedtext XML ─────────────────────────────────────────────────────
// 格式：<transcript><text start="0.5" dur="2.3">Hello</text></transcript>
export function parseYouTubeXML(xmlText: string): SubtitleCue[] {
    try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
        if (doc.querySelector('parsererror')) return []
        const raw: SubtitleCue[] = []
        doc.querySelectorAll('text').forEach(node => {
            const start = parseFloat(node.getAttribute('start') || '0')
            const dur   = parseFloat(node.getAttribute('dur')   || '0')
            const text  = decodeEntities(node.textContent || '').trim()
            if (text) raw.push({ start, end: start + dur, text })
        })
        // YouTube timedtext 会产生时间重叠的 cue（滚动字幕效果），
        // 合并重叠 cue 使碎片句回归完整，减少翻译时的上下文割裂
        return mergeOverlappingCues(raw)
    } catch {
        return []
    }
}

/** 合并时间上有重叠的相邻 cue，文本以空格拼接，时间取并集 */
function mergeOverlappingCues(cues: SubtitleCue[]): SubtitleCue[] {
    if (!cues.length) return cues
    const merged: SubtitleCue[] = [{ ...cues[0] }]
    for (let i = 1; i < cues.length; i++) {
        const prev = merged[merged.length - 1]
        const cur  = cues[i]
        if (cur.start < prev.end) {
            // 重叠：合并文本，延伸结束时间
            prev.text = prev.text + ' ' + cur.text
            prev.end  = Math.max(prev.end, cur.end)
        } else {
            merged.push({ ...cur })
        }
    }
    return merged
}

// ── WebVTT ────────────────────────────────────────────────────────────────────
export function parseVTT(vttText: string): SubtitleCue[] {
    const cues: SubtitleCue[] = []
    // 统一换行符，按空行分割 cue 块
    const blocks = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/)

    for (const block of blocks) {
        const lines = block.trim().split('\n')
        // 找到包含 --> 的时间行
        const timeLine = lines.find(l => l.includes('-->'))
        if (!timeLine) continue

        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim().split(/\s/)[0])
        const start = vttTimeToSeconds(startStr)
        const end   = vttTimeToSeconds(endStr)

        // 时间行之后的行为字幕文本（去掉 VTT 内联标签）
        const textLines = lines
            .slice(lines.indexOf(timeLine) + 1)
            .map(l => stripVttTags(l))
            .filter(l => l.trim())

        const text = textLines.join(' ').trim()
        if (text) cues.push({ start, end, text })
    }
    return cues
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────
function vttTimeToSeconds(t: string): number {
    if (!t) return 0
    const parts = t.split(':')
    if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
    } else if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1])
    }
    return parseFloat(t) || 0
}

function stripVttTags(text: string): string {
    // 去掉 <c.color>, <00:00:00.000>, <i>, <b> 等 VTT 标签
    return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
}

function decodeEntities(text: string): string {
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html')
        return doc.documentElement.textContent || text
    } catch {
        return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    }
}

// ── YouTube timedtext JSON3 ───────────────────────────────────────────────────
// 格式：{"events":[{"tStartMs":0,"dDurationMs":5000,"segs":[{"utf8":"Hello"}]},...]}
export function parseYouTubeJSON3(jsonText: string): SubtitleCue[] {
    try {
        const data = JSON.parse(jsonText)
        if (!data.events) return []
        const cues: SubtitleCue[] = []
        for (const event of data.events) {
            if (!event.segs) continue
            const text = event.segs.map((s: { utf8?: string }) => s.utf8 || '').join('').trim()
            if (!text || text === '\n') continue
            const start = (event.tStartMs || 0) / 1000
            const end   = start + (event.dDurationMs || 0) / 1000
            cues.push({ start, end, text })
        }
        return cues
    } catch {
        return []
    }
}

/**
 * 自动检测字幕格式
 */
export function detectSubtitleFormat(url: string, data: string): 'youtube-xml' | 'youtube-json3' | 'vtt' | null {
    if (data.trimStart().startsWith('WEBVTT')) return 'vtt'
    if (url.match(/\.vtt(\?|#|$)/i)) return 'vtt'
    if (data.trimStart().startsWith('{')) return 'youtube-json3'
    if (data.includes('<transcript') || data.includes('<text ')) return 'youtube-xml'
    if (url.includes('/api/timedtext')) return 'youtube-xml'
    return null
}
