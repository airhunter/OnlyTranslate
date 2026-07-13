import type {
    SubtitleSegment,
    SubtitleTranslationEntry,
    SubtitleTranslationJob,
    SubtitleTranslationLane,
    SubtitleTranslationResult,
} from './types'

const LOOK_BEHIND_SECONDS = 5
const LOOK_AHEAD_SECONDS = 45
const LOW_WATERMARK_SECONDS = 15
const BUFFERED_WATERMARK_SECONDS = 30
const FOREGROUND_COVERAGE_SECONDS = 12
const PREFETCH_COVERAGE_SECONDS = 30
const MAX_BATCH_TARGETS = 12
const MAX_TARGET_CHARACTERS = 1500
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
    targetIndices: number[]
}

interface ActiveRun {
    id: number
    epoch: number
    lane: SubtitleTranslationLane
    controller: AbortController
    targetIds: Set<string>
    targetIndices: number[]
    committedIds: Set<string>
}

export type SubtitleSchedulerPhase = 'starting' | 'catching-up' | 'buffered' | 'failed'

export interface SubtitleSchedulerSnapshot {
    phase: SubtitleSchedulerPhase
    runwaySeconds: number
    activeRuns: number
    failedInImmediateWindow: boolean
}

export interface SubtitleSchedulerTranslateOptions {
    signal?: AbortSignal
    lane: SubtitleTranslationLane
    onPartialResult?: (result: SubtitleTranslationResult) => void
}

export interface SubtitleTranslationSchedulerOptions {
    video: HTMLVideoElement
    segments: SubtitleSegment[]
    trackKey: string
    sessionId: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    translateBatch: (
        job: SubtitleTranslationJob,
        options: SubtitleSchedulerTranslateOptions,
    ) => Promise<SubtitleTranslationResult[]>
    onUpdate: () => void
    onStatus?: (snapshot: SubtitleSchedulerSnapshot) => void
    onTranslationCommitted?: (
        results: SubtitleTranslationResult[],
        lane: SubtitleTranslationLane,
    ) => void | Promise<void>
}

export class SubtitleTranslationScheduler {
    private readonly video: HTMLVideoElement
    private readonly segments: SubtitleSegment[]
    private readonly timeline: SubtitleSegment[]
    private readonly timelineIndexById = new Map<string, number>()
    private readonly trackKey: string
    private readonly sessionId: string
    private readonly title: string
    private readonly sourceLanguage?: string
    private readonly targetLanguage: string
    private readonly translateBatch: SubtitleTranslationSchedulerOptions['translateBatch']
    private readonly onUpdate: () => void
    private readonly onStatus?: (snapshot: SubtitleSchedulerSnapshot) => void
    private readonly onTranslationCommitted?: SubtitleTranslationSchedulerOptions['onTranslationCommitted']
    private readonly activeRuns = new Map<SubtitleTranslationLane, ActiveRun>()
    private runEpoch = 0
    private nextRunId = 1
    private started = false
    private pumping = false
    private pumpRequested = false
    private readonly failedForegroundTargetIds = new Set<string>()
    private lastSnapshotKey = ''

    constructor(options: SubtitleTranslationSchedulerOptions) {
        this.video = options.video
        this.segments = options.segments
        this.timeline = [...options.segments].sort((a, b) => a.start - b.start || a.end - b.end)
        this.timeline.forEach((segment, index) => this.timelineIndexById.set(segment.id, index))
        this.trackKey = options.trackKey
        this.sessionId = options.sessionId
        this.title = options.title
        this.sourceLanguage = options.sourceLanguage
        this.targetLanguage = options.targetLanguage
        this.translateBatch = options.translateBatch
        this.onUpdate = options.onUpdate
        this.onStatus = options.onStatus
        this.onTranslationCommitted = options.onTranslationCommitted
    }

    start() {
        if (this.started) return
        this.started = true
        this.video.addEventListener('timeupdate', this.handleTick)
        this.video.addEventListener('pause', this.handleTick)
        this.video.addEventListener('play', this.handleTick)
        this.video.addEventListener('seeked', this.handleSeeked)
        this.schedule()
    }

