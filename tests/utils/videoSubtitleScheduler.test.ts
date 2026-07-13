import { describe, expect, it, vi } from 'vitest'
import { SubtitleTranslationScheduler, subtitleSchedulingDefaults } from '@/entrypoints/video/scheduler'
import type {
  SubtitleSegment,
  SubtitleTranslationJob,
  SubtitleTranslationResult,
} from '@/entrypoints/video/types'

const segment = (start: number, sourceText: string): SubtitleSegment => ({
  id: `${start}`,
  start,
  end: start + 1,
  sourceText,
  status: 'pending',
})

const createScheduler = (
  video: HTMLVideoElement,
  segments: SubtitleSegment[],
  translateBatch: (job: SubtitleTranslationJob) => Promise<SubtitleTranslationResult[]>,
) => new SubtitleTranslationScheduler({
  video,
  segments,
  trackKey: 'video:track',
  sessionId: 'session-1',
  title: 'Video title',
  sourceLanguage: 'en',
  targetLanguage: 'zh-CN',
  translateBatch,
  onUpdate: vi.fn(),
})

const translateTargets = async (job: SubtitleTranslationJob): Promise<SubtitleTranslationResult[]> => (
  job.entries
    .filter(entry => entry.role === 'target')
    .map(entry => ({ id: entry.id, translatedText: `translated:${entry.text}` }))
)

