import type { SubtitleCue, SubtitleSegment } from './types'

const HARD_GAP_SECONDS = 1
const MAX_DURATION_SECONDS = 10
const MAX_WORDS = 20
const MAX_CJK_CHARACTERS = 30
const MIN_WORDS_FOR_PUNCTUATION_SPLIT = 6
const MIN_CJK_FOR_PUNCTUATION_SPLIT = 10
const SENTENCE_END_PATTERN = /[.!?\u3002\uff01\uff1f\uff1b;\u2026]$/
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g
const CJK_CHARACTER_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/

export const segmenterVersion = 2

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

function countCjkCharacters(text: string): number {
    return text.match(CJK_PATTERN)?.length ?? 0
}

function isCjkText(text: string, languageHint?: string): boolean {
    if (languageHint && /^(zh|ja|ko)(-|$)/i.test(languageHint)) return true
    const compactLength = text.replace(/\s/g, '').length
    return compactLength > 0 && countCjkCharacters(text) / compactLength >= 0.4
}

function joinCueText(cues: SubtitleCue[], cjk: boolean): string {
    return cues.map(cue => cue.text).join(cjk ? '' : ' ').replace(/\s+/g, ' ').trim()
}

function hasEnoughContentForPunctuationSplit(text: string, cjk: boolean): boolean {
    return cjk
        ? countCjkCharacters(text) >= MIN_CJK_FOR_PUNCTUATION_SPLIT
        : countWords(text) >= MIN_WORDS_FOR_PUNCTUATION_SPLIT
}

function wouldExceedLength(text: string, cjk: boolean): boolean {
    return cjk
        ? countCjkCharacters(text) > MAX_CJK_CHARACTERS
        : countWords(text) > MAX_WORDS
}

function groupDuration(cues: SubtitleCue[]): number {
    if (!cues.length) return 0
    return Math.max(...cues.map(cue => cue.end)) - cues[0].start
}

function splitLongCue(cue: SubtitleCue): SubtitleCue[] {
    if (cue.end - cue.start <= MAX_DURATION_SECONDS) return [cue]

    const slices: SubtitleCue[] = []
    for (let start = cue.start; start < cue.end; start += MAX_DURATION_SECONDS) {
        slices.push({
            ...cue,
            start,
            end: Math.min(cue.end, start + MAX_DURATION_SECONDS),
        })
    }
    return slices
}

function splitOversizedCueText(cue: SubtitleCue, languageHint?: string): SubtitleCue[] {
    const cjk = isCjkText(cue.text, languageHint)
    let textChunks: string[] = []

    if (cjk) {
        let chunk = ''
        let cjkCharacters = 0
        for (const character of Array.from(cue.text)) {
            const isCjkCharacter = CJK_CHARACTER_PATTERN.test(character)
            if (isCjkCharacter && cjkCharacters >= MAX_CJK_CHARACTERS && chunk.trim()) {
                textChunks.push(chunk.trim())
                chunk = ''
                cjkCharacters = 0
            }
            chunk += character
            if (isCjkCharacter) cjkCharacters++
        }
        if (chunk.trim()) textChunks.push(chunk.trim())
    } else {
        const words = cue.text.trim().split(/\s+/).filter(Boolean)
        for (let index = 0; index < words.length; index += MAX_WORDS) {
            textChunks.push(words.slice(index, index + MAX_WORDS).join(' '))
        }
    }

    if (textChunks.length <= 1) return [cue]
    const duration = cue.end - cue.start
    return textChunks.map((text, index) => ({
        ...cue,
        start: cue.start + duration * index / textChunks.length,
        end: cue.start + duration * (index + 1) / textChunks.length,
        text,
    }))
}

function isValidGroup(cues: SubtitleCue[], languageHint?: string): boolean {
    if (!cues.length) return false

    const text = cues.map(cue => cue.text).join(' ')
    const cjk = isCjkText(text, languageHint)
    if (groupDuration(cues) > MAX_DURATION_SECONDS || wouldExceedLength(text, cjk)) return false

    for (let index = 1; index < cues.length; index++) {
        const previous = cues[index - 1]
        const currentText = cues.slice(0, index).map(cue => cue.text).join(' ')
        if (cues[index].start - previous.end >= HARD_GAP_SECONDS) return false
        if (SENTENCE_END_PATTERN.test(previous.text.trim())
            && hasEnoughContentForPunctuationSplit(currentText, cjk)) {
            return false
        }
    }

    return true
}

