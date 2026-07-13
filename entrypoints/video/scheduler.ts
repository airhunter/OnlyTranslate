import type {
    SubtitleSegment,
    SubtitleTranslationEntry,
    SubtitleTranslationJob,
    SubtitleTranslationResult,
} from './types'

const LOOK_BEHIND_SECONDS = 5
const LOOK_AHEAD_SECONDS = 45
const BATCH_SIZE = 5
const CONTEXT_BEFORE_COUNT = 2
const CONTEXT_AFTER_COUNT = 1
const HARD_CONTEXT_GAP_SECONDS = 1
const MAX_REQUEST_CHARACTERS = 6000
const PROMPT_VERSION = 'subtitle-context-v1'

interface TimelineEntry {
    segment: SubtitleSegment
    timelineIndex: number
    role: SubtitleTranslationEntry['role']
}

interface SelectedBatch {
    entries: TimelineEntry[]
    targets: SubtitleSegment[]
}

export interface SubtitleTranslationSchedulerOptions {
    video: HTMLVideoElement
    segments: SubtitleSegment[]
    trackKey: string
    sessionId: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    translateBatch: (job: SubtitleTranslationJob, signal?: AbortSignal) => Promise<SubtitleTranslationResult[]>
    onUpdate: () => void
}

export class SubtitleTranslationScheduler {
    private readonly video: HTMLVideoElement
    private readonly segments: SubtitleSegment[]
    private readonly timeline: SubtitleSegment[]
    private readonly trackKey: string
    private readonly sessionId: string
    private readonly title: string
    private readonly sourceLanguage?: string
    private readonly targetLanguage: string
    private readonly translateBatch: (job: SubtitleTranslationJob, signal?: AbortSignal) => Promise<SubtitleTranslationResult[]>
    private readonly onUpdate: () => void
    private readonly activeEpochs = new Set<number>()
    private readonly runControllers = new Map<number, AbortController>()
    private runEpoch = 0
    private rerunRequested = false
    private started = false

    constructor(options: SubtitleTranslationSchedulerOptions) {
        this.video = options.video
        this.segments = options.segments
        this.timeline = [...options.segments].sort((a, b) => a.start - b.start || a.end - b.end)
        this.trackKey = options.trackKey
        this.sessionId = options.sessionId
        this.title = options.title
        this.sourceLanguage = options.sourceLanguage
        this.targetLanguage = options.targetLanguage
        this.translateBatch = options.translateBatch
        this.onUpdate = options.onUpdate
    }

    start() {
        if (this.started) return
        this.started = true
        this.video.addEventListener('timeupdate', this.handleTick)
        this.video.addEventListener('seeked', this.handleSeeked)
        this.schedule()
    }

    stop() {
        this.runEpoch++
        this.abortActiveRuns()
        this.started = false
        this.rerunRequested = false
        this.video.removeEventListener('timeupdate', this.handleTick)
        this.video.removeEventListener('seeked', this.handleSeeked)
        this.resetTranslatingSegments()
    }

    schedule() {
        if (!this.started) return
        if (this.activeEpochs.has(this.runEpoch)) {
            this.rerunRequested = true
            return
        }
        void this.runNextBatch(this.runEpoch)
    }

    private readonly handleTick = () => this.schedule()

    private readonly handleSeeked = () => {
        this.runEpoch++
        this.abortActiveRuns()
        this.rerunRequested = false
        this.resetTranslatingSegments()
        this.schedule()
    }

    private resetTranslatingSegments() {
        let changed = false
        for (const segment of this.segments) {
            if (segment.status === 'translating') {
                segment.status = 'pending'
                changed = true
            }
        }
        if (changed) this.onUpdate()
    }

    private abortActiveRuns() {
        this.runControllers.forEach(controller => controller.abort())
        this.runControllers.clear()
    }

