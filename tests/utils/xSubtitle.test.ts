import { describe, expect, it, vi } from 'vitest'
import { parseSubtitleData } from '@/entrypoints/video/parser'
import { createXSubtitleRequest, loadXSubtitle } from '@/entrypoints/video/xSubtitle'
import { getXVideoContext } from '@/entrypoints/video/xVideoPlayer'

const cdn = 'https://video.twimg.com'
const mediaKey = 'amplify_video/2101938030122868736'
const otherMediaKey = 'amplify_video/2102088787962548224'
const postId = '2102050467505430555'
const master = `${cdn}/${mediaKey}/pl/master.m3u8?v=bd3`
const playlist = `${cdn}/${mediaKey}/pl/s0/captions.m3u8`
const vtt = `${cdn}/subtitles/${mediaKey}/0/english.vtt`
const post = JSON.stringify({
  id_str: postId,
  mediaDetails: [
    { type: 'video', video_info: { variants: [{ url: master }] } },
    { type: 'video', video_info: { variants: [{ url: `${cdn}/${otherMediaKey}/pl/master.m3u8` }] } },
  ],
})

function mockFetch(resources: Record<string, string>) {
  return vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input))
    const key = url.hostname === 'cdn.syndication.twimg.com' ? 'post' : url.href
    return key in resources ? new Response(resources[key]) : new Response(null, { status: 404 })
  })
}

describe('X and Teapaw subtitle source', () => {
  it('resolves the matching video from post metadata and passes its original subtitles to the shared parser', async () => {
    const data = 'WEBVTT\n\n00:00:01.360 --> 00:00:02.741\n<X-word-ms ms=240>Hi, my name\'s Lauren</X-word-ms>'
    const fetcher = mockFetch({
      post,
      [master]: `#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,NAME="English, auto-generated",URI="/${mediaKey}/pl/s0/captions.m3u8",LANGUAGE="en"`,
      [playlist]: `#EXTM3U\n#EXTINF:2281.984,\n/subtitles/${mediaKey}/0/english.vtt\n#EXT-X-ENDLIST`,
      [vtt]: data,
    })
    const result = await loadXSubtitle(createXSubtitleRequest(postId, mediaKey), fetcher)

    expect(result).toEqual({ status: 'ready', url: vtt, data, language: 'en' })
    expect(parseSubtitleData(vtt, data)?.cues).toEqual([{ start: 1.36, end: 2.741, text: "Hi, my name's Lauren" }])
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `https://cdn.syndication.twimg.com/tweet-result?id=${postId}&token=53fsb1wgh6r`,
      master, playlist, vtt,
    ])
  })

  it('uses a matching manifest from the player and reports no subtitles without fetching media', async () => {
    const fetcher = mockFetch({ [master]: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=32000\naudio.m3u8' })
    await expect(loadXSubtitle(createXSubtitleRequest(postId, mediaKey, master), fetcher))
      .resolves.toEqual({ status: 'no-track' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not select another video when the post contains multiple videos', async () => {
    const fetcher = mockFetch({ post })
    await expect(loadXSubtitle(createXSubtitleRequest(postId), fetcher)).resolves.toEqual({ status: 'no-track' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('distinguishes a load failure from an empty track and blocks a different media ID', async () => {
    const request = createXSubtitleRequest(postId, mediaKey, master)
    await expect(loadXSubtitle(request, mockFetch({}))).resolves.toEqual({ status: 'failed' })

    const fetcher = mockFetch({
      [master]: `#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,URI="/${otherMediaKey}/pl/s0/captions.m3u8"`,
    })
    await expect(loadXSubtitle(request, fetcher)).resolves.toEqual({ status: 'failed' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses the selected reply’s permalink on Teapaw and the selected tweet on X', () => {
    window.location.href = `https://teapaw.org/poteto/status/${postId}`
    document.body.innerHTML = `
      <div class="timeline-item">
        <span class="tweet-date"><a href="/reply/status/123#m">Reply</a></span>
        <video><source src="${cdn}/${otherMediaKey}/vid/video.mp4"></video>
      </div>`
    expect(getXVideoContext(document.querySelector('video')!)).toEqual({ postId: '123', mediaKey: otherMediaKey })

    window.location.href = 'https://x.com/home'
    document.body.innerHTML = `
      <article data-testid="tweet">
        <a href="/poteto/status/${postId}"><time></time></a>
        <video poster="https://pbs.twimg.com/amplify_video_thumb/2101938030122868736/img/poster.jpg"></video>
      </article>`
    expect(getXVideoContext(document.querySelector('video')!)).toEqual({ postId, mediaKey })
  })
})
