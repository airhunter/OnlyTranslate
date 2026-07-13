import type { ParsedSubtitle, SubtitleCue, SubtitleFormat } from './types'

interface YouTubeSegment {
    utf8?: string
    tOffsetMs?: number
}

interface YouTubeEvent {
    tStartMs?: number
    dDurationMs?: number
    segs?: YouTubeSegment[]
    aAppend?: number
    wWinId?: number
    wpWinPosId?: number
}

const PROGRESSIVE_REDRAW_WINDOW_SECONDS = 0.4
const CJK_EDGE_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/

export type { SubtitleCue } from './types'

function decodeEntities(text: string): string {
    try {
        const doc = new DOMParser().parseFromString(text, 'text/html')
        return doc.documentElement.textContent || text
    } catch {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
    }
}

export function normalizeSubtitleText(text: string): string {
    return decodeEntities(String(text ?? ''))
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeJsonSegmentText(text: string): string {
    const source = decodeEntities(String(text ?? '')).replace(/\u200B/g, '').replace(/\u00A0/g, ' ')
    const hasLeadingSpace = /^\s/.test(source)
    const hasTrailingSpace = /\s$/.test(source)
    const core = source.replace(/\s+/g, ' ').trim()
    if (!core) return ''
    return `${hasLeadingSpace ? ' ' : ''}${core}${hasTrailingSpace ? ' ' : ''}`
}

function shouldInsertSpace(left: string, right: string): boolean {
    const leftChar = left.at(-1) ?? ''
    const rightChar = right[0] ?? ''
    if (!leftChar || !rightChar || /\s/.test(leftChar) || /\s/.test(rightChar)) return false
    if (CJK_EDGE_PATTERN.test(leftChar) || CJK_EDGE_PATTERN.test(rightChar)) return false
    return /[\p{L}\p{N}]/u.test(leftChar) && /[\p{L}\p{N}]/u.test(rightChar)
}

function joinSegmentTexts(segments: YouTubeSegment[]): string {
    let result = ''
    for (const segment of segments) {
        const text = normalizeJsonSegmentText(segment.utf8 ?? '')
        if (!text) continue
        if (result && shouldInsertSpace(result, text)) result += ' '
        result += text
    }
    return normalizeSubtitleText(result)
}

function arePrefixRelated(left: string, right: string): boolean {
    const normalizedLeft = normalizeSubtitleText(left).toLocaleLowerCase()
    const normalizedRight = normalizeSubtitleText(right).toLocaleLowerCase()
    return normalizedLeft === normalizedRight
        || normalizedLeft.startsWith(normalizedRight)
        || normalizedRight.startsWith(normalizedLeft)
}

function collapseRelatedCues(input: SubtitleCue[]): SubtitleCue[] {
    const cues = input
        .filter(cue => cue.text && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
        .sort((a, b) => a.start - b.start || a.end - b.end)

    const result: SubtitleCue[] = []
    for (const cue of cues) {
        const current = { ...cue, text: normalizeSubtitleText(cue.text) }
        const previous = result[result.length - 1]
        if (!previous) {
            result.push(current)
            continue
        }

        const closeInTime = current.start <= previous.end + PROGRESSIVE_REDRAW_WINDOW_SECONDS
        if (closeInTime && arePrefixRelated(previous.text, current.text)) {
            const longerText = current.text.length >= previous.text.length ? current.text : previous.text
            previous.text = longerText
            previous.start = Math.min(previous.start, current.start)
            previous.end = Math.max(previous.end, current.end)
            continue
        }

        result.push(current)
    }
    return result
}

export function parseYouTubeXML(xmlText: string): SubtitleCue[] {
    try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
        if (doc.querySelector('parsererror')) return []
        const cues: SubtitleCue[] = []
        doc.querySelectorAll('text').forEach(node => {
            const start = Number.parseFloat(node.getAttribute('start') || '0')
            const duration = Number.parseFloat(node.getAttribute('dur') || '0')
            const text = normalizeSubtitleText(node.textContent || '')
            if (text && Number.isFinite(start) && Number.isFinite(duration) && duration > 0) {
                cues.push({ start, end: start + duration, text })
            }
        })
        return collapseRelatedCues(cues)
    } catch {
        return []
    }
}

function vttTimeToSeconds(value: string): number {
    if (!value) return Number.NaN
    const parts = value.split(':')
    if (parts.length === 3) {
        return Number.parseInt(parts[0]) * 3600 + Number.parseInt(parts[1]) * 60 + Number.parseFloat(parts[2])
    }
    if (parts.length === 2) {
        return Number.parseInt(parts[0]) * 60 + Number.parseFloat(parts[1])
    }
    return Number.parseFloat(value)
}

function stripVttTags(text: string): string {
    return text.replace(/<[^>]+>/g, '')
}

export function parseVTT(vttText: string): SubtitleCue[] {
    const cues: SubtitleCue[] = []
    const blocks = vttText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\n+/)

    for (const block of blocks) {
        const lines = block.trim().split('\n')
        const timeLineIndex = lines.findIndex(line => line.includes('-->'))
        if (timeLineIndex < 0) continue

        const [startPart, endPart] = lines[timeLineIndex].split('-->')
        const start = vttTimeToSeconds(startPart.trim().split(/\s/)[0])
        const end = vttTimeToSeconds(endPart.trim().split(/\s/)[0])
        const text = normalizeSubtitleText(
            lines.slice(timeLineIndex + 1).map(stripVttTags).join(' '),
        )

        if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
            cues.push({ start, end, text })
        }
    }
    return collapseRelatedCues(cues)
}

function parseYouTubeEvents(jsonText: string): YouTubeEvent[] {
    try {
        const data = JSON.parse(jsonText) as { events?: YouTubeEvent[] }
        return Array.isArray(data.events) ? data.events : []
    } catch {
        return []
    }
}