    private selectBatch(): SelectedBatch | null {
        const currentTime = this.video.currentTime
        const windowStart = Math.max(0, currentTime - LOOK_BEHIND_SECONDS)
        const windowEnd = currentTime + LOOK_AHEAD_SECONDS
        const anchorIndex = this.timeline
            .map((segment, timelineIndex) => ({ segment, timelineIndex }))
            .filter(({ segment }) => segment.status === 'pending'
                && segment.end >= windowStart
                && segment.start <= windowEnd)
            .sort((a, b) => segmentDistance(a.segment, currentTime) - segmentDistance(b.segment, currentTime)
                || a.segment.start - b.segment.start
                || a.timelineIndex - b.timelineIndex)[0]?.timelineIndex

        if (anchorIndex === undefined) return null

        const blockIndices = [anchorIndex]
        while (blockIndices.length < BATCH_SIZE) {
            const previousIndex = blockIndices[blockIndices.length - 1]
            const nextIndex = previousIndex + 1
            if (nextIndex >= this.timeline.length
                || !canShareContext(this.timeline[previousIndex], this.timeline[nextIndex])) {
                break
            }
            blockIndices.push(nextIndex)
        }

        const beforeIndices: number[] = []
        let rightIndex = anchorIndex
        while (beforeIndices.length < CONTEXT_BEFORE_COUNT && rightIndex > 0) {
            const candidateIndex = rightIndex - 1
            if (!canShareContext(this.timeline[candidateIndex], this.timeline[rightIndex])) break
            beforeIndices.unshift(candidateIndex)
            rightIndex = candidateIndex
        }

        const afterIndices: number[] = []
        let leftIndex = blockIndices[blockIndices.length - 1]
        while (afterIndices.length < CONTEXT_AFTER_COUNT && leftIndex < this.timeline.length - 1) {
            const candidateIndex = leftIndex + 1
            if (!canShareContext(this.timeline[leftIndex], this.timeline[candidateIndex])) break
            afterIndices.push(candidateIndex)
            leftIndex = candidateIndex
        }

        const entries: TimelineEntry[] = [
            ...beforeIndices.map(timelineIndex => this.createTimelineEntry(timelineIndex, 'context')),
            ...blockIndices.map(timelineIndex => this.createTimelineEntry(
                timelineIndex,
                this.timeline[timelineIndex].status === 'pending' ? 'target' : 'context',
            )),
            ...afterIndices.map(timelineIndex => this.createTimelineEntry(timelineIndex, 'context')),
        ]

        const trimmedEntries = trimToCharacterBudget(entries, anchorIndex)
        const targetIds = new Set(trimmedEntries
            .filter(entry => entry.role === 'target')
            .map(entry => entry.segment.id))
        const targets = this.timeline.filter(segment => targetIds.has(segment.id))

        return targets.length ? { entries: trimmedEntries, targets } : null
    }

    private createTimelineEntry(
        timelineIndex: number,
        role: SubtitleTranslationEntry['role'],
    ): TimelineEntry {
        return {
            segment: this.timeline[timelineIndex],
            timelineIndex,
            role,
        }
    }

    private async runNextBatch(runEpoch: number) {
        if (runEpoch !== this.runEpoch || !this.started) return
        const batch = this.selectBatch()
        if (!batch) return

        this.activeEpochs.add(runEpoch)
        const controller = new AbortController()
        this.runControllers.set(runEpoch, controller)
        this.rerunRequested = false
        batch.targets.forEach(segment => { segment.status = 'translating' })
        this.onUpdate()

        const job: SubtitleTranslationJob = {
            trackKey: this.trackKey,
            sessionId: this.sessionId,
            title: this.title,
            sourceLanguage: this.sourceLanguage,
            targetLanguage: this.targetLanguage,
            promptVersion: PROMPT_VERSION,
            entries: batch.entries.map(({ segment, role }) => ({
                id: segment.id,
                text: segment.sourceText,
                role,
            })),
        }

        let results: SubtitleTranslationResult[] = []
        try {
            results = await this.translateBatch(job, controller.signal)
        } catch {
            results = []
        }

        if (runEpoch === this.runEpoch && this.started) {
            applyResults(batch.targets, results)
            this.onUpdate()
        }

        this.activeEpochs.delete(runEpoch)
        if (this.runControllers.get(runEpoch) === controller) {
            this.runControllers.delete(runEpoch)
        }
        if (runEpoch !== this.runEpoch || !this.started) return

        if (this.rerunRequested || this.selectBatch()) {
            this.schedule()
        }
    }
}

