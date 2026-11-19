import { describe, expect, it, vi } from 'vitest'
import { parseSubtitleData } from '@/entrypoints/video/parser'
import {
  createRedditSubtitleRequest, getRedditVideoId, isRedditSubtitleRequest,
  isRedditVideoSubtitleHost, loadRedditSubtitle,
} from '@/entrypoints/video/redditSubtitle'

const videoId = 'eflpgc6r0zxf1'
const url = `https://v.redd.it/${videoId}/wh_ben_en.vtt`
// Minimal excerpt of the actual 1oiu9xm track: successive word highlights repeat the same text.
const data = `WEBVTT

00:00.000 --> 00:00.300
<u>stop</u> on third down and now Barnhart I
hanging

00:00.300 --> 00:00.560
stop <u>on</u> third down and now Barnhart I
hanging
`

describe('Reddit subtitle source', () => {
  it('loads the player caption URL and reuses VTT redraw deduplication', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(data))
    const result = await loadRedditSubtitle(createRedditSubtitleRequest(videoId, url), fetcher)
    expect(result).toEqual({ status: 'ready', url, data, language: 'en' })
    expect(parseSubtitleData(url, data)?.cues).toEqual([
      { start: 0, end: 0.56, text: 'stop on third down and now Barnhart I hanging' },
    ])
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
    }))
  })

  it('uses the known English caption path when legacy players expose only their media ID', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(data))
    await expect(loadRedditSubtitle(createRedditSubtitleRequest(videoId), fetcher))
      .resolves.toEqual({ status: 'ready', url, data, language: 'en' })
  })

  it('rejects unrelated media, credentials, lookalike origins and malformed requests before fetching', async () => {
    for (const captionUrl of [
      'https://evil.example/wh_ben_en.vtt',
      `https://v.redd.it.evil.example/${videoId}/en.vtt`,
      `https://user:pass@v.redd.it/${videoId}/en.vtt`,
      'https://v.redd.it/othervideo123/en.vtt',
      `https://v.redd.it/${videoId}/DASH_720.mp4`,
    ]) {
      const fetcher = vi.fn<typeof fetch>()
      const request = createRedditSubtitleRequest(videoId, captionUrl)
      expect(isRedditSubtitleRequest(request)).toBe(false)
      await expect(loadRedditSubtitle(request, fetcher)).resolves.toEqual({ status: 'failed' })
      expect(fetcher).not.toHaveBeenCalled()
    }
    expect(isRedditSubtitleRequest(null)).toBe(false)
    expect(isRedditSubtitleRequest(createRedditSubtitleRequest('../escape'))).toBe(false)
    expect(getRedditVideoId(`https://v.redd.it/${videoId}/HLSPlaylist.m3u8?v=1`)).toBe(videoId)
    expect(getRedditVideoId(`http://v.redd.it/${videoId}/video.mp4`)).toBeUndefined()
    expect(isRedditVideoSubtitleHost('old.reddit.com')).toBe(true)
    expect(isRedditVideoSubtitleHost('reddit.com.evil.example')).toBe(false)
  })

  it('distinguishes missing tracks, denied requests, malformed bodies and network failures', async () => {
    for (const [response, expected] of [
      [new Response(null, { status: 404 }), 'no-track'],
      [new Response(null, { status: 403 }), 'failed'],
      [new Response('<html>blocked</html>'), 'failed'],
    ] as const) {
      await expect(loadRedditSubtitle(createRedditSubtitleRequest(videoId), vi.fn().mockResolvedValue(response)))
        .resolves.toEqual({ status: expected })
    }
    await expect(loadRedditSubtitle(createRedditSubtitleRequest(videoId), vi.fn().mockRejectedValue(new Error('offline'))))
      .resolves.toEqual({ status: 'failed' })
    await expect(loadRedditSubtitle(createRedditSubtitleRequest(videoId), vi.fn().mockResolvedValue(new Response('WEBVTT\n\n'))))
      .resolves.toEqual({ status: 'ready', url, data: 'WEBVTT\n\n', language: 'en' })
  })
})
