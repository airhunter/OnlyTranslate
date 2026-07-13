import { describe, expect, it } from 'vitest'
import {
  buildSubtitleSegments,
  segmenterVersion,
  subtitleSegmentationDefaults,
} from '@/entrypoints/video/segmenter'
import type { SubtitleCue } from '@/entrypoints/video/types'

const cue = (start: number, end: number, text: string): SubtitleCue => ({ start, end, text })

describe('video subtitle segmenter', () => {
  it('merges short pauses and splits gaps of one second', () => {
    const segments = buildSubtitleSegments([
      cue(0, 0.4, 'Hello'),
      cue(0.8, 1.2, 'world'),
      cue(2.2, 2.6, 'Next sentence'),
    ], 'en')

    expect(segments.map(segment => segment.sourceText)).toEqual(['Hello world', 'Next sentence'])
  })

  it('uses sentence punctuation once a useful phrase has formed', () => {
    const segments = buildSubtitleSegments([
      cue(0, 1, 'This is a complete useful sentence.'),
      cue(1.1, 2, 'Another thought'),
    ], 'en')

    expect(segments).toHaveLength(2)
  })

  it('flushes complete groups for dense ASR instead of repeatedly carrying one cue', () => {
    const cues = Array.from({ length: 10 }, (_, index) => cue(
      index * 0.5,
      index * 0.5 + 0.4,
      Array.from({ length: 8 }, (_, word) => `cue${index}word${word}`).join(' '),
    ))
    const segments = buildSubtitleSegments(cues, 'en')

    expect(segments).toHaveLength(5)
    expect(segments.every(segment => segment.sourceText.split(/\s+/).length === 16)).toBe(true)
  })

  it('rebalances a single-cue region tail from 20+1 words to 19+2', () => {
    const cues = Array.from({ length: 21 }, (_, index) => cue(index * 0.2, index * 0.2 + 0.1, `word${index}`))
    const segments = buildSubtitleSegments(cues, 'en')

    expect(segments).toHaveLength(2)
    expect(segments[0].sourceText.split(/\s+/)).toHaveLength(19)
    expect(segments[1].sourceText.split(/\s+/)).toHaveLength(2)
  })

  it('does not rebalance across a hard gap', () => {
    const cues = [
      ...Array.from({ length: 20 }, (_, index) => cue(index * 0.2, index * 0.2 + 0.1, `word${index}`)),
      cue(5, 5.1, 'after-gap'),
    ]
    const segments = buildSubtitleSegments(cues, 'en')

    expect(segments.map(segment => segment.sourceText.split(/\s+/).length)).toEqual([20, 1])
  })

  it('uses a 30 character limit for CJK subtitles', () => {
    const cues = Array.from({ length: 31 }, (_, index) => cue(index * 0.2, index * 0.2 + 0.1, '字'))
    const segments = buildSubtitleSegments(cues, 'zh')

    expect(segments.map(segment => segment.sourceText.length)).toEqual([29, 2])
  })

  it('caps duration and returns non-overlapping segments', () => {
    const segments = buildSubtitleSegments([
      cue(0, 4, 'one'),
      cue(4.1, 8, 'two'),
      cue(8.1, 12, 'three'),
      cue(11.5, 13, 'four'),
    ], 'en')

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment, index) => index === 0 || segments[index - 1].end <= segment.start)).toBe(true)
    expect(segments.every(segment => segment.end - segment.start <= 10)).toBe(true)
  })

  it('keeps a long single cue visible using adjacent duration-limited slices', () => {
    const segments = buildSubtitleSegments([cue(0, 21.5, '[Music]')], 'en')

    expect(segments.map(segment => [segment.start, segment.end, segment.sourceText])).toEqual([
      [0, 10, '[Music]'],
      [10, 20, '[Music]'],
      [20, 21.5, '[Music]'],
    ])
  })

  it('splits an oversized single cue at text boundaries without duplicating words', () => {
    const sourceWords = Array.from({ length: 45 }, (_, index) => `word${index}`)
    const segments = buildSubtitleSegments([cue(0, 3, sourceWords.join(' '))], 'en')

    expect(segments.map(segment => segment.sourceText.split(/\s+/).length)).toEqual([20, 20, 5])
    expect(segments.flatMap(segment => segment.sourceText.split(/\s+/))).toEqual(sourceWords)
  })

  it('splits an oversized CJK cue without duplicating characters', () => {
    const sourceText = '字'.repeat(65)
    const segments = buildSubtitleSegments([cue(0, 3, sourceText)], 'zh')

    expect(segments.map(segment => segment.sourceText.length)).toEqual([30, 30, 5])
    expect(segments.map(segment => segment.sourceText).join('')).toBe(sourceText)
  })

  it('sorts long-cue slices with overlapping cues before removing overlap', () => {
    const segments = buildSubtitleSegments([
      cue(0, 21.5, '[Music]'),
      cue(5, 6, 'spoken line'),
    ], 'en')

    expect(segments.every((segment, index) => (
      segment.end - segment.start <= 10
      && (index === 0 || segments[index - 1].end <= segment.start)
    ))).toBe(true)
  })

  it('keeps oversized equal-start cues within limits without overlapping segments', () => {
    const first = Array.from({ length: 20 }, (_, index) => `first${index}`).join(' ')
    const second = Array.from({ length: 20 }, (_, index) => `second${index}`).join(' ')
    const segments = buildSubtitleSegments([
      cue(0, 2, first),
      cue(0, 2, second),
    ], 'en')

    expect(segments.map(segment => segment.sourceText)).toEqual([first, second])
    expect(segments.every(segment => segment.sourceText.split(/\s+/).length <= 20)).toBe(true)
    expect(segments[0].end).toBeLessThanOrEqual(segments[1].start)
  })

  it('keeps equal-start segments before a cue that begins inside their shared interval', () => {
    const first = Array.from({ length: 20 }, (_, index) => `first${index}`).join(' ')
    const second = Array.from({ length: 20 }, (_, index) => `second${index}`).join(' ')
    const third = Array.from({ length: 20 }, (_, index) => `third${index}`).join(' ')
    const segments = buildSubtitleSegments([
      cue(0, 2, first),
      cue(0, 2, second),
      cue(0.5, 2.5, third),
    ], 'en')

    expect(segments.map(segment => segment.sourceText)).toEqual([first, second, third])
    expect(segments.every((segment, index) => (
      index === 0 || segments[index - 1].end <= segment.start
    ))).toBe(true)
  })

  it('does not create a new equal-start overlap at the next cue boundary', () => {
    const first = Array.from({ length: 20 }, (_, index) => `first${index}`).join(' ')
    const second = Array.from({ length: 20 }, (_, index) => `second${index}`).join(' ')
    const third = Array.from({ length: 20 }, (_, index) => `third${index}`).join(' ')
    const segments = buildSubtitleSegments([
      cue(0, 2, first),
      cue(0, 2, second),
      cue(1, 3, third),
    ], 'en')

    expect(segments.map(segment => segment.sourceText)).toEqual([first, second, third])
    expect(segments.every((segment, index) => (
      index === 0 || segments[index - 1].end <= segment.start
    ))).toBe(true)
  })

  it('exports version 2 with the existing limits', () => {
    expect(segmenterVersion).toBe(2)
    expect(subtitleSegmentationDefaults).toMatchObject({
      version: 2,
      hardGapSeconds: 1,
      maxDurationSeconds: 10,
      maxWords: 20,
      maxCjkCharacters: 30,
    })
  })
})
