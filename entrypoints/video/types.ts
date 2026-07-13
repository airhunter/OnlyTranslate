export interface SubtitleCue {
    start: number
    end: number
    text: string
}

export type SubtitleSegmentStatus = 'pending' | 'translating' | 'translated' | 'failed'

export interface SubtitleSegment {
    id: string
    start: number
    end: number
    sourceText: string
    translatedText?: string
    status: SubtitleSegmentStatus
}

export interface SubtitleTranslationEntry {
    id: string
    text: string
    role: 'context' | 'target'
}

export interface SubtitleTranslationJob {
    trackKey: string
    sessionId: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    promptVersion: string
    entries: SubtitleTranslationEntry[]
}

export interface SubtitleTranslationResult {
    id: string
    translatedText: string
}

export type SubtitleFormat = 'youtube-xml' | 'youtube-json3' | 'youtube-json3-scrolling' | 'vtt'

export interface ParsedSubtitle {
    cues: SubtitleCue[]
    format: SubtitleFormat
    sourceLanguage?: string
}