function normalizeYouTubeEvents(events: YouTubeEvent[]): YouTubeEvent[] {
    const normalized: YouTubeEvent[] = []
    let previousVisibleKey = ''

    for (const event of events) {
        const segs = (event.segs ?? []).map(segment => ({
            ...segment,
            utf8: normalizeJsonSegmentText(segment.utf8 ?? ''),
        }))
        const text = joinSegmentTexts(segs)
        const key = `${event.tStartMs ?? 0}|${event.dDurationMs ?? 0}|${text}`

        if (text && key === previousVisibleKey) continue
        normalized.push({ ...event, segs })
        previousVisibleKey = text ? key : ''
    }
    return normalized
}

function getEventEndMs(events: YouTubeEvent[], index: number): number {
    const event = events[index]
    const start = event.tStartMs ?? 0
    const duration = event.dDurationMs ?? 0
    if (duration > 0) return start + duration
    const nextStart = events.slice(index + 1).find(next => (next.tStartMs ?? 0) > start)?.tStartMs
    return nextStart ?? start + 2000
}

function getVisibleEventEndMs(events: YouTubeEvent[], index: number): number {
    const event = events[index]
    const start = event.tStartMs ?? 0
    const defaultEnd = getEventEndMs(events, index)
    const timedBreak = (event.segs ?? []).find(segment => {
        const text = normalizeSubtitleText(segment.utf8 ?? '')
        return !text && (segment.tOffsetMs ?? 0) > 0
    })?.tOffsetMs
    return timedBreak === undefined ? defaultEnd : Math.min(defaultEnd, start + timedBreak)
}

function parseStandardJson3Events(events: YouTubeEvent[]): SubtitleCue[] {
    const cues: SubtitleCue[] = []
    for (let index = 0; index < events.length; index++) {
        const event = events[index]
        const text = joinSegmentTexts(event.segs ?? [])
        if (!text) continue
        const startMs = event.tStartMs ?? 0
        const endMs = getVisibleEventEndMs(events, index)
        if (endMs > startMs) cues.push({ start: startMs / 1000, end: endMs / 1000, text })
    }
    return collapseRelatedCues(cues)
}

function parseScrollingJson3Events(events: YouTubeEvent[]): SubtitleCue[] {
    const cues: SubtitleCue[] = []
    let bufferText = ''
    let bufferStartMs = 0
    let bufferEndMs = 0

    const flush = () => {
        const text = normalizeSubtitleText(bufferText)
        if (text && bufferEndMs > bufferStartMs) {
            cues.push({ start: bufferStartMs / 1000, end: bufferEndMs / 1000, text })
        }
        bufferText = ''
        bufferStartMs = 0
        bufferEndMs = 0
    }

    for (let index = 0; index < events.length; index++) {
        const event = events[index]
        const text = joinSegmentTexts(event.segs ?? [])
        const startMs = event.tStartMs ?? 0
        const endMs = getVisibleEventEndMs(events, index)

        if (event.aAppend === 1 && !text) {
            if (bufferText) bufferEndMs = Math.max(bufferEndMs, endMs)
            flush()
            continue
        }
        if (!text) continue

        if (!bufferText) bufferStartMs = startMs
        if (bufferText && shouldInsertSpace(bufferText, text)) bufferText += ' '
        bufferText += text
        bufferEndMs = Math.max(bufferEndMs, endMs)
    }
    flush()
    return collapseRelatedCues(cues)
}

function isScrollingJson3(events: YouTubeEvent[]): boolean {
    return events.some(event => event.wWinId !== undefined && event.aAppend === 1)
}

export function parseYouTubeJSON3(jsonText: string): SubtitleCue[] {
    const events = normalizeYouTubeEvents(parseYouTubeEvents(jsonText))
    return isScrollingJson3(events)
        ? parseScrollingJson3Events(events)
        : parseStandardJson3Events(events)
}

export function detectSubtitleFormat(
    url: string,
    data: string,
): 'youtube-xml' | 'youtube-json3' | 'vtt' | null {
    if (data.trimStart().startsWith('WEBVTT')) return 'vtt'
    if (/\.vtt(?:\?|#|$)/i.test(url)) return 'vtt'
    if (data.trimStart().startsWith('{')) return 'youtube-json3'
    if (data.includes('<transcript') || data.includes('<text ')) return 'youtube-xml'
    if (url.includes('/api/timedtext')) return 'youtube-xml'
    return null
}

function getSourceLanguage(url: string): string | undefined {
    try {
        const parsed = new URL(url, window.location.href)
        if (!parsed.pathname.includes('/api/timedtext')) return undefined
        return parsed.searchParams.get('tlang')
            || parsed.searchParams.get('lang')
            || undefined
    } catch {
        return undefined
    }
}

export function parseSubtitleData(url: string, data: string): ParsedSubtitle | null {
    const detectedFormat = detectSubtitleFormat(url, data)
    if (!detectedFormat) return null

    let cues: SubtitleCue[]
    let format: SubtitleFormat = detectedFormat
    if (detectedFormat === 'youtube-json3') {
        const events = normalizeYouTubeEvents(parseYouTubeEvents(data))
        const scrolling = isScrollingJson3(events)
        cues = scrolling ? parseScrollingJson3Events(events) : parseStandardJson3Events(events)
        format = scrolling ? 'youtube-json3-scrolling' : 'youtube-json3'
    } else if (detectedFormat === 'youtube-xml') {
        cues = parseYouTubeXML(data)
    } else {
        cues = parseVTT(data)
    }

    return {
        cues,
        format,
        sourceLanguage: getSourceLanguage(url),
    }
}
