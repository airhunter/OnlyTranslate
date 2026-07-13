import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SubtitleTranslationScheduler,
  subtitleSchedulingDefaults,
} from '@/entrypoints/video/scheduler'
import type {
  SubtitleSchedulerSnapshot,
  SubtitleSchedulerTranslateOptions,
  SubtitleTranslationSchedulerOptions,
} from '@/entrypoints/video/scheduler'
import type {
  SubtitleSegment,
  SubtitleTranslationJob,
  SubtitleTranslationLane,
  SubtitleTranslationResult,
} from '@/entrypoints/video/types'

const segment = (
  start: number,
  sourceText: string,
  duration = 1,
  id = `${start}`,
): SubtitleSegment => ({
  id,
  start,
  end: start + duration,
  sourceText,
  status: 'pending',
})

const timeline = (
  count: number,
  duration = 3,
  start = 0,
  text: (index: number) => string = index => `line-${index}`,
): SubtitleSegment[] => Array.from({ length: count }, (_, index) => (
  segment(start + index * duration, text(index), duration)
))

interface SchedulerObservers {
  onUpdate?: () => void
  onStatus?: (snapshot: SubtitleSchedulerSnapshot) => void
  onTranslationCommitted?: NonNullable<SubtitleTranslationSchedulerOptions['onTranslationCommitted']>
}

const createScheduler = (
  video: HTMLVideoElement,
  segments: SubtitleSegment[],
  translateBatch: SubtitleTranslationSchedulerOptions['translateBatch'],
  observers: SchedulerObservers = {},
) => new SubtitleTranslationScheduler({
  video,
  segments,
  trackKey: 'video:track',
  sessionId: 'session-1',
  title: 'Video title',
  sourceLanguage: 'en',
  targetLanguage: 'zh-CN',
  translateBatch,
  onUpdate: observers.onUpdate || (() => undefined),
  onStatus: observers.onStatus,
  onTranslationCommitted: observers.onTranslationCommitted,
})

const translateTargets = (job: SubtitleTranslationJob): SubtitleTranslationResult[] => (
  job.entries
    .filter(entry => entry.role === 'target')
    .map(entry => ({
      id: entry.id,
      translatedText: `translated:${entry.text}`,
      cacheable: true,
    }))
)

interface DeferredCall {
  job: SubtitleTranslationJob
  options: SubtitleSchedulerTranslateOptions
  resolve: (results: SubtitleTranslationResult[]) => void
  reject: (error: unknown) => void
}

const createDeferredTranslator = () => {
  const calls: DeferredCall[] = []
  const translateBatch = vi.fn((
    job: SubtitleTranslationJob,
    options: SubtitleSchedulerTranslateOptions,
  ) => new Promise<SubtitleTranslationResult[]>((resolve, reject) => {
    calls.push({ job, options, resolve, reject })
  }))
  return { calls, translateBatch }
}

const targetIds = (job: SubtitleTranslationJob) => job.entries
  .filter(entry => entry.role === 'target')
  .map(entry => entry.id)

const targetCoverage = (job: SubtitleTranslationJob, segments: SubtitleSegment[]) => {
  const ids = targetIds(job)
  const byId = new Map(segments.map(item => [item.id, item]))
  const first = byId.get(ids[0])!
  const last = byId.get(ids[ids.length - 1])!
  return last.end - first.start
}

