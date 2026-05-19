import CryptoJS from 'crypto-js'
import { urls } from './constant'
import { customModelString, models, services } from './option'
import { t } from './i18n'

interface FetchModelOptions {
  token?: string
  url?: string
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

export const canFetchProviderModels = (service: string) => providerModelFetchers.has(service)

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

  if (!options.token) {
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
  url.search = ''

  const normalizedPath = url.pathname.replace(/\/+$/, '')
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

function parseModelNames(service: string, payload: any) {
  if (service === services.gemini) {
    return normalizeModelNames((payload.models || [])
      .filter((item: any) => !item.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent'))
      .map((item: any) => item.name))
      .map((name) => name.replace(/^models\//, ''))
  }

  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : []

  return normalizeModelNames(list.map((item: any) => typeof item === 'string' ? item : item?.id || item?.name))
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
