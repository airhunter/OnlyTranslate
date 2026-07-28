import CryptoJS from 'crypto-js'
import { urls } from './constant'
import { customModelString, models, services } from './option'
import { t } from './i18n'
import type { CustomProviderProtocol } from './model'
import { resolveProviderEndpoint } from './providerEndpoint'

interface FetchModelOptions {
  token?: string
  url?: string
  protocol?: CustomProviderProtocol
  signal?: AbortSignal
}

interface ModelListRequest {
  url: string
  headers: Record<string, string>
}

const openAICompatibleModelProviders = new Set<string>([
  services.openai,
  services.deepseek,
  services.moonshot,
  services.zhipu,
  services.jieyue,
  services.siliconCloud,
  services.openrouter,
  services.grok,
  services.newapi
])

const providerModelFetchers = new Set<string>([
  ...openAICompatibleModelProviders,
  services.gemini,
  services.claude
])

export const canFetchProviderModels = (service: string) => service.startsWith('custom_')
  || providerModelFetchers.has(service)

export const getStaticModelOptions = (service: string) => appendCustomModelOption(models.get(service) || [])

export const appendCustomModelOption = (items: string[]) => {
  const normalized = normalizeModelNames(items)
  return normalized.includes(customModelString)
    ? normalized
    : [...normalized, customModelString]
}

export async function fetchProviderModels(service: string, options: FetchModelOptions = {}): Promise<string[]> {
  if (!canFetchProviderModels(service)) {
    throw new Error(t('runtime.modelFetchUnsupported'))
  }

  if (!options.token && !service.startsWith('custom_')) {
    throw new Error(t('runtime.apiKeyRequired'))
  }

  const request = buildModelListRequest(service, options)
  const response = await fetch(request.url, {
    method: 'GET',
    headers: request.headers,
    signal: options.signal
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(t('runtime.modelFetchFailed', { status: response.status, statusText: response.statusText, detail: errorBody ? ` ${errorBody}` : '' }))
  }

  const payload = await response.json()
  return appendCustomModelOption(parseModelNames(service, payload))
}

function buildModelListRequest(service: string, options: FetchModelOptions): ModelListRequest {
  if (service.startsWith('custom_')) {
    if (!options.url?.trim()) {
      throw new Error(t('runtime.providerUrlRequired'))
    }
    const protocol: CustomProviderProtocol = options.protocol === 'anthropic'
      ? 'anthropic'
      : 'openai'
    const headers: Record<string, string> = {}
    if (protocol === 'anthropic') {
      if (options.token) headers['x-api-key'] = options.token
      headers['anthropic-version'] = '2023-06-01'
      headers['anthropic-dangerous-direct-browser-access'] = 'true'
    } else if (options.token) {
      headers.Authorization = `Bearer ${options.token}`
    }
    return {
      url: buildModelsEndpoint(resolveProviderEndpoint(options.url, protocol)),
      headers
    }
  }

  if (service === services.gemini) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(options.token || '')}`,
      headers: {}
    }
  }

  if (service === services.claude) {
    return {
      url: buildModelsEndpoint(options.url || urls[service]),
      headers: {
        'x-api-key': options.token || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getBearerToken(service, options.token || '')}`
  }

  if (service === services.openrouter) {
    headers['HTTP-Referer'] = 'https://github.com/airhunter/OnlyTranslate'
    headers['X-Title'] = 'OnlyTranslate'
  }

  return {
    url: buildModelsEndpoint(options.url || urls[service]),
    headers
  }
}

export function buildModelsEndpoint(value: string) {
  const url = new URL(value || 'https://api.openai.com/v1/chat/completions')

  const normalizedPath = url.pathname.replace(/\/+$/, '')
  if (normalizedPath.endsWith('/api/generate')) {
    url.pathname = normalizedPath.replace(/\/api\/generate$/, '/api/tags')
    return url.toString()
  }

  if (normalizedPath.endsWith('/chat/completions')) {
    url.pathname = normalizedPath.replace(/\/chat\/completions$/, '/models')
    return url.toString()
  }

  if (normalizedPath.endsWith('/messages')) {
    url.pathname = normalizedPath.replace(/\/messages$/, '/models')
    return url.toString()
  }

  if (normalizedPath.endsWith('/v1') || normalizedPath.endsWith('/api/v1')) {
    url.pathname = `${normalizedPath}/models`
    return url.toString()
  }

  if (!normalizedPath.endsWith('/models')) {
    url.pathname = `${normalizedPath}/models`
  }

  return url.toString()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function parseModelNames(service: string, payload: unknown) {
  const payloadRecord = asRecord(payload)

  if (service === services.gemini) {
    const models = Array.isArray(payloadRecord?.models) ? payloadRecord.models : []
    return normalizeModelNames(models
      .filter((item) => {
        const model = asRecord(item)
        const supportedMethods = model?.supportedGenerationMethods
        return !Array.isArray(supportedMethods) || supportedMethods.includes('generateContent')
      })
      .map((item) => {
        const model = asRecord(item)
        return typeof model?.name === 'string' ? model.name : ''
      }))
      .map((name) => name.replace(/^models\//, ''))
  }

  const list = Array.isArray(payloadRecord?.data)
    ? payloadRecord.data
    : Array.isArray(payloadRecord?.models)
      ? payloadRecord.models
      : Array.isArray(payload)
        ? payload
        : []

  return normalizeModelNames(list.map((item) => {
    if (typeof item === 'string') return item
    const model = asRecord(item)
    const name = model?.id || model?.name
    return typeof name === 'string' ? name : ''
  }))
}

function normalizeModelNames(items: string[]) {
  return Array.from(new Set(items
    .map((item) => `${item || ''}`.trim())
    .filter(Boolean)))
}

function getBearerToken(service: string, token: string) {
  if (service === services.zhipu && token.includes('.')) {
    return generateZhipuToken(token)
  }

  return token
}

function generateZhipuToken(apiKey: string) {
  const [key, secret] = apiKey.split('.')
  const header = { alg: 'HS256', sign_type: 'SIGN', typ: 'JWT' }
  const payload = {
    api_key: key,
    exp: Math.floor(Date.now() / 1000) + 3600,
    timestamp: Math.floor(Date.now() / 1000)
  }

  const encodedHeader = base64UrlSafe(btoa(JSON.stringify(header)))
  const encodedPayload = base64UrlSafe(btoa(JSON.stringify(payload)))
  const signature = base64UrlSafe(CryptoJS.HmacSHA256(`${encodedHeader}.${encodedPayload}`, secret).toString(CryptoJS.enc.Base64))
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function base64UrlSafe(value: string) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