describe('video subtitle translation scheduler', () => {
  it('translates only pending segments in the current playback window', async () => {
    const video = document.createElement('video')
    video.currentTime = 0
    const segments = [segment(0, 'now'), segment(1, 'soon'), segment(60, 'later')]
    const translateBatch = vi.fn(translateTargets)
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(segments[1].status).toBe('translated'))

    expect(segments.map(item => item.status)).toEqual(['translated', 'translated', 'pending'])
    expect(translateBatch).toHaveBeenCalledTimes(1)
    expect(subtitleSchedulingDefaults.lookAheadSeconds).toBe(45)
    scheduler.stop()
  })

  it('uses five chronological positions and marks surrounding source text as context', async () => {
    const video = document.createElement('video')
    video.currentTime = 4.2
    const segments = Array.from({ length: 10 }, (_, index) => segment(index, `line-${index}`))
    segments[5].status = 'translated'
    let resolveBatch!: (results: SubtitleTranslationResult[]) => void
    const translateBatch = vi.fn((_job: SubtitleTranslationJob) => new Promise<SubtitleTranslationResult[]>(resolve => {
      resolveBatch = resolve
    }))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalledTimes(1))

    const job = translateBatch.mock.calls[0][0]
    expect(job).toMatchObject({
      trackKey: 'video:track',
      sessionId: 'session-1',
      title: 'Video title',
      sourceLanguage: 'en',
      targetLanguage: 'zh-CN',
      promptVersion: subtitleSchedulingDefaults.promptVersion,
    })
    expect(job.entries.map(entry => [entry.id, entry.role])).toEqual([
      ['2', 'context'],
      ['3', 'context'],
      ['4', 'target'],
      ['5', 'context'],
      ['6', 'target'],
      ['7', 'target'],
      ['8', 'target'],
      ['9', 'context'],
    ])
    expect(segments.filter(item => item.status === 'translating').map(item => item.id)).toEqual(['4', '6', '7', '8'])
    expect(job.entries.every(entry => entry.text === segments[Number(entry.id)].sourceText)).toBe(true)

    scheduler.stop()
    resolveBatch([])
  })

  it('does not cross a one-second gap or a non-speech marker', async () => {
    const video = document.createElement('video')
    const gapSegments = [segment(0, 'first'), segment(1, 'second'), segment(3, 'after-gap')]
    const gapTranslate = vi.fn((_job: SubtitleTranslationJob) => new Promise<SubtitleTranslationResult[]>(() => {}))
    const gapScheduler = createScheduler(video, gapSegments, gapTranslate)

    gapScheduler.start()
    await vi.waitFor(() => expect(gapTranslate).toHaveBeenCalledTimes(1))
    expect(gapTranslate.mock.calls[0][0].entries.map(entry => entry.id)).toEqual(['0', '1'])
    gapScheduler.stop()

    const markerSegments = [segment(0, 'first'), segment(1, '[Music]'), segment(2, 'after-marker')]
    const markerTranslate = vi.fn((_job: SubtitleTranslationJob) => new Promise<SubtitleTranslationResult[]>(() => {}))
    const markerScheduler = createScheduler(video, markerSegments, markerTranslate)

    markerScheduler.start()
    await vi.waitFor(() => expect(markerTranslate).toHaveBeenCalledTimes(1))
    expect(markerTranslate.mock.calls[0][0].entries.map(entry => entry.id)).toEqual(['0'])
    markerScheduler.stop()
  })

  it('drops distant context before reducing future targets to fit the character budget', async () => {
    const video = document.createElement('video')
    video.currentTime = 2.2
    const segments = Array.from({ length: 8 }, (_, index) => segment(index, `${index}`.repeat(1600)))
    segments[0].status = 'translated'
    segments[1].status = 'translated'
    segments[7].status = 'translated'
    const translateBatch = vi.fn((_job: SubtitleTranslationJob) => new Promise<SubtitleTranslationResult[]>(() => {}))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalledTimes(1))

    const entries = translateBatch.mock.calls[0][0].entries
    expect(entries.map(entry => [entry.id, entry.role])).toEqual([
      ['2', 'target'],
      ['3', 'target'],
      ['4', 'target'],
    ])
    expect(entries.reduce((total, entry) => total + entry.text.length, 0))
      .toBeLessThanOrEqual(subtitleSchedulingDefaults.maxRequestCharacters)
    expect(segments[5].status).toBe('pending')
    expect(segments[6].status).toBe('pending')
    scheduler.stop()
  })

  it('immediately prioritizes a seek destination and discards the old epoch result', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'start'), segment(100, 'seek-target')]
    const pending: Array<{
      job: SubtitleTranslationJob
      signal?: AbortSignal
      resolve: (results: SubtitleTranslationResult[]) => void
    }> = []
    const translateBatch = vi.fn((job: SubtitleTranslationJob, signal?: AbortSignal) => new Promise<SubtitleTranslationResult[]>(resolve => {
      pending.push({ job, signal, resolve })
    }))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalledTimes(1))

    video.currentTime = 100
    video.dispatchEvent(new Event('seeked'))
    await vi.waitFor(() => expect(translateBatch).toHaveBeenCalledTimes(2))
    expect(pending[0].signal?.aborted).toBe(true)
    expect(pending[1].job.entries.find(entry => entry.role === 'target')?.id).toBe('100')

    pending[1].resolve([{ id: '100', translatedText: 'destination' }])
    await vi.waitFor(() => expect(segments[1].status).toBe('translated'))
    pending[0].resolve([{ id: '0', translatedText: 'stale' }])
    await Promise.resolve()
    await Promise.resolve()

    expect(segments[0].status).toBe('pending')
    expect(segments[0].translatedText).toBeUndefined()
    scheduler.stop()
  })

  it('maps results by ID and rejects missing or duplicate target results', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'first'), segment(1, 'second'), segment(2, 'third')]
    const translateBatch = vi.fn(async () => [
      { id: '2', translatedText: 'third-result' },
      { id: '1', translatedText: 'second-result' },
      { id: '1', translatedText: 'duplicate-result' },
    ])
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(segments.every(item => ['translated', 'failed'].includes(item.status))).toBe(true))

    expect(segments[0]).toMatchObject({ status: 'failed', translatedText: undefined })
    expect(segments[1]).toMatchObject({ status: 'failed', translatedText: undefined })
    expect(segments[2]).toMatchObject({ status: 'translated', translatedText: 'third-result' })
    scheduler.stop()
  })

  it('discards stale results after the session stops', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'stale')]
    let resolveBatch!: (results: SubtitleTranslationResult[]) => void
    const translateBatch = vi.fn((_job: SubtitleTranslationJob) => new Promise<SubtitleTranslationResult[]>(resolve => {
      resolveBatch = resolve
    }))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(segments[0].status).toBe('translating'))
    scheduler.stop()
    resolveBatch([{ id: '0', translatedText: 'must-not-write' }])
    await Promise.resolve()
    await Promise.resolve()

    expect(segments[0].status).toBe('pending')
    expect(segments[0].translatedText).toBeUndefined()
  })

  it('marks batch failures once without an automatic retry loop', async () => {
    const video = document.createElement('video')
    const segments = [segment(0, 'failure')]
    const translateBatch = vi.fn().mockRejectedValue(new Error('failed'))
    const scheduler = createScheduler(video, segments, translateBatch)

    scheduler.start()
    await vi.waitFor(() => expect(segments[0].status).toBe('failed'))

    expect(translateBatch).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })
})
