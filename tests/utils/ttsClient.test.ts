import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectSpeechLanguage, getTtsVoices, speakText, stopTts } from '@/entrypoints/utils/ttsClient'

describe('ttsClient', () => {
  const sendMessage = vi.fn()

  beforeEach(() => {
    sendMessage.mockReset()
    vi.stubGlobal('browser', {
      runtime: { sendMessage },
    })
  })

  afterEach(() => {
    stopTts()
    vi.unstubAllGlobals()
  })

  it('detects common writing systems for automatic voice matching', () => {
    expect(detectSpeechLanguage('Hello world')).toBe('en-US')
    expect(detectSpeechLanguage('你好，世界')).toBe('zh-CN')
    expect(detectSpeechLanguage('日本語を読みます')).toBe('ja-JP')
    expect(detectSpeechLanguage('안녕하세요')).toBe('ko-KR')
  })

  it('uses the browser system voice by default', async () => {
    sendMessage.mockImplementation(async (message: { type: string }) => (
      message.type === 'TTS_SPEAK_SYSTEM' ? { success: true } : { success: true }
    ))

    await expect(speakText('Hello', { engine: 'system' })).resolves.toEqual({
      engine: 'system',
      fallback: false,
    })
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TTS_SPEAK_SYSTEM',
      language: 'en-US',
    }))
  })

  it('falls back to the system voice when Edge online synthesis fails', async () => {
    sendMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'TTS_SYNTHESIZE_EDGE') return { success: false, error: 'offline' }
      return { success: true }
    })

    await expect(speakText('Hello', { engine: 'edge' })).resolves.toEqual({
      engine: 'system',
      fallback: true,
    })
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TTS_SYNTHESIZE_EDGE' }))
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TTS_SPEAK_SYSTEM' }))
  })

  it('returns voices supplied by the selected engine', async () => {
    sendMessage.mockResolvedValue({
      success: true,
      voices: [{ id: 'voice-1', name: 'Voice One', lang: 'en-US' }],
    })

    await expect(getTtsVoices('system')).resolves.toEqual([
      { id: 'voice-1', name: 'Voice One', lang: 'en-US' },
    ])
  })
})
