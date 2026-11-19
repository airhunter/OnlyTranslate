import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRedditVideoContext, getRedditVideoContextKey, getRedditVideoMountTarget, getRedditVideoRequest,
  isRedditVideoForCurrentPost, setRedditNativeSubtitleHidden, watchRedditVideoPlayers,
} from '@/entrypoints/video/redditVideoPlayer'

const id = 'eflpgc6r0zxf1'
const captionUrl = `https://v.redd.it/${id}/wh_ben_en.vtt`

// Structure captured from the live 1oiu9xm player after manual CAPTCHA completion.
function makePlayer(mediaId = id, postId = '1oiu9xm') {
  const player = document.createElement('shreddit-player')
  player.setAttribute('src', `https://v.redd.it/${mediaId}/HLSPlaylist.m3u8?v=1`)
  player.setAttribute('post-id', `t3_${postId}`)
  player.setAttribute('caption-url', `https://v.redd.it/${mediaId}/wh_ben_en.vtt`)
  const root = player.attachShadow({ mode: 'open' })
  root.innerHTML = '<video src="blob:https://www.reddit.com/opaque"></video><shreddit-media-ui></shreddit-media-ui>'
  const ui = root.querySelector('shreddit-media-ui')!.attachShadow({ mode: 'open' })
  ui.innerHTML = '<shreddit-caption-overlay></shreddit-caption-overlay><shreddit-preview-video-lazy></shreddit-preview-video-lazy>'
  const previewRoot = ui.querySelector('shreddit-preview-video-lazy')!.attachShadow({ mode: 'open' })
  previewRoot.innerHTML = `<video src="https://v.redd.it/${mediaId}/DASH_96.mp4"></video>`
  document.body.append(player)
  return { player, root, video: root.querySelector('video')!, preview: previewRoot.querySelector('video')!, ui }
}

describe('Reddit video association and dynamic players', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    window.location.href = 'https://www.reddit.com/r/youseeingthisshit/comments/1oiu9xm/example/'
  })

  it('associates the actual shadow video, ignores seek previews, and mounts visible shadow UI', () => {
    const { video, preview, root, ui } = makePlayer()
    expect(getRedditVideoContext(video)).toEqual({ videoId: id, postId: '1oiu9xm', captionUrl })
    expect(getRedditVideoRequest(video)).toEqual({ type: 'LOAD_REDDIT_VIDEO_SUBTITLE', videoId: id, captionUrl })
    expect(getRedditVideoContext(preview)).toBeUndefined()
    expect(isRedditVideoForCurrentPost(video)).toBe(true)
    const target = getRedditVideoMountTarget(video)!
    expect(target.getRootNode()).toBe(root)
    expect(getRedditVideoMountTarget(video)).toBe(target)
    setRedditNativeSubtitleHidden(video, true)
    expect(ui.querySelector<HTMLElement>('shreddit-caption-overlay')!.style.visibility).toBe('hidden')
    setRedditNativeSubtitleHidden(video, false)
    expect(ui.querySelector<HTMLElement>('shreddit-caption-overlay')!.style.visibility).toBe('')
  })

  it('tracks media and caption changes rather than relying on a blob URL or the page post alone', () => {
    const { player, video } = makePlayer()
    const key = getRedditVideoContextKey(video)
    player.setAttribute('src', 'https://v.redd.it/anothervideo1/HLSPlaylist.m3u8')
    expect(getRedditVideoContextKey(video)).not.toBe(key)
    player.removeAttribute('src')
    expect(getRedditVideoRequest(video)).toBeUndefined()
    document.body.innerHTML = `<div data-mpd-url="https://v.redd.it/${id}/DASHPlaylist.mpd"><video src="blob:legacy"></video></div>`
    expect(getRedditVideoRequest(document.querySelector('video')!)?.videoId).toBe(id)
  })

  it('discovers lazy shadow videos, observes source changes, follows non-composed play events and cleans removal', async () => {
    const mount = vi.fn(), unmount = vi.fn(), changed = vi.fn(), played = vi.fn()
    const stop = watchRedditVideoPlayers(mount, unmount, changed, played)
    try {
      const { player, video, root, preview } = makePlayer()
      await vi.waitFor(() => expect(mount).toHaveBeenCalledWith(video))
      expect(mount).not.toHaveBeenCalledWith(preview)
      video.dispatchEvent(new Event('play', { composed: false }))
      expect(played).toHaveBeenCalledWith(video)
      changed.mockClear()
      player.setAttribute('caption-url', `https://v.redd.it/${id}/other_en.vtt`)
      await vi.waitFor(() => expect(changed).toHaveBeenCalled())
      video.remove()
      await vi.waitFor(() => expect(unmount).toHaveBeenCalledWith(video))
      const replacement = document.createElement('video')
      root.prepend(replacement)
      await vi.waitFor(() => expect(mount).toHaveBeenCalledWith(replacement))
      player.remove()
      await vi.waitFor(() => expect(unmount).toHaveBeenCalledWith(replacement))
    } finally { stop() }
  })
})
