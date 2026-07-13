import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseSubtitleData,
  parseVTT,
  parseYouTubeJSON3,
  parseYouTubeXML,
} from '@/entrypoints/video/parser'

const fixture = (name: string) => readFileSync(
  resolve(process.cwd(), 'tests/fixtures/video-subtitle', name),
  'utf8',
)

describe('video subtitle parser', () => {
  it('normalizes standard JSON3, removes styled duplicates and preserves timed breaks', () => {
    const cues = parseYouTubeJSON3(fixture('youtube-standard.json'))

    expect(cues.map(cue => cue.text)).toEqual([
      'Hello world',
      'Timed text',
      'Missing duration',
      'Next',
    ])
    expect(cues[1]).toMatchObject({ start: 1.5, end: 2 })
    expect(cues[2]).toMatchObject({ start: 4, end: 5.5 })
  })

  it('collapses progressive redraws to the longest visible sentence', () => {
    const cues = parseYouTubeJSON3(fixture('youtube-progressive-redraw.json'))

    expect(cues).toEqual([{ start: 0, end: 1.4, text: 'The United States' }])
  })

  it('detects and parses scrolling ASR separately', () => {
    const parsed = parseSubtitleData(
      'https://www.youtube.com/api/timedtext?v=video&lang=en&fmt=json3',
      fixture('youtube-scrolling-asr.json'),
    )

    expect(parsed?.format).toBe('youtube-json3-scrolling')
    expect(parsed?.sourceLanguage).toBe('en')
    expect(parsed?.cues.map(cue => cue.text)).toEqual(['Hello', 'World'])
  })

  it('uses the effective YouTube track language and prefers tlang', () => {
    const translatedTrack = parseSubtitleData(
      'https://www.youtube.com/api/timedtext?v=video&lang=en&tlang=zh-Hans&fmt=json3',
      fixture('youtube-standard.json'),
    )
    const originalTrack = parseSubtitleData(
      'https://www.youtube.com/api/timedtext?v=video&lang=fr&fmt=json3',
      fixture('youtube-standard.json'),
    )

    expect(translatedTrack?.sourceLanguage).toBe('zh-Hans')
    expect(originalTrack?.sourceLanguage).toBe('fr')
  })

  it('keeps generic VTT and parameterless YouTube languages undefined', () => {
    const genericVtt = parseSubtitleData(
      'https://example.com/subtitles.vtt?lang=fr',
      fixture('sample.vtt'),
    )
    const parameterlessTrack = parseSubtitleData(
      'https://www.youtube.com/api/timedtext?v=video&fmt=json3',
      fixture('youtube-standard.json'),
    )

    expect(genericVtt?.sourceLanguage).toBeUndefined()
    expect(parameterlessTrack?.sourceLanguage).toBeUndefined()
  })

  it('keeps unrelated overlapping XML cues separate while collapsing prefix redraws', () => {
    const cues = parseYouTubeXML(`
      <transcript>
        <text start="0" dur="1">Hello</text>
        <text start="0.2" dur="1">Hello world</text>
        <text start="0.5" dur="1">Different speaker</text>
      </transcript>
    `)

    expect(cues).toEqual([
      { start: 0, end: 1.2, text: 'Hello world' },
      { start: 0.5, end: 1.5, text: 'Different speaker' },
    ])
  })

  it('parses VTT cue settings, multiline text, tags and entities', () => {
    expect(parseVTT(fixture('sample.vtt'))).toEqual([
      { start: 0, end: 1.5, text: 'Hello & world' },
      { start: 2, end: 3, text: 'Second line' },
    ])
  })
})