    stop() {
        if (!this.started && this.activeRuns.size === 0) return
        this.started = false
        this.runEpoch++
        this.abortActiveRuns()
        this.video.removeEventListener('timeupdate', this.handleTick)
        this.video.removeEventListener('pause', this.handleTick)
        this.video.removeEventListener('play', this.handleTick)
        this.video.removeEventListener('seeked', this.handleSeeked)
        this.failedForegroundTargetIds.clear()
        this.lastSnapshotKey = ''
    }

    schedule() {
        if (!this.started) return
        if (this.pumping) {
            this.pumpRequested = true
            return
        }

        this.pumping = true
        try {
            do {
                this.pumpRequested = false
                this.fillAvailableLanes()
                this.emitStatus()
            } while (this.pumpRequested && this.started)
        } finally {
            this.pumping = false
        }
    }

    getSnapshot(): SubtitleSchedulerSnapshot {
        return this.createSnapshot()
    }

    private readonly handleTick = () => this.schedule()

    private readonly handleSeeked = () => {
        this.runEpoch++
        this.abortActiveRuns()
        this.failedForegroundTargetIds.clear()
        this.lastSnapshotKey = ''
        this.schedule()
    }

    private abortActiveRuns() {
        let changed = false
        for (const run of this.activeRuns.values()) {
            run.controller.abort()
            for (const id of run.targetIds) {
                const segment = this.timeline[this.timelineIndexById.get(id) ?? -1]
                if (segment?.status === 'translating' && !run.committedIds.has(id)) {
                    segment.status = 'pending'
                    changed = true
                }
            }
        }
        this.activeRuns.clear()
        if (changed) this.onUpdate()
    }

    private fillAvailableLanes() {
        let runway = this.calculateRunwaySeconds()
        let maximumRuns = this.maximumRunCount(runway)

        while (this.started && this.activeRuns.size < maximumRuns) {
            const lane = this.chooseNextLane(runway)
            if (!lane) break
            const batch = this.selectBatch(lane)
            if (!batch) break
            this.startRun(lane, batch)

            runway = this.calculateRunwaySeconds()
            maximumRuns = this.maximumRunCount(runway)
            // Do not cancel useful work if starting a run changes the water level.
            maximumRuns = Math.max(maximumRuns, this.activeRuns.size)
        }
    }

    private chooseNextLane(runwaySeconds: number): SubtitleTranslationLane | null {
        if (this.hasRecentPastPending() && !this.activeRuns.has('foreground')) return 'foreground'
        if (runwaySeconds < LOW_WATERMARK_SECONDS) {
            if (!this.activeRuns.has('foreground')) return 'foreground'
            if (!this.activeRuns.has('prefetch')) return 'prefetch'
            return null
        }
        return this.activeRuns.size === 0 ? 'prefetch' : null
    }

    private maximumRunCount(runwaySeconds: number): number {
        if (runwaySeconds < LOW_WATERMARK_SECONDS) return 2
        if (runwaySeconds < LOOK_AHEAD_SECONDS || this.hasRecentPastPending()) return 1
        return 0
    }

    private hasRecentPastPending(): boolean {
        const currentTime = this.video.currentTime
        const windowStart = Math.max(0, currentTime - LOOK_BEHIND_SECONDS)
        return this.timeline.some(segment => segment.status === 'pending'
            && segment.end < currentTime
            && segment.end >= windowStart)
    }