function rebalanceRegionTail(groups: SubtitleCue[][], languageHint?: string): void {
    if (groups.length < 2) return

    const left = groups[groups.length - 2]
    const right = groups[groups.length - 1]
    if (right.length !== 1 || left.length < 3) return

    const nextLeft = left.slice(0, -1)
    const nextRight = [left[left.length - 1], ...right]
    if (!isValidGroup(nextLeft, languageHint) || !isValidGroup(nextRight, languageHint)) return

    groups[groups.length - 2] = nextLeft
    groups[groups.length - 1] = nextRight
}

function separateEqualStartSegments(segments: SubtitleSegment[]): void {
    let groupStart = 0
    while (groupStart < segments.length) {
        let groupEnd = groupStart + 1
        while (
            groupEnd < segments.length
            && segments[groupEnd].start === segments[groupStart].start
        ) groupEnd++

        const count = groupEnd - groupStart
        if (count > 1) {
            const start = segments[groupStart].start
            const nextDistinctStart = segments[groupEnd]?.start
            const sharedEnd = Math.min(...segments
                .slice(groupStart, groupEnd)
                .map(segment => segment.end))
            const latestEnd = Math.max(...segments
                .slice(groupStart, groupEnd)
                .map(segment => segment.end))
            const allocationEnd = nextDistinctStart === undefined
                ? sharedEnd
                : Math.min(sharedEnd, nextDistinctStart)
            const sliceDuration = (allocationEnd - start) / count
            for (let offset = 0; offset < count; offset++) {
                const segment = segments[groupStart + offset]
                segment.start = start + sliceDuration * offset
                segment.end = offset === count - 1
                    ? Math.min(latestEnd, nextDistinctStart ?? latestEnd)
                    : start + sliceDuration * (offset + 1)
            }
        }
        groupStart = groupEnd
    }
}

export function buildSubtitleSegments(
    inputCues: SubtitleCue[],
    languageHint?: string,
): SubtitleSegment[] {
    const cues = inputCues
        .filter(cue => cue.text.trim() && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
        .map(cue => ({ ...cue, text: cue.text.trim() }))
        .flatMap(cue => splitOversizedCueText(cue, languageHint))
        .flatMap(splitLongCue)
        .sort((a, b) => a.start - b.start || a.end - b.end)

    if (!cues.length) return []

    const groups: SubtitleCue[][] = []
    let regionGroups: SubtitleCue[][] = []
    let current: SubtitleCue[] = []

    const flushCurrent = () => {
        if (!current.length) return
        regionGroups.push(current)
        current = []
    }

    const flushRegion = () => {
        flushCurrent()
        if (!regionGroups.length) return
        rebalanceRegionTail(regionGroups, languageHint)
        groups.push(...regionGroups)
        regionGroups = []
    }

    for (const cue of cues) {
        if (current.length) {
            const previous = current[current.length - 1]
            const currentText = current.map(item => item.text).join(' ')
            const candidate = [...current, cue]
            const candidateText = `${currentText} ${cue.text}`.trim()
            const cjk = isCjkText(candidateText, languageHint)
            const punctuationBoundary = SENTENCE_END_PATTERN.test(previous.text.trim())
                && hasEnoughContentForPunctuationSplit(currentText, cjk)
            const gapBoundary = cue.start - previous.end >= HARD_GAP_SECONDS
            const sizeBoundary = groupDuration(candidate) > MAX_DURATION_SECONDS
                || wouldExceedLength(candidateText, cjk)

            if (gapBoundary || punctuationBoundary) {
                flushRegion()
            } else if (sizeBoundary) {
                flushCurrent()
            }
        }

        current.push(cue)
    }
    flushRegion()

    const segments = groups.map((group, index) => {
        const sample = group.map(cue => cue.text).join(' ')
        const cjk = isCjkText(sample, languageHint)
        const start = group[0].start
        const end = Math.max(start + 0.001, Math.max(...group.map(cue => cue.end)))
        return {
            id: `${start.toFixed(3)}-${end.toFixed(3)}-${index}`,
            start,
            end,
            sourceText: joinCueText(group, cjk),
            status: 'pending' as const,
        }
    })

    separateEqualStartSegments(segments)
    segments.sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))

    for (let i = 0; i < segments.length - 1; i++) {
        const currentSegment = segments[i]
        const nextSegment = segments[i + 1]
        if (currentSegment.end > nextSegment.start && nextSegment.start > currentSegment.start) {
            currentSegment.end = nextSegment.start
        }
    }

    return segments
}

export const subtitleSegmentationDefaults = {
    version: segmenterVersion,
    hardGapSeconds: HARD_GAP_SECONDS,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    maxWords: MAX_WORDS,
    maxCjkCharacters: MAX_CJK_CHARACTERS,
}