describe('video subtitle translation scheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts non-overlapping foreground and prefetch lanes on a cold start', async () => {
    const video = document.createElement('video')
    video.currentTime = 0
    const segments = timeline(14)
    const deferred = createDeferredTranslator()
    const scheduler = createScheduler(video, segments, deferred.translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))

    const foreground = deferred.calls.find(call => call.options.lane === 'foreground')!
    const prefetch = deferred.calls.find(call => call.options.lane === 'prefetch')!
    const foregroundIds = targetIds(foreground.job)
    const prefetchIds = targetIds(prefetch.job)

    expect(new Set(foregroundIds).intersection(new Set(prefetchIds)).size).toBe(0)
    expect(targetCoverage(foreground.job, segments))
      .toBeGreaterThanOrEqual(subtitleSchedulingDefaults.foregroundCoverageSeconds)
    expect(targetCoverage(prefetch.job, segments))
      .toBeGreaterThanOrEqual(subtitleSchedulingDefaults.prefetchCoverageSeconds)
    expect(foregroundIds).toEqual(['0', '3', '6', '9'])
    expect(prefetchIds).toEqual(['12', '15', '18', '21', '24', '27', '30', '33', '36', '39'])

    scheduler.stop()
  })

  it('uses a fully hydrated timeline without sending a translation request', async () => {
    const video = document.createElement('video')
    video.currentTime = 30
    const segments = timeline(30, 3)
    for (const item of segments) {
      item.status = 'translated'
      item.translatedText = `cached:${item.sourceText}`
    }
    const translateBatch = vi.fn(async () => [])
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await Promise.resolve()

    expect(translateBatch).not.toHaveBeenCalled()
    expect(scheduler.getSnapshot()).toMatchObject({ phase: 'buffered', runwaySeconds: 45 })
    scheduler.stop()
  })

  it('keeps every lane within target-count and character budgets', async () => {
    const video = document.createElement('video')
    const segments = timeline(40, 1, 0, index => `${index}`.padEnd(130, 'x'))
    const deferred = createDeferredTranslator()
    const scheduler = createScheduler(video, segments, deferred.translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))

    for (const { job } of deferred.calls) {
      const targets = job.entries.filter(entry => entry.role === 'target')
      expect(targets.length).toBeLessThanOrEqual(subtitleSchedulingDefaults.maxBatchTargets)
      expect(targets.reduce((sum, entry) => sum + entry.text.length, 0))
        .toBeLessThanOrEqual(subtitleSchedulingDefaults.maxTargetCharacters)
      expect(job.entries.reduce((sum, entry) => sum + entry.text.length, 0))
        .toBeLessThanOrEqual(subtitleSchedulingDefaults.maxRequestCharacters)
    }

    scheduler.stop()
  })

  it('drops distant context before targets when enforcing the total request budget', async () => {
    const video = document.createElement('video')
    video.currentTime = 2.5
    const segments = [
      segment(0, 'a'.repeat(3000)),
      segment(1, 'b'.repeat(3000)),
      segment(2, 'target'.padEnd(1400, 'c')),
      segment(3, 'd'.repeat(2000)),
    ]
    segments[0].status = 'translated'
    segments[1].status = 'translated'
    segments[3].status = 'translated'
    const deferred = createDeferredTranslator()
    const scheduler = createScheduler(video, segments, deferred.translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(1))

    const { entries } = deferred.calls[0].job
    expect(targetIds(deferred.calls[0].job)).toEqual(['2'])
    expect(entries.reduce((sum, entry) => sum + entry.text.length, 0))
      .toBeLessThanOrEqual(subtitleSchedulingDefaults.maxRequestCharacters)
    expect(entries.some(entry => entry.role === 'context')).toBe(true)

    scheduler.stop()
  })

  it('anchors foreground work at the active cue, then future cue, then recent past cue', async () => {
    const activeVideo = document.createElement('video')
    activeVideo.currentTime = 10.5
    const activeSegments = [
      segment(8, 'past'),
      segment(10, 'active'),
      segment(11, 'future'),
    ]
    const activeDeferred = createDeferredTranslator()
    const activeScheduler = createScheduler(activeVideo, activeSegments, activeDeferred.translateBatch)
    activeScheduler.start()
    await vi.waitFor(() => expect(activeDeferred.calls.length).toBeGreaterThan(0))
    expect(targetIds(activeDeferred.calls.find(call => call.options.lane === 'foreground')!.job)[0]).toBe('10')
    activeScheduler.stop()

    const futureVideo = document.createElement('video')
    futureVideo.currentTime = 10.5
    const futureSegments = [segment(9, 'past'), segment(11, 'future')]
    const futureDeferred = createDeferredTranslator()
    const futureScheduler = createScheduler(futureVideo, futureSegments, futureDeferred.translateBatch)
    futureScheduler.start()
    await vi.waitFor(() => expect(futureDeferred.calls.length).toBeGreaterThan(0))
    expect(targetIds(futureDeferred.calls.find(call => call.options.lane === 'foreground')!.job)[0]).toBe('11')
    futureScheduler.stop()

    const pastVideo = document.createElement('video')
    pastVideo.currentTime = 10.5
    const pastSegments = [segment(9, 'recent-past')]
    const pastDeferred = createDeferredTranslator()
    const pastScheduler = createScheduler(pastVideo, pastSegments, pastDeferred.translateBatch)
    pastScheduler.start()
    await vi.waitFor(() => expect(pastDeferred.calls.length).toBeGreaterThan(0))
    expect(targetIds(pastDeferred.calls.find(call => call.options.lane === 'foreground')!.job)[0]).toBe('9')
    pastScheduler.stop()
  })

  it('uses silent time as runway and obeys the 15/45 second watermarks', async () => {
    const lowVideo = document.createElement('video')
    const lowSegments = [segment(15, 'after-silence', 3)]
    const lowDeferred = createDeferredTranslator()
    const lowScheduler = createScheduler(lowVideo, lowSegments, lowDeferred.translateBatch)
    lowScheduler.start()
    await vi.waitFor(() => expect(lowDeferred.calls).toHaveLength(1))
    expect(lowDeferred.calls[0].options.lane).toBe('prefetch')
    expect(lowScheduler.getSnapshot().runwaySeconds).toBe(15)
    expect(lowScheduler.getSnapshot().activeRuns).toBe(1)
    lowScheduler.stop()

    const fullVideo = document.createElement('video')
    const fullSegments = [segment(45, 'at-horizon', 3)]
    const fullDeferred = createDeferredTranslator()
    const fullScheduler = createScheduler(fullVideo, fullSegments, fullDeferred.translateBatch)
    fullScheduler.start()
    await Promise.resolve()
    expect(fullDeferred.calls).toHaveLength(0)
    expect(fullScheduler.getSnapshot().runwaySeconds).toBe(45)
    expect(fullScheduler.getSnapshot().phase).toBe('buffered')
    fullScheduler.stop()
  })

  it('commits a partial result immediately and forwards only the validated result to cache', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'first', 3)]
    const deferred = createDeferredTranslator()
    const onTranslationCommitted = vi.fn((
      _results: SubtitleTranslationResult[],
      _lane: SubtitleTranslationLane,
    ) => undefined)
    const scheduler = createScheduler(video, segments, deferred.translateBatch, {
      onTranslationCommitted,
    })

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(1))
    deferred.calls[0].options.onPartialResult?.({
      id: '0',
      translatedText: '第一句',
      cacheable: true,
    })

    expect(segments[0]).toMatchObject({
      status: 'translated',
      translatedText: '第一句',
    })
    expect(onTranslationCommitted).toHaveBeenCalledWith([
      { id: '0', translatedText: '第一句', cacheable: true },
    ], 'foreground')

    scheduler.stop()
  })

  it('does not retry failed targets and continues translating later subtitles', async () => {
    const video = document.createElement('video')
    const segments = [
      segment(0, 'failure'),
      segment(2, 'later-1'),
      segment(3, 'later-2'),
    ]
    const deferred = createDeferredTranslator()
    const scheduler = createScheduler(video, segments, deferred.translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))
    const foreground = deferred.calls.find(call => call.options.lane === 'foreground')!
    const prefetch = deferred.calls.find(call => call.options.lane === 'prefetch')!
    foreground.reject(new Error('foreground failed'))
    prefetch.resolve(translateTargets(prefetch.job))

    await vi.waitFor(() => expect(segments[0].status).toBe('failed'))
    await vi.waitFor(() => expect(segments[1].status).toBe('translated'))
    expect(deferred.calls.flatMap(call => targetIds(call.job)).filter(id => id === '0')).toHaveLength(1)

    scheduler.stop()
  })

  it('aborts both lanes on seek and ignores stale partial and final results', async () => {
    const video = document.createElement('video')
    const oldSegments = timeline(14)
    const newSegments = timeline(14, 3, 100)
    const segments = [...oldSegments, ...newSegments]
    const deferred = createDeferredTranslator()
    const onTranslationCommitted = vi.fn((
      _results: SubtitleTranslationResult[],
      _lane: SubtitleTranslationLane,
    ) => undefined)
    const scheduler = createScheduler(video, segments, deferred.translateBatch, {
      onTranslationCommitted,
    })

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))
    const staleCalls = [...deferred.calls]

    video.currentTime = 100
    video.dispatchEvent(new Event('seeked'))
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(4))
    expect(staleCalls.every(call => call.options.signal?.aborted)).toBe(true)

    for (const staleCall of staleCalls) {
      const staleId = targetIds(staleCall.job)[0]
      staleCall.options.onPartialResult?.({ id: staleId, translatedText: 'stale-partial', cacheable: true })
      staleCall.resolve(translateTargets(staleCall.job).map(result => ({
        ...result,
        translatedText: 'stale-final',
      })))
    }
    await Promise.resolve()
    await Promise.resolve()

    expect(oldSegments.every(item => item.status === 'pending')).toBe(true)
    expect(oldSegments.every(item => item.translatedText === undefined)).toBe(true)
    expect(onTranslationCommitted).not.toHaveBeenCalled()

    const freshCall = deferred.calls.slice(2).find(call => call.options.lane === 'foreground')!
    const freshId = targetIds(freshCall.job)[0]
    freshCall.options.onPartialResult?.({ id: freshId, translatedText: 'fresh', cacheable: true })
    expect(segments.find(item => item.id === freshId)).toMatchObject({
      status: 'translated',
      translatedText: 'fresh',
    })
    expect(onTranslationCommitted).toHaveBeenCalledTimes(1)

    scheduler.stop()
  })

  it('reports starting, catching-up, and buffered as runway becomes usable', async () => {
    const video = document.createElement('video')
    const segments = timeline(14)
    const deferred = createDeferredTranslator()
    const onStatus = vi.fn((_snapshot: SubtitleSchedulerSnapshot) => undefined)
    const scheduler = createScheduler(video, segments, deferred.translateBatch, { onStatus })

    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))
    expect(onStatus.mock.calls.some(([snapshot]) => snapshot.phase === 'starting')).toBe(true)

    const foreground = deferred.calls.find(call => call.options.lane === 'foreground')!
    const firstId = targetIds(foreground.job)[0]
    foreground.options.onPartialResult?.({ id: firstId, translatedText: 'first', cacheable: true })
    expect(onStatus.mock.calls.some(([snapshot]) => snapshot.phase === 'catching-up')).toBe(true)

    for (const call of deferred.calls) call.resolve(translateTargets(call.job))
    await vi.waitFor(() => {
      expect(onStatus.mock.calls.some(([snapshot]) => snapshot.phase === 'buffered')).toBe(true)
    })

    scheduler.stop()
  })

  it('reports failed when the active foreground cue fails', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'failure', 3)]
    const onStatus = vi.fn((_snapshot: SubtitleSchedulerSnapshot) => undefined)
    const translateBatch = vi.fn().mockRejectedValue(new Error('failed'))
    const scheduler = createScheduler(video, segments, translateBatch, { onStatus })

    scheduler.start()
    await vi.waitFor(() => expect(segments[0].status).toBe('failed'))
    expect(onStatus.mock.calls.some(([snapshot]) => (
      snapshot.phase === 'failed' && snapshot.failedInImmediateWindow
    ))).toBe(true)
    expect(scheduler.getSnapshot().runwaySeconds).toBe(0)
    expect(translateBatch).toHaveBeenCalledTimes(1)

    video.currentTime = 4
    video.dispatchEvent(new Event('timeupdate'))
    expect(scheduler.getSnapshot()).toMatchObject({
      phase: 'buffered',
      runwaySeconds: 45,
      failedInImmediateWindow: false,
    })

    scheduler.stop()
  })

  it('continues filling the runway while the video is paused', async () => {
    const video = document.createElement('video')
    const segments = timeline(40, 1)
    const deferred = createDeferredTranslator()
    const scheduler = createScheduler(video, segments, deferred.translateBatch)

    expect(video.paused).toBe(true)
    scheduler.start()
    await vi.waitFor(() => expect(deferred.calls).toHaveLength(2))

    const foreground = deferred.calls.find(call => call.options.lane === 'foreground')!
    foreground.resolve(translateTargets(foreground.job))
    video.dispatchEvent(new Event('pause'))
    await vi.waitFor(() => expect(deferred.calls.length).toBeGreaterThanOrEqual(3))

    expect(deferred.calls[2].options.lane).toBe('foreground')
    scheduler.stop()
  })

  it('stays ahead for two minutes after a 20-second cold-start response', async () => {
    vi.useFakeTimers()
    const video = document.createElement('video')
    const segments = timeline(70, 3)
    const translateBatch = vi.fn((
      job: SubtitleTranslationJob,
    ) => new Promise<SubtitleTranslationResult[]>(resolve => {
      setTimeout(() => resolve(translateTargets(job)), 20_000)
    }))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    for (let second = 1; second <= 140; second++) {
      video.currentTime = second
      video.dispatchEvent(new Event('timeupdate'))
      await vi.advanceTimersByTimeAsync(1_000)

      if (second < 20) continue
      const active = segments.find(item => item.start <= second && item.end > second)
      expect(active?.status, `translation fell behind at ${second}s`).toBe('translated')
    }

    scheduler.stop()
  })

  it('does not cross a one-second gap or a non-speech marker', async () => {
    const gapVideo = document.createElement('video')
    const gapSegments = [segment(0, 'first'), segment(1, 'second'), segment(3, 'after-gap')]
    const gapDeferred = createDeferredTranslator()
    const gapScheduler = createScheduler(gapVideo, gapSegments, gapDeferred.translateBatch)
    gapScheduler.start()
    await vi.waitFor(() => expect(gapDeferred.calls.length).toBeGreaterThan(0))
    expect(targetIds(gapDeferred.calls.find(call => call.options.lane === 'foreground')!.job)).toEqual(['0', '1'])
    gapScheduler.stop()

    const markerVideo = document.createElement('video')
    const markerSegments = [segment(0, 'first'), segment(1, '[Music]'), segment(2, 'after-marker')]
    const markerDeferred = createDeferredTranslator()
    const markerScheduler = createScheduler(markerVideo, markerSegments, markerDeferred.translateBatch)
    markerScheduler.start()
    await vi.waitFor(() => expect(markerDeferred.calls.length).toBeGreaterThan(0))
    expect(targetIds(markerDeferred.calls.find(call => call.options.lane === 'foreground')!.job)).toEqual(['0'])
    markerScheduler.stop()
  })
})