    private selectBatch(lane: SubtitleTranslationLane): SelectedBatch | null {
        const anchorIndex = this.findAnchorIndex(lane)
        if (anchorIndex === undefined) return null

        const coverageTarget = lane === 'foreground'
            ? FOREGROUND_COVERAGE_SECONDS
            : PREFETCH_COVERAGE_SECONDS
        const currentTime = this.video.currentTime
        const windowEnd = currentTime + LOOK_AHEAD_SECONDS
        const targetIndices: number[] = []
        let targetCharacters = 0
        let previousIndex = anchorIndex

        for (let timelineIndex = anchorIndex; timelineIndex < this.timeline.length; timelineIndex++) {
            const segment = this.timeline[timelineIndex]
            if (segment.start > windowEnd) break
            if (timelineIndex > anchorIndex
                && !canShareContext(this.timeline[previousIndex], segment)) {
                break
            }
            previousIndex = timelineIndex

            if (segment.status !== 'pending') continue
            if (targetIndices.length >= MAX_BATCH_TARGETS) break
            if (targetIndices.length > 0
                && targetCharacters + segment.sourceText.length > MAX_TARGET_CHARACTERS) {
                break
            }

            targetIndices.push(timelineIndex)
            targetCharacters += segment.sourceText.length
            const coverageSeconds = segment.end - this.timeline[anchorIndex].start
            if (coverageSeconds >= coverageTarget) break
        }

        if (!targetIndices.length) return null

        const firstTargetIndex = targetIndices[0]
        const lastTargetIndex = targetIndices[targetIndices.length - 1]
        const targetIndexSet = new Set(targetIndices)
        const beforeIndices: number[] = []
        let rightIndex = firstTargetIndex
        while (beforeIndices.length < CONTEXT_BEFORE_COUNT && rightIndex > 0) {
            const candidateIndex = rightIndex - 1
            if (!canShareContext(this.timeline[candidateIndex], this.timeline[rightIndex])) break
            beforeIndices.unshift(candidateIndex)
            rightIndex = candidateIndex
        }

        const afterIndices: number[] = []
        let leftIndex = lastTargetIndex
        while (afterIndices.length < CONTEXT_AFTER_COUNT && leftIndex < this.timeline.length - 1) {
            const candidateIndex = leftIndex + 1
            if (!canShareContext(this.timeline[leftIndex], this.timeline[candidateIndex])) break
            afterIndices.push(candidateIndex)
            leftIndex = candidateIndex
        }

        const blockIndices = Array.from(
            { length: lastTargetIndex - firstTargetIndex + 1 },
            (_, offset) => firstTargetIndex + offset,
        )
        const entries: TimelineEntry[] = [
            ...beforeIndices.map(index => this.createTimelineEntry(index, 'context')),
            ...blockIndices.map(index => this.createTimelineEntry(
                index,
                targetIndexSet.has(index) ? 'target' : 'context',
            )),
            ...afterIndices.map(index => this.createTimelineEntry(index, 'context')),
        ]

        const trimmedEntries = trimToCharacterBudget(entries, anchorIndex)
        const retainedTargetIndices = trimmedEntries
            .filter(entry => entry.role === 'target')
            .map(entry => entry.timelineIndex)
        const targets = retainedTargetIndices.map(index => this.timeline[index])
        return targets.length
            ? { entries: trimmedEntries, targets, targetIndices: retainedTargetIndices }
            : null
    }

