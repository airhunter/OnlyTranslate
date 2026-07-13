import type { SubtitleCue, SubtitleSegment } from './types'

const HARD_GAP_SECONDS = 1
const MAX_DURATION_SECONDS = 10
const MAX_WORDS = 20
const MAX_CJK_CHARACTERS = 30
const MIN_WORDS_FOR_PUNCTUATION_SPLIT = 6
const MIN_CJK_FOR_PUNCTUATION_SPLIT = 10
const SENTENCE_END_PATTERN = /[.!?。！？；;…]$/
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g

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

export function buildSubtitleSegments(
    inputCues: SubtitleCue[],
    languageHint?: string,
): SubtitleSegment[] {
    const cues = inputCues
        .filter(cue => cue.text.trim() && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
        .map(cue => ({ ...cue, text: cue.text.trim() }))
        .sort((a, b) => a.start - b.start || a.end - b.end)

    if (!cues.length) return []

    const segments: SubtitleSegment[] = []
    let current: SubtitleCue[] = []

    const flush = () => {
        if (!current.length) return
        const sample = current.map(cue => cue.text).join(' ')
        const cjk = isCjkText(sample, languageHint)
        const start = current[0].start
        const end = Math.max(start + 0.001, Math.max(...current.map(cue => cue.end)))
        segments.push({
            id: `${start.toFixed(3)}-${end.toFixed(3)}-${segments.length}`,
            start,
            end,
            sourceText: joinCueText(current, cjk),
            status: 'pending',
        })
        current = []
    }

    for (const cue of cues) {
        if (current.length) {
            const previous = current[current.length - 1]
            const currentText = current.map(item => item.text).join(' ')
            const candidateText = `${currentText} ${cue.text}`.trim()
            const cjk = isCjkText(candidateText, languageHint)
            const gap = cue.start - previous.end
            const duration = Math.max(previous.end, cue.end) - current[0].start
            const punctuationBoundary = SENTENCE_END_PATTERN.test(previous.text.trim())
                && hasEnoughContentForPunctuationSplit(currentText, cjk)
            const gapBoundary = gap >= HARD_GAP_SECONDS
            const sizeBoundary = duration > MAX_DURATION_SECONDS
                || wouldExceedLength(candidateText, cjk)

            if (gapBoundary || punctuationBoundary) {
                flush()
            } else if (sizeBoundary) {
                if (current.length > 1) {
                    const carryOver = current.pop()!
                    flush()
                    current = [carryOver]
                } else {
                    flush()
                }
            }
        }

        current.push(cue)
    }
    flush()

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
    hardGapSeconds: HARD_GAP_SECONDS,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    maxWords: MAX_WORDS,
    maxCjkCharacters: MAX_CJK_CHARACTERS,
}
