import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleTtsBackgroundMessage } from '@/entrypoints/utils/ttsBackground'

describe('ttsBackground', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes installed Chrome voices for the settings page', async () => {
    vi.stubGlobal('chrome', {
      runtime: {},
      tts: {
        getVoices: (callback: (voices: unknown[]) => void) => callback([
          { voiceName: 'System Voice', lang: 'en-US' },
        ]),
        speak: vi.fn(),
        stop: vi.fn(),
      },
    })

    await expect(handleTtsBackgroundMessage({
      type: 'TTS_GET_VOICES',
      engine: 'system',
    })).resolves.toEqual({
      success: true,
      voices: [{ id: 'System Voice', name: 'System Voice', lang: 'en-US' }],
    })
  })

  it('resolves system playback after the TTS end event', async () => {
    const speak = vi.fn((_: string, options: { onEvent?: (event: { type: string }) => void }, callback?: () => void) => {
      callback?.()
      options.onEvent?.({ type: 'end' })
    })
    vi.stubGlobal('chrome', {
      runtime: {},
      tts: { speak, stop: vi.fn(), getVoices: vi.fn() },
    })

    await expect(handleTtsBackgroundMessage({
      type: 'TTS_SPEAK_SYSTEM',
      text: 'Hello',
      language: 'en-US',
      voice: '',
    })).resolves.toEqual({ success: true })
    expect(speak).toHaveBeenCalledWith('Hello', expect.objectContaining({ lang: 'en-US' }), expect.any(Function))
  })

  it('reports system TTS as unavailable without failing unrelated messages', async () => {
    vi.stubGlobal('chrome', { runtime: {} })

    await expect(handleTtsBackgroundMessage({
      type: 'TTS_SPEAK_SYSTEM',
      text: 'Hello',
    })).resolves.toEqual({ success: false, error: 'System TTS is unavailable' })
    expect(handleTtsBackgroundMessage({ type: 'UNRELATED' })).toBeUndefined()
  })
})
