const EDGE_TTS_ENDPOINT_URL = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'
const EDGE_TTS_VOICES_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'
// 微软消费级朗读客户端公开使用的签名材料，不是项目或用户密钥。
const EDGE_TTS_SIGNATURE_SECRET = 'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw=='
const EDGE_TTS_APP_ID = 'MSTranslatorAndroidApp'
const EDGE_TTS_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
const EDGE_TTS_MAX_CHUNK_BYTES = 1800
const TOKEN_REFRESH_MARGIN_MS = 3 * 60 * 1000
const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000
const VOICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface EdgeEndpointResponse {
  r: string
  t: string
}

interface EdgeTokenInfo {
  endpoint: EdgeEndpointResponse
  expiresAt: number
}

interface EdgeVoiceResponse {
  ShortName?: string
  Name?: string
  FriendlyName?: string
  Locale?: string
  Gender?: string
  Status?: string
}

export interface TtsVoiceOption {
  id: string
  name: string
  lang: string
  gender?: string
}

export interface EdgeTtsAudio {
  audioBase64: string
  contentType: string
  voice: string
}

let cachedToken: EdgeTokenInfo | null = null
let cachedVoices: { voices: TtsVoiceOption[]; cachedAt: number } | null = null

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(result)
}

function buildSignatureDate(date = new Date()): string {
  return `${date.toUTCString().replace('GMT', '').trim().toLowerCase()} GMT`
}

async function generateSignature(): Promise<string> {
  const requestId = crypto.randomUUID().replace(/-/g, '')
  const date = buildSignatureDate()
  const encodedUrl = encodeURIComponent(EDGE_TTS_ENDPOINT_URL.split('://')[1] ?? '')
  const payload = `${EDGE_TTS_APP_ID}${encodedUrl}${date}${requestId}`.toLowerCase()
  const keyBytes = base64ToBytes(EDGE_TTS_SIGNATURE_SECRET)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return `${EDGE_TTS_APP_ID}::${bytesToBase64(signature)}::${date}::${requestId}`
}

function readJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

async function getEndpointToken(): Promise<EdgeTokenInfo> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken
  }

  const staleToken = cachedToken
  try {
    const signature = await generateSignature()
    const response = await fetch(EDGE_TTS_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Accept-Language': 'zh-Hans',
        'X-ClientVersion': '4.0.530a 5fe1dc6c',
        'X-UserId': '0f04d16a175c411e',
        'X-HomeGeographicRegion': 'zh-Hans-CN',
        'X-ClientTraceId': crypto.randomUUID().replace(/-/g, ''),
        'X-MT-Signature': signature,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: '',
    })
    if (!response.ok) {
      throw new Error(`Edge TTS token request failed: ${response.status}`)
    }

    const endpoint = await response.json() as Partial<EdgeEndpointResponse>
    if (typeof endpoint.r !== 'string' || typeof endpoint.t !== 'string' || !endpoint.r || !endpoint.t) {
      throw new Error('Edge TTS token response is invalid')
    }

    cachedToken = {
      endpoint: endpoint as EdgeEndpointResponse,
      expiresAt: readJwtExpiry(endpoint.t) ?? Date.now() + DEFAULT_TOKEN_TTL_MS,
    }
    return cachedToken
  } catch (error) {
    if (staleToken && Date.now() < staleToken.expiresAt) return staleToken
    throw error
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeText(value: string): string {
  return Array.from(value).map(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return (codePoint <= 8 || (codePoint >= 11 && codePoint <= 12) || (codePoint >= 14 && codePoint <= 31))
      ? ' '
      : character
  }).join('').trim()
}

function buildSsml(text: string, voice: string): string {
  const cleanText = sanitizeText(text)
  if (!cleanText) throw new Error('Text to speech input is empty')
  const locale = voice.split('-').slice(0, 2).join('-') || 'en-US'
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${escapeXml(locale)}"><voice name="${escapeXml(voice)}"><prosody rate="+0%" pitch="+0Hz" volume="+0%">${escapeXml(cleanText)}</prosody></voice></speak>`
}

function splitText(text: string): string[] {
  const encoder = new TextEncoder()
  const chunks: string[] = []
  let current = ''

  for (const character of Array.from(text)) {
    const candidate = current + character
    if (encoder.encode(candidate).byteLength > EDGE_TTS_MAX_CHUNK_BYTES && current) {
      chunks.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current.trim()) chunks.push(current)
  return chunks
}

export async function listEdgeTtsVoices(): Promise<TtsVoiceOption[]> {
  if (cachedVoices && Date.now() - cachedVoices.cachedAt < VOICE_CACHE_TTL_MS) {
    return cachedVoices.voices
  }

  try {
    const response = await fetch(EDGE_TTS_VOICES_URL)
    if (!response.ok) throw new Error(`Edge TTS voice request failed: ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload)) throw new Error('Edge TTS voice response is invalid')

    const voices = payload.flatMap((item: EdgeVoiceResponse) => {
      const id = item.ShortName || item.Name
      if (!id || !item.Locale) return []
      return [{
        id,
        name: item.FriendlyName || id,
        lang: item.Locale,
        gender: item.Gender,
      }]
    })
    cachedVoices = { voices, cachedAt: Date.now() }
    return voices
  } catch (error) {
    if (cachedVoices) return cachedVoices.voices
    throw error
  }
}

function chooseVoice(voices: TtsVoiceOption[], language: string): TtsVoiceOption | undefined {
  const normalized = language.toLowerCase()
  const base = normalized.split('-')[0]
  const matches = voices.filter(voice => {
    const voiceLang = voice.lang.toLowerCase()
    return voiceLang === normalized || voiceLang.startsWith(`${base}-`)
  })
  return matches.find(voice => /multilingual/i.test(voice.id))
    ?? matches.find(voice => /xiaoxiao|andrew|ava/i.test(voice.id))
    ?? matches[0]
    ?? voices[0]
}

async function synthesizeChunk(text: string, voice: string): Promise<Uint8Array> {
  const token = await getEndpointToken()
  const response = await fetch(`https://${token.endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      Authorization: token.endpoint.t,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': EDGE_TTS_OUTPUT_FORMAT,
    },
    body: buildSsml(text, voice),
  })
  if (response.status === 401 || response.status === 403) cachedToken = null
  if (!response.ok) throw new Error(`Edge TTS synthesis failed: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function synthesizeEdgeTts(text: string, language: string, requestedVoice = ''): Promise<EdgeTtsAudio> {
  const voices = await listEdgeTtsVoices()
  const voice = voices.find(item => item.id === requestedVoice) ?? chooseVoice(voices, language)
  if (!voice) throw new Error('No Edge TTS voice is available')

  const audioChunks: Uint8Array[] = []
  for (const chunk of splitText(text)) {
    audioChunks.push(await synthesizeChunk(chunk, voice.id))
  }
  const totalBytes = audioChunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of audioChunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  return {
    audioBase64: bytesToBase64(combined),
    contentType: 'audio/mpeg',
    voice: voice.id,
  }
}

export const edgeTtsInternals = {
  buildSsml,
  splitText,
}
