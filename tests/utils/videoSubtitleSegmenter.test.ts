import { describe, expect, it } from 'vitest'
import { buildSubtitleSegments, subtitleSegmentationDefaults } from '@/entrypoints/video/segmenter'
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

  it('caps non-CJK groups without leaving the last cue isolated', () => {
    const cues = Array.from({ length: 21 }, (_, index) => cue(index * 0.2, index * 0.2 + 0.1, `word${index}`))
    const segments = buildSubtitleSegments(cues, 'en')

    expect(segments).toHaveLength(2)
    expect(segments[0].sourceText.split(/\s+/)).toHaveLength(19)
    expect(segments[1].sourceText.split(/\s+/)).toHaveLength(2)
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
    expect(subtitleSegmentationDefaults.maxDurationSeconds).toBe(10)
  })
})