function segmentDistance(segment: SubtitleSegment, currentTime: number): number {
    if (segment.start <= currentTime && segment.end >= currentTime) return 0
    return currentTime < segment.start
        ? segment.start - currentTime
        : currentTime - segment.end
}

function canShareContext(left: SubtitleSegment, right: SubtitleSegment): boolean {
    return right.start - left.end < HARD_CONTEXT_GAP_SECONDS
        && !isNonSpeechMarker(left.sourceText)
        && !isNonSpeechMarker(right.sourceText)
}

function isNonSpeechMarker(text: string): boolean {
    const normalized = text.trim()
        .replace(/^[\[(\uFF08\u3010]\s*/, '')
        .replace(/\s*[\])\uFF09\u3011][.!\uFF01\u3002\u2026]*$/, '')
        .trim()
        .toLowerCase()

    if (/^[\u266A\u266B\uD83C\uDFB5\uD83C\uDFB6\s]+$/.test(normalized)) return true
    return /^(?:background\s+)?(?:music(?:\s+(?:playing|continues|starts|stops))?|applause|laughter|laughs|cheering|silence|inaudible|\u97F3\u4E50|\u97F3\u6A02|\u638C\u58F0|\u638C\u8072|\u7B11\u58F0|\u7B11\u8072|\u6B22\u547C|\u6B61\u547C|\u9759\u9ED8|\u975C\u9ED8|\u542C\u4E0D\u6E05|\u807D\u4E0D\u6E05)$/.test(normalized)
}

function trimToCharacterBudget(entries: TimelineEntry[], anchorIndex: number): TimelineEntry[] {
    const selected = [...entries]
    const characterCount = () => selected.reduce((total, entry) => total + entry.segment.sourceText.length, 0)

    const contextEntries = selected
        .filter(entry => entry.role === 'context')
        .sort((a, b) => Math.abs(b.timelineIndex - anchorIndex) - Math.abs(a.timelineIndex - anchorIndex)
            || b.timelineIndex - a.timelineIndex)

    for (const contextEntry of contextEntries) {
        if (characterCount() <= MAX_REQUEST_CHARACTERS) break
        const index = selected.indexOf(contextEntry)
        if (index >= 0) selected.splice(index, 1)
    }

    const futureTargets = selected
        .filter(entry => entry.role === 'target' && entry.timelineIndex !== anchorIndex)
        .sort((a, b) => b.timelineIndex - a.timelineIndex)

    for (const target of futureTargets) {
        if (characterCount() <= MAX_REQUEST_CHARACTERS) break
        const index = selected.indexOf(target)
        if (index >= 0) selected.splice(index, 1)
    }

    return selected
}

function applyResults(targets: SubtitleSegment[], results: SubtitleTranslationResult[]) {
    const translations = new Map<string, string>()
    const duplicateIds = new Set<string>()
    const seenIds = new Set<string>()

    for (const result of Array.isArray(results) ? results : []) {
        if (!result || typeof result.id !== 'string') continue
        if (seenIds.has(result.id)) {
            duplicateIds.add(result.id)
            continue
        }
        seenIds.add(result.id)
        if (typeof result.translatedText === 'string' && result.translatedText.trim()) {
            translations.set(result.id, result.translatedText.trim())
        }
    }

    for (const target of targets) {
        const translatedText = duplicateIds.has(target.id) ? undefined : translations.get(target.id)
        if (translatedText) {
            target.translatedText = translatedText
            target.status = 'translated'
        } else {
            target.translatedText = undefined
            target.status = 'failed'
        }
    }
}

export const subtitleSchedulingDefaults = {
    lookBehindSeconds: LOOK_BEHIND_SECONDS,
    lookAheadSeconds: LOOK_AHEAD_SECONDS,
    batchSize: BATCH_SIZE,
    contextBeforeCount: CONTEXT_BEFORE_COUNT,
    contextAfterCount: CONTEXT_AFTER_COUNT,
    hardContextGapSeconds: HARD_CONTEXT_GAP_SECONDS,
    maxRequestCharacters: MAX_REQUEST_CHARACTERS,
    promptVersion: PROMPT_VERSION,
}
