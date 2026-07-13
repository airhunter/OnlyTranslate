import { describe, expect, it } from 'vitest'
import { buildSubtitleTrackKey, isSubtitleTrackForPage } from '@/entrypoints/video/track'

describe('video subtitle track identity', () => {
  it('distinguishes YouTube language and track changes', () => {
    const page = 'https://www.youtube.com/watch?v=video'
    const english = buildSubtitleTrackKey('/api/timedtext?v=video&lang=en&kind=asr', page)
    const french = buildSubtitleTrackKey('/api/timedtext?v=video&lang=fr&kind=asr', page)

    expect(english).toBe('youtube|video|en|asr||')
    expect(french).not.toBe(english)
  })

  it('normalizes generic resource query ordering and removes fragments', () => {
    const first = buildSubtitleTrackKey('https://cdn.example/subtitle.vtt?lang=en&track=main#cue')
    const second = buildSubtitleTrackKey('https://cdn.example/subtitle.vtt?track=main&lang=en')

    expect(first).toBe(second)
  })

  it('rejects stale YouTube timedtext responses after SPA navigation', () => {
    const page = 'https://www.youtube.com/watch?v=new-video'

    expect(isSubtitleTrackForPage('/api/timedtext?v=new-video&lang=en', page)).toBe(true)
    expect(isSubtitleTrackForPage('/api/timedtext?v=old-video&lang=en', page)).toBe(false)
    expect(isSubtitleTrackForPage('https://cdn.example/subtitle.vtt', page)).toBe(true)
  })
})
