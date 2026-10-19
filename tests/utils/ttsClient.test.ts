import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectSpeechLanguage, getTtsVoices, speakText, stopTts } from '@/entrypoints/utils/ttsClient'

describe('ttsClient', () => {
  const sendMessage = vi.fn()
  const play = vi.fn()

  beforeEach(() => {
    sendMessage.mockReset()
    play.mockReset()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-audio')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal('Audio', class {
      src = ''
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      pause() {}
      play() {
        return play().then(() => this.onended?.())
      }
    })
    play.mockResolvedValue(undefined)
    vi.stubGlobal('browser', {
      runtime: { sendMessage },
    })
  })

  afterEach(() => {
    stopTts()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('detects common writing systems for automatic voice matching', () => {
    expect(detectSpeechLanguage('Hello world')).toBe('en-US')
    expect(detectSpeechLanguage('你好，世界')).toBe('zh-CN')
    expect(detectSpeechLanguage('日本語を読みます')).toBe('ja-JP')
    expect(detectSpeechLanguage('안녕하세요')).toBe('ko-KR')
  })

  it('uses the browser system voice when explicitly selected', async () => {
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

  it.each(['response', 'network', 'audio', 'playback'])('rejects Edge %s failures without starting system speech', async failure => {
    sendMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'TTS_SYNTHESIZE_EDGE') {
        if (failure === 'response') return { success: false, error: 'offline' }
        if (failure === 'network') throw new Error('network unavailable')
        return { success: true, audioBase64: failure === 'audio' ? '%%%' : 'AQID' }
      }
      return { success: true }
    })
    if (failure === 'playback') play.mockRejectedValue(new Error('playback failed'))

    await expect(speakText('delocalise', { engine: 'edge' })).rejects.toThrow()
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TTS_SYNTHESIZE_EDGE' }))
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ gender: 'auto' }))
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'TTS_SPEAK_SYSTEM' }))
  })

  it('forwards an Edge voice gender preference without choosing a fixed language voice', async () => {
    sendMessage.mockImplementation(async (message: { type: string }) => (
      message.type === 'TTS_SYNTHESIZE_EDGE'
        ? { success: true, audioBase64: 'AQID' }
        : { success: true }
    ))

    await expect(speakText('你好', { engine: 'edge', gender: 'male' })).resolves.toEqual({ engine: 'edge', fallback: false })

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TTS_SYNTHESIZE_EDGE',
      language: 'zh-CN',
      gender: 'male',
    }))
  })

  it('silences an obsolete Edge failure after playback is stopped', async () => {
    let rejectSynthesis!: (error: Error) => void
    sendMessage.mockImplementation((message: { type: string }) => message.type === 'TTS_SYNTHESIZE_EDGE'
      ? new Promise((_resolve, reject) => { rejectSynthesis = reject })
      : Promise.resolve({ success: true }))

    const speech = speakText('delocalise', { engine: 'edge' })
    stopTts()
    rejectSynthesis(new Error('late network error'))

    await expect(speech).resolves.toEqual({ engine: 'edge', fallback: false })
    expect(sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'TTS_SPEAK_SYSTEM' }))
    expect(play).not.toHaveBeenCalled()
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