    private findAnchorIndex(lane: SubtitleTranslationLane): number | undefined {
        const currentTime = this.video.currentTime
        const windowStart = Math.max(0, currentTime - LOOK_BEHIND_SECONDS)
        const windowEnd = currentTime + LOOK_AHEAD_SECONDS

        if (lane === 'prefetch') {
            const ownedIndices = [...this.activeRuns.values()].flatMap(run => run.targetIndices)
            const minimumIndex = ownedIndices.length ? Math.max(...ownedIndices) + 1 : 0
            const index = this.timeline.findIndex((segment, index) => index >= minimumIndex
                && segment.status === 'pending'
                && segment.end >= currentTime
                && segment.start <= windowEnd)
            return indexOrUndefined(index)
        }

        const active = this.timeline.findIndex(segment => segment.status === 'pending'
            && segment.start <= currentTime
            && segment.end >= currentTime)
        if (active >= 0) return active

        const future = this.timeline.findIndex(segment => segment.status === 'pending'
            && segment.start > currentTime
            && segment.start <= windowEnd)
        if (future >= 0) return future

        for (let index = this.timeline.length - 1; index >= 0; index--) {
            const segment = this.timeline[index]
            if (segment.status === 'pending'
                && segment.end < currentTime
                && segment.end >= windowStart) {
                return index
            }
        }
        return undefined
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

    private startRun(lane: SubtitleTranslationLane, batch: SelectedBatch) {
        const run: ActiveRun = {
            id: this.nextRunId++,
            epoch: this.runEpoch,
            lane,
            controller: new AbortController(),
            targetIds: new Set(batch.targets.map(segment => segment.id)),
            targetIndices: batch.targetIndices,
            committedIds: new Set(),
        }
        this.activeRuns.set(lane, run)
        for (const target of batch.targets) target.status = 'translating'
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

        void this.executeRun(run, job)
    }

    private async executeRun(run: ActiveRun, job: SubtitleTranslationJob) {
        let results: SubtitleTranslationResult[] = []
        try {
            results = await this.translateBatch(job, {
                signal: run.controller.signal,
                lane: run.lane,
                onPartialResult: result => this.commitResult(run, result),
            })
        } catch {
            results = []
        }

        if (!this.isCurrentRun(run)) return

        const counts = new Map<string, number>()
        for (const result of Array.isArray(results) ? results : []) {
            if (result && typeof result.id === 'string' && run.targetIds.has(result.id)) {
                counts.set(result.id, (counts.get(result.id) || 0) + 1)
            }
        }
        const newlyCommitted: SubtitleTranslationResult[] = []
        for (const result of Array.isArray(results) ? results : []) {
            if (counts.get(result?.id) !== 1) continue
            const committed = this.commitResult(run, result, false)
            if (committed) newlyCommitted.push(committed)
        }
        this.notifyTranslationsCommitted(newlyCommitted, run.lane)

        let changed = false
        for (const id of run.targetIds) {
            if (run.committedIds.has(id)) continue
            const segment = this.timeline[this.timelineIndexById.get(id) ?? -1]
            if (segment?.status === 'translating') {
                segment.translatedText = undefined
                segment.status = 'failed'
                changed = true
            }
        }

        if (run.lane === 'foreground' && run.committedIds.size === 0) {
            for (const id of run.targetIds) this.failedForegroundTargetIds.add(id)
        }

        if (this.activeRuns.get(run.lane)?.id === run.id) this.activeRuns.delete(run.lane)
        if (changed) this.onUpdate()
        this.schedule()
    }

    private commitResult(
        run: ActiveRun,
        rawResult: SubtitleTranslationResult,
        notifyCommit = true,
    ): SubtitleTranslationResult | undefined {
        if (!this.isCurrentRun(run)
            || !rawResult
            || typeof rawResult.id !== 'string'
            || !run.targetIds.has(rawResult.id)
            || run.committedIds.has(rawResult.id)) {
            return undefined
        }

        const translatedText = typeof rawResult.translatedText === 'string'
            ? rawResult.translatedText.trim()
            : ''
        if (!translatedText) return undefined
        const segment = this.timeline[this.timelineIndexById.get(rawResult.id) ?? -1]
        if (!segment || segment.status !== 'translating') return undefined

        const result: SubtitleTranslationResult = {
            id: rawResult.id,
            translatedText,
            cacheable: rawResult.cacheable,
        }
        segment.translatedText = translatedText
        segment.status = 'translated'
        run.committedIds.add(result.id)
        this.onUpdate()

        if (notifyCommit) this.notifyTranslationsCommitted([result], run.lane)
        this.emitStatus()
        return result
    }

    private notifyTranslationsCommitted(
        results: SubtitleTranslationResult[],
        lane: SubtitleTranslationLane,
    ) {
        if (!results.length) return
        try {
            const commit = this.onTranslationCommitted?.(results, lane)
            if (commit && typeof (commit as Promise<void>).catch === 'function') {
                void (commit as Promise<void>).catch(() => undefined)
            }
        } catch {
            // Cache/status observers must not turn a usable translation into a failure.
        }
    }

    private isCurrentRun(run: ActiveRun): boolean {
        return this.started
            && run.epoch === this.runEpoch
            && this.activeRuns.get(run.lane)?.id === run.id
            && !run.controller.signal.aborted
    }

    private calculateRunwaySeconds(): number {
        const currentTime = this.video.currentTime
        const horizon = currentTime + LOOK_AHEAD_SECONDS
        const firstUnfinished = this.timeline.find(segment => segment.end > currentTime
            && segment.start <= horizon
            && segment.status !== 'translated')
        if (!firstUnfinished) return LOOK_AHEAD_SECONDS
        return Math.max(0, Math.min(LOOK_AHEAD_SECONDS, firstUnfinished.start - currentTime))
    }

    private createSnapshot(): SubtitleSchedulerSnapshot {
        const currentTime = this.video.currentTime
        const rawRunway = this.calculateRunwaySeconds()
        const runwaySeconds = Math.floor(rawRunway)
        for (const id of this.failedForegroundTargetIds) {
            const segment = this.timeline[this.timelineIndexById.get(id) ?? -1]
            if (!segment || segment.end < currentTime) this.failedForegroundTargetIds.delete(id)
        }
        const activeSegmentFailed = this.timeline.some(segment => segment.status === 'failed'
            && segment.start <= currentTime
            && segment.end >= currentTime)
        const foregroundFailedWithoutBuffer = this.failedForegroundTargetIds.size > 0
            && rawRunway < LOW_WATERMARK_SECONDS
        const failedInImmediateWindow = activeSegmentFailed || foregroundFailedWithoutBuffer
        const hasTranslatedInWindow = this.timeline.some(segment => segment.status === 'translated'
            && segment.end >= Math.max(0, currentTime - LOOK_BEHIND_SECONDS)
            && segment.start <= currentTime + LOOK_AHEAD_SECONDS)
        const hasUnfinishedInWindow = this.timeline.some(segment => segment.status !== 'translated'
            && segment.end >= currentTime
            && segment.start <= currentTime + LOOK_AHEAD_SECONDS)

        let phase: SubtitleSchedulerPhase
        if (failedInImmediateWindow) {
            phase = 'failed'
        } else if (rawRunway >= BUFFERED_WATERMARK_SECONDS || !hasUnfinishedInWindow) {
            phase = 'buffered'
        } else if (!hasTranslatedInWindow && hasUnfinishedInWindow) {
            phase = 'starting'
        } else {
            phase = 'catching-up'
        }

        return {
            phase,
            runwaySeconds,
            activeRuns: this.activeRuns.size,
            failedInImmediateWindow,
        }
    }

    private emitStatus() {
        if (!this.started || !this.onStatus) return
        const snapshot = this.createSnapshot()
        const key = [
            snapshot.phase,
            snapshot.runwaySeconds,
            snapshot.activeRuns,
            snapshot.failedInImmediateWindow,
        ].join(':')
        if (key === this.lastSnapshotKey) return
        this.lastSnapshotKey = key
        this.onStatus(snapshot)
    }
}

function indexOrUndefined(index: number): number | undefined {
    return index >= 0 ? index : undefined
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

    return selected.sort((a, b) => a.timelineIndex - b.timelineIndex)
}

export const subtitleSchedulingDefaults = {
    lookBehindSeconds: LOOK_BEHIND_SECONDS,
    lookAheadSeconds: LOOK_AHEAD_SECONDS,
    lowWatermarkSeconds: LOW_WATERMARK_SECONDS,
    bufferedWatermarkSeconds: BUFFERED_WATERMARK_SECONDS,
    foregroundCoverageSeconds: FOREGROUND_COVERAGE_SECONDS,
    prefetchCoverageSeconds: PREFETCH_COVERAGE_SECONDS,
    maxBatchTargets: MAX_BATCH_TARGETS,
    maxTargetCharacters: MAX_TARGET_CHARACTERS,
    contextBeforeCount: CONTEXT_BEFORE_COUNT,
    contextAfterCount: CONTEXT_AFTER_COUNT,
    hardContextGapSeconds: HARD_CONTEXT_GAP_SECONDS,
    maxRequestCharacters: MAX_REQUEST_CHARACTERS,
    promptVersion: PROMPT_VERSION,
}
