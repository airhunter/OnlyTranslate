import type { TtsEngine, TtsVoiceGender } from './model'
import type { TtsVoiceOption } from './edgeTts'

interface TtsResponse {
  success?: boolean
  error?: string
  audioBase64?: string
  contentType?: string
}

let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl = ''
let activeAudioFinish: (() => void) | null = null
let playbackGeneration = 0

export function detectSpeechLanguage(text: string): string {
  if (/[\u3040-\u30ff]/u.test(text)) return 'ja-JP'
  if (/[\uac00-\ud7af]/u.test(text)) return 'ko-KR'
  if (/[\u4e00-\u9fff]/u.test(text)) return 'zh-CN'
  if (/[\u0400-\u04ff]/u.test(text)) return 'ru-RU'
  if (/[äöüßÄÖÜ]/u.test(text)) return 'de-DE'
  if (/[àâçéèêëîïôùûüÿæœÀÂÇÉÈÊËÎÏÔÙÛÜŸÆŒ]/u.test(text)) return 'fr-FR'
  if (/[áéíóúüñÁÉÍÓÚÜÑ]/u.test(text)) return 'es-ES'
  return 'en-US'
}

function clearAudio(): void {
  const finish = activeAudioFinish
  activeAudioFinish = null
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl)
    activeAudioUrl = ''
  }
  finish?.()
}

export function stopTts(): void {
  playbackGeneration += 1
  clearAudio()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  void Promise.resolve(browser.runtime.sendMessage({ type: 'TTS_STOP' })).catch(() => undefined)
}

function decodeAudio(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function playAudioResponse(response: TtsResponse, generation: number): Promise<void> {
  if (!response.audioBase64) throw new Error('Edge TTS returned no audio')
  const bytes = decodeAudio(response.audioBase64)
  activeAudioUrl = URL.createObjectURL(new Blob([bytes], { type: response.contentType || 'audio/mpeg' }))
  activeAudio = new Audio(activeAudioUrl)

  return new Promise((resolve, reject) => {
    const audio = activeAudio
    if (!audio) return reject(new Error('Audio player is unavailable'))
    activeAudioFinish = resolve
    audio.onended = () => {
      if (activeAudio === audio) {
        activeAudioFinish = null
        if (generation === playbackGeneration) clearAudio()
      }
      resolve()
    }
    audio.onerror = () => {
      if (activeAudio === audio) {
        activeAudioFinish = null
        if (generation === playbackGeneration) clearAudio()
      }
      reject(new Error('Audio playback failed'))
    }
    audio.play().catch(error => {
      if (activeAudio === audio) {
        activeAudioFinish = null
        if (generation === playbackGeneration) clearAudio()
      }
      reject(error)
    })
  })
}

function speakWithWebSpeech(text: string, language: string, generation: number): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('System TTS is unavailable'))

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.onend = () => resolve()
    utterance.onerror = event => {
      if (generation !== playbackGeneration) resolve()
      else reject(new Error(event.error || 'System TTS failed'))
    }
    if (generation !== playbackGeneration) return resolve()
    window.speechSynthesis.speak(utterance)
  })
}

async function speakWithSystem(text: string, language: string, generation: number): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'TTS_SPEAK_SYSTEM',
      text,
      language,
    }) as TtsResponse
    if (response?.success === false) throw new Error(response.error || 'System TTS failed')
  } catch {
    if (generation !== playbackGeneration) return
    await speakWithWebSpeech(text, language, generation)
  }
}

export async function speakText(
  text: string,
  options: { engine: TtsEngine; gender?: TtsVoiceGender },
): Promise<{ engine: TtsEngine; fallback: boolean }> {
  const cleanText = text.trim()
  if (!cleanText) throw new Error('Text to speech input is empty')

  stopTts()
  const generation = ++playbackGeneration
  const language = detectSpeechLanguage(cleanText)

  if (options.engine === 'edge') {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TTS_SYNTHESIZE_EDGE',
        text: cleanText,
        language,
        gender: options.gender || 'auto',
      }) as TtsResponse
      if (response?.success === false) throw new Error(response.error || 'Edge TTS failed')
      if (generation !== playbackGeneration) return { engine: 'edge', fallback: false }
      await playAudioResponse(response, generation)
      return { engine: 'edge', fallback: false }
    } catch {
      if (generation !== playbackGeneration) return { engine: 'edge', fallback: false }
      await speakWithSystem(cleanText, language, generation)
      return { engine: 'system', fallback: true }
    }
  }

  await speakWithSystem(cleanText, language, generation)
  return { engine: 'system', fallback: false }
}

export async function getTtsVoices(engine: TtsEngine): Promise<TtsVoiceOption[]> {
  try {
    const response = await browser.runtime.sendMessage({ type: 'TTS_GET_VOICES', engine }) as {
      success?: boolean
      voices?: TtsVoiceOption[]
    }
    if (response?.success === false || !Array.isArray(response?.voices)) return []
    if (response.voices.length > 0 || engine !== 'system' || !('speechSynthesis' in window)) {
      return response.voices
    }
  } catch {
    if (engine !== 'system' || !('speechSynthesis' in window)) return []
  }

  return window.speechSynthesis.getVoices().map(voice => ({
    id: voice.name,
    name: voice.name,
    lang: voice.lang,
  }))
}
