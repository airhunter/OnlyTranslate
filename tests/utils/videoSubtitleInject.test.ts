// @vitest-environment node

import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { describe, expect, it, vi } from 'vitest'

const injectedScript = readFileSync(
  new URL('../../public/video-subtitle-inject.js', import.meta.url),
  'utf8',
)

function dispatchMessage(window: Window, data: Record<string, unknown>) {
  const payload = JSON.stringify({ eventType: 'fr-subtitle-inject', ...data })
  window.eval(`window.postMessage(${payload}, window.location.origin)`)
}

function createYoutubeWindow({
  tracks,
  selectedTrack,
  fetchResponse,
  audioCaptionTracks = [],
}: {
  tracks: Array<Record<string, unknown>>
  selectedTrack?: Record<string, unknown>
  fetchResponse: { ok: boolean; text: string } | Array<{ ok: boolean; text: string }>
  audioCaptionTracks?: Array<Record<string, unknown>>
}) {
  const window = new Window({ url: 'https://www.youtube.com/watch?v=video' })
  const playerElement = window.document.createElement('div')
  const player = playerElement as typeof playerElement & {
    getPlayerResponse: () => unknown
    getOption: () => unknown
    getAudioTrack: () => unknown
    getWebPlayerContextConfig: () => unknown
    toggleSubtitles: ReturnType<typeof vi.fn>
  }
  player.className = 'html5-video-player playing-mode'
  player.getPlayerResponse = () => ({
    videoDetails: { videoId: 'video' },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } },
  })
  player.getOption = () => selectedTrack ?? null
  player.getAudioTrack = () => ({ captionTracks: audioCaptionTracks })
  player.getWebPlayerContextConfig = () => ({ innertubeContextClientVersion: '1.2.3' })
  player.toggleSubtitles = vi.fn()
  window.document.body.appendChild(player)

  const responses = Array.isArray(fetchResponse) ? [...fetchResponse] : [fetchResponse]
  const fetch = vi.fn().mockImplementation(async () => {
    const response = responses.shift() ?? responses.at(-1) ?? { ok: false, text: '' }
    return {
      ok: response.ok,
      url: '',
      text: async () => response.text,
      clone() { return this },
    }
  })
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetch })
  window.eval(injectedScript)

  return { window, player, fetch }
}

describe('video subtitle page-world injector', () => {
  it('actively fetches the selected YouTube caption track as JSON3', async () => {
    const english = {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=video&lang=en',
      languageCode: 'en',
      vssId: '.en',
    }
    const french = {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=video&lang=fr',
      languageCode: 'fr',
      vssId: '.fr',
    }
    const { window, fetch } = createYoutubeWindow({
      tracks: [english, french],
      selectedTrack: { languageCode: 'fr', vssId: '.fr' },
      fetchResponse: {
        ok: true,
        text: JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: 'Bonjour' }] }] }),
      },
    })

    const captured = new Promise<Record<string, unknown>>((resolve) => {
      window.addEventListener('message', (event) => {
        const message = event as unknown as MessageEvent
        if (message.data?.type === 'subtitle-captured') resolve(message.data)
      })
    })
    dispatchMessage(window, { type: 'youtube-auto-fetch' })

    const message = await captured
    const requestedUrl = new URL(String(fetch.mock.calls[0][0]))
    expect(requestedUrl.searchParams.get('lang')).toBe('fr')
    expect(requestedUrl.searchParams.get('fmt')).toBe('json3')
    expect(requestedUrl.searchParams.get('cver')).toBe('1.2.3')
    expect(message.data).toContain('Bonjour')
  })

  it('enables native CC only after direct subtitle fetching fails', async () => {
    const subtitleText = JSON.stringify({
      events: [{ tStartMs: 0, segs: [{ utf8: 'Hello' }] }],
    })
    const { window, player } = createYoutubeWindow({
      tracks: [{
        baseUrl: 'https://www.youtube.com/api/timedtext?v=video&lang=en',
        languageCode: 'en',
        vssId: '.en',
      }],
      fetchResponse: [
        { ok: false, text: '' },
        { ok: true, text: subtitleText },
      ],
    })

    const statuses: string[] = []
    const captured = new Promise<void>((resolve) => {
      window.addEventListener('message', (event) => {
        const message = event as unknown as MessageEvent
        if (message.data?.type === 'youtube-subtitle-status') statuses.push(message.data.status)
        if (message.data?.type === 'subtitle-captured') resolve()
      })
    })
    player.toggleSubtitles.mockImplementation(() => {
      void window.fetch('https://www.youtube.com/api/timedtext?v=video&lang=en&pot=generated')
    })
    dispatchMessage(window, { type: 'youtube-auto-fetch' })
    await captured

    expect(player.toggleSubtitles).toHaveBeenCalledTimes(1)
    expect(statuses).toContain('waiting-cc')
  })

  it('retries the selected track with a cached POT before enabling CC', async () => {
    const subtitleText = JSON.stringify({
      events: [{ tStartMs: 0, segs: [{ utf8: 'Hello' }] }],
    })
    const { window, player, fetch } = createYoutubeWindow({
      tracks: [{
        baseUrl: 'https://www.youtube.com/api/timedtext?v=video&lang=en',
        languageCode: 'en',
        vssId: '.en',
      }],
      audioCaptionTracks: [{
        url: 'https://www.youtube.com/api/timedtext?v=video&lang=en&pot=token&potc=context',
        languageCode: 'en',
        vssId: '.en',
      }],
      fetchResponse: [
        { ok: false, text: '' },
        { ok: true, text: subtitleText },
      ],
    })

    const captured = new Promise<void>((resolve) => {
      window.addEventListener('message', (event) => {
        const message = event as unknown as MessageEvent
        if (message.data?.type === 'subtitle-captured') resolve()
      })
    })
    dispatchMessage(window, { type: 'youtube-auto-fetch' })
    await captured

    expect(fetch).toHaveBeenCalledTimes(2)
    const retryUrl = new URL(String(fetch.mock.calls[1][0]))
    expect(retryUrl.searchParams.get('pot')).toBe('token')
    expect(retryUrl.searchParams.get('potc')).toBe('context')
    expect(player.toggleSubtitles).not.toHaveBeenCalled()
  })

  it('reports when the current video has no caption tracks', async () => {
    const { window, fetch } = createYoutubeWindow({
      tracks: [],
      fetchResponse: { ok: false, text: '' },
    })

    const status = new Promise<string>((resolve) => {
      window.addEventListener('message', (event) => {
        const message = event as unknown as MessageEvent
        if (message.data?.type === 'youtube-subtitle-status' && message.data.status === 'no-track') {
          resolve(message.data.status)
        }
      })
    })
    dispatchMessage(window, { type: 'youtube-auto-fetch' })

    await expect(status).resolves.toBe('no-track')
    expect(fetch).not.toHaveBeenCalled()
  })
})
