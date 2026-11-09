import { describe, expect, it } from 'vitest'
import {
  getYouTubeCardVideoId, getYouTubeVideoId, isOnlyTranslateYouTubeEmbed, isYouTubePlayerMessage,
  YOUTUBE_EMBED_QUERY, YOUTUBE_PLAYER_READY,
} from '@/entrypoints/video/youtubeEmbed'
import { isSubtitleTrackForPage } from '@/entrypoints/video/track'

const id = 'B93JLId4emc'
const watch = `https://www.youtube.com/watch?v=${id}`
const embed = `https://www.youtube.com/embed/${id}${YOUTUBE_EMBED_QUERY}#onlytranslate-player`

describe('in-page YouTube player', () => {
  it('reads direct video links and the two sites’ real card formats', () => {
    expect(getYouTubeVideoId(watch)).toBe(id)
    expect(getYouTubeVideoId(`https://youtu.be/${id}?t=25`)).toBe(id)
    expect(getYouTubeVideoId(`https://l.threads.com/?u=${encodeURIComponent(`https://youtube.com/live/${id}`)}&e=tracking`)).toBe(id)

    const x = document.createElement('a')
    x.href = 'https://t.co/bAcqlSjcSI'
    x.title = `https://youtube.com/live/${id}`
    x.textContent = 'youtube.com/live/B93JLId4e…'
    expect(getYouTubeCardVideoId(x)).toBe(id)
  })

  it('rejects non-video pages and lookalike or indirect destinations', () => {
    expect(getYouTubeVideoId('https://youtube.com/@applegeek')).toBeNull()
    expect(getYouTubeVideoId(`https://youtube.com.example.org/watch?v=${id}`)).toBeNull()
    expect(getYouTubeVideoId(`https://l.threads.com/?u=${encodeURIComponent('https://example.org/?v=' + id)}`)).toBeNull()
    expect(getYouTubeVideoId(`https://youtu.be/${id}/extra`)).toBeNull()
  })

  it('recognizes marked player requests and rejects stale tracks', () => {
    expect(isOnlyTranslateYouTubeEmbed(embed)).toBe(true)
    expect(isOnlyTranslateYouTubeEmbed(embed.split('#')[0])).toBe(false)
    expect(isOnlyTranslateYouTubeEmbed(embed.replace('&onlytranslate_player=1', ''))).toBe(false)
    expect(isOnlyTranslateYouTubeEmbed(embed.replace('www.youtube.com', 'www.youtube.com.example.org'))).toBe(false)
    expect(isSubtitleTrackForPage(`/api/timedtext?v=${id}&lang=en`, embed)).toBe(true)
    expect(isSubtitleTrackForPage('/api/timedtext?v=abcdefghijk&lang=en', embed)).toBe(false)
  })

  it('requires the expected frame, origin and message before opening the player', () => {
    const origin = 'https://www.youtube.com'
    const message = (source: Window, from: string, data = YOUTUBE_PLAYER_READY) =>
      new MessageEvent('message', { source, origin: from, data })
    const sibling = document.createElement('iframe')
    document.body.append(sibling)
    try {
      expect(isYouTubePlayerMessage(message(window, origin), window, origin, YOUTUBE_PLAYER_READY)).toBe(true)
      expect(isYouTubePlayerMessage(message(window, origin), sibling.contentWindow, origin, YOUTUBE_PLAYER_READY)).toBe(false)
      expect(isYouTubePlayerMessage(message(window, 'https://x.com'), window, origin, YOUTUBE_PLAYER_READY)).toBe(false)
      expect(isYouTubePlayerMessage(message(window, origin, 'unexpected'), window, origin, YOUTUBE_PLAYER_READY)).toBe(false)
    } finally {
      sibling.remove()
    }
  })
})
