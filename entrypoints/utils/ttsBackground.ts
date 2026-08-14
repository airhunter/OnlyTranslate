import { listEdgeTtsVoices, synthesizeEdgeTts, type TtsVoiceOption } from './edgeTts'

interface ChromeTtsEvent {
  type: string
  errorMessage?: string
}

interface ChromeTtsVoice {
  voiceName?: string
  lang?: string
  remote?: boolean
}

interface ChromeTtsApi {
  speak: (
    text: string,
    options: {
      lang?: string
      voiceName?: string
      enqueue?: boolean
      onEvent?: (event: ChromeTtsEvent) => void
    },
    callback?: () => void,
  ) => void
  stop: () => void
  getVoices: (callback: (voices: ChromeTtsVoice[]) => void) => void
}

interface ChromeRuntimeApi {
  lastError?: { message?: string }
}

function getChromeTts(): ChromeTtsApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: { tts?: ChromeTtsApi } }).chrome?.tts
}

function getChromeRuntime(): ChromeRuntimeApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: { runtime?: ChromeRuntimeApi } }).chrome?.runtime
}

function normalizeText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error('Text to speech input is empty')
  if (text.length > 12000) throw new Error('Text to speech input is too long')
  return text
}

function normalizeVoice(value: unknown): string {
  const voice = typeof value === 'string' ? value.trim() : ''
  if (voice.length > 180 || !/^[\w .:()\-]*$/u.test(voice)) return ''
  return voice
}

async function listSystemVoices(): Promise<TtsVoiceOption[]> {
  const api = getChromeTts()
  if (!api) return []

  return new Promise(resolve => {
    api.getVoices(voices => {
      resolve(voices.flatMap(voice => voice.voiceName
        ? [{
            id: voice.voiceName,
            name: voice.voiceName,
            lang: voice.lang || '',
          }]
        : []))
    })
  })
}

async function speakSystemText(text: string, language: string, voice: string): Promise<{ success: true }> {
  const api = getChromeTts()
  if (!api) throw new Error('System TTS is unavailable')

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve({ success: true })
    }
    const timeoutMs = Math.max(2 * 60 * 1000, Math.min(10 * 60 * 1000, text.length * 120))
    const timeout = setTimeout(() => {
      api.stop()
      finish(new Error('System TTS timed out'))
    }, timeoutMs)

    api.speak(text, {
      lang: language || undefined,
      voiceName: voice || undefined,
      enqueue: false,
      onEvent: event => {
        if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled') {
          finish()
        } else if (event.type === 'error') {
          finish(new Error(event.errorMessage || 'System TTS failed'))
        }
      },
    }, () => {
      const message = getChromeRuntime()?.lastError?.message
      if (message) finish(new Error(message))
    })
  })
}

export function handleTtsBackgroundMessage(message: unknown): Promise<unknown> | undefined {
  if (!message || typeof message !== 'object') return undefined
  const request = message as Record<string, unknown>

  if (request.type === 'TTS_GET_VOICES') {
    return (request.engine === 'edge' ? listEdgeTtsVoices() : listSystemVoices())
      .then(voices => ({ success: true, voices }))
      .catch(error => ({ success: false, error: error instanceof Error ? error.message : String(error) }))
  }

  if (request.type === 'TTS_STOP') {
    getChromeTts()?.stop()
    return Promise.resolve({ success: true })
  }

  if (request.type === 'TTS_SPEAK_SYSTEM') {
    try {
      const text = normalizeText(request.text)
      const language = typeof request.language === 'string' ? request.language : ''
      const voice = normalizeVoice(request.voice)
      return speakSystemText(text, language, voice)
        .catch(error => ({ success: false, error: error instanceof Error ? error.message : String(error) }))
    } catch (error) {
      return Promise.resolve({ success: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.type === 'TTS_SYNTHESIZE_EDGE') {
    try {
      const text = normalizeText(request.text)
      const language = typeof request.language === 'string' ? request.language : 'en-US'
      const voice = normalizeVoice(request.voice)
      return synthesizeEdgeTts(text, language, voice)
        .then(result => ({ success: true, ...result }))
        .catch(error => ({ success: false, error: error instanceof Error ? error.message : String(error) }))
    } catch (error) {
      return Promise.resolve({ success: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return undefined
}
