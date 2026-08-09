import { createHmac } from 'node:crypto'
import {
  inferOpenAICompatibleProvider,
  normalizeTranslationModelId,
  resolveAnthropicTranslationPolicy,
  resolveGeminiTranslationPolicy,
  resolveOpenAICompatibleTranslationPolicy,
} from '../entrypoints/utils/modelCapabilities.ts'

export const BENCHMARK_SCHEMA_VERSION = 1
export const BENCHMARK_PROFILES = ['v1.3.0', 'v1.5.0', 'current']

const CUSTOM_MODEL = '自定义模型'
const DEFAULT_SYSTEM_ROLE = 'You are a professional, authentic machine translation engine.'
const DEFAULT_USER_ROLE = `Translate the following text into {{to}}, If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes:

{{origin}}`

const OPENAI_COMPATIBLE_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  jieyue: 'https://api.stepfun.com/v1/chat/completions',
  siliconCloud: 'https://api.siliconflow.cn/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  grok: 'https://api.x.ai/v1/chat/completions',
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value
}

function asPositiveInteger(value, name, { allowZero = false } = {}) {
  const parsed = Number(value)
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`)
  }
  return parsed
}

function takeValue(argv, index, name) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

export function parseBenchmarkArgs(argv) {
  const options = {
    profiles: ['current'],
    services: [],
    runs: 5,
    warmup: 1,
    timeoutMs: 60_000,
    fastMode: false,
    dryRun: false,
  }
  let explicitProfiles = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--config') options.configPath = takeValue(argv, index++, arg)
    else if (arg === '--service') options.services.push(takeValue(argv, index++, arg))
    else if (arg === '--profiles') {
      options.profiles = takeValue(argv, index++, arg).split(',').map(value => value.trim()).filter(Boolean)
      explicitProfiles = true
    }
    else if (arg === '--profile') {
      if (!explicitProfiles) options.profiles = []
      options.profiles.push(takeValue(argv, index++, arg))
      explicitProfiles = true
    }
    else if (arg === '--runs') options.runs = asPositiveInteger(takeValue(argv, index++, arg), arg)
    else if (arg === '--warmup') options.warmup = asPositiveInteger(takeValue(argv, index++, arg), arg, { allowZero: true })
    else if (arg === '--timeout-ms') options.timeoutMs = asPositiveInteger(takeValue(argv, index++, arg), arg)
    else if (arg === '--text') options.text = takeValue(argv, index++, arg)
    else if (arg === '--text-file') options.textFile = takeValue(argv, index++, arg)
    else if (arg === '--target') options.target = takeValue(argv, index++, arg)
    else if (arg === '--label') options.label = takeValue(argv, index++, arg)
    else if (arg === '--output') options.output = takeValue(argv, index++, arg)
    else if (arg === '--fast-mode') options.fastMode = true
    else if (arg === '--dry-run') options.dryRun = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  options.profiles = [...new Set(options.profiles)]
  options.services = [...new Set(options.services)]
  if (!options.profiles.length) throw new Error('At least one benchmark profile is required')
  for (const profile of options.profiles) {
    if (!BENCHMARK_PROFILES.includes(profile)) {
      throw new Error(`Unsupported profile "${profile}". Use ${BENCHMARK_PROFILES.join(', ')}`)
    }
  }
  if (options.text && options.textFile) throw new Error('Use either --text or --text-file, not both')
  if (!options.help && !options.configPath) throw new Error('--config is required')
  return options
}

function completeEndpoint(endpoint, protocol) {
  const trimmed = String(endpoint || '').trim()
  if (!trimmed) return ''
  const suffix = protocol === 'anthropic' ? '/messages' : '/chat/completions'
  try {
    const parsed = new URL(trimmed)
    const path = parsed.pathname.replace(/\/+$/, '')
    if (!path.endsWith(suffix)) {
      parsed.pathname = path.endsWith('/v1') ? `${path}${suffix}` : `${path}/v1${suffix}`
    }
    parsed.hash = ''
    return parsed.toString()
  }
  catch {
    throw new Error(`Invalid endpoint for configured service: ${trimmed}`)
  }
}

function resolveModel(config, service, customProvider) {
  let model = customProvider?.model ?? config.model?.[service]
  const customModel = customProvider?.customModel ?? config.customModel?.[service]
  if (model === CUSTOM_MODEL) model = customModel
  model = String(model || '').replace(/（.*）/g, '').trim()
  if (!model) throw new Error(`No model configured for service "${service}"`)
  return model
}

function resolvePrompt(config, service, text, target) {
  const system = config.system_role?.[service] || DEFAULT_SYSTEM_ROLE
  const userTemplate = config.user_role?.[service] || DEFAULT_USER_ROLE
  return {
    system,
    user: userTemplate.replace('{{to}}', target).replace('{{origin}}', text),
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function createZhipuToken(apiKey, now = Date.now()) {
  if (!apiKey || !apiKey.includes('.')) throw new Error('Zhipu API key must contain a dot')
  const [key, secret] = apiKey.split('.', 2)
  const header = base64Url(JSON.stringify({ alg: 'HS256', sign_type: 'SIGN', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({
    api_key: key,
    exp: Math.floor(now / 1000) + 86_400,
    timestamp: Math.floor(now / 1000),
  }))
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

function resolveService(config, service) {
  const customProvider = service.startsWith('custom_')
    ? config.customProviders?.find(provider => provider.id === service)
    : undefined
  if (service.startsWith('custom_') && !customProvider) {
    throw new Error(`Custom service "${service}" was not found in the exported config`)
  }

  const protocol = customProvider?.protocol === 'anthropic'
    ? 'anthropic'
    : service === 'claude' ? 'anthropic' : service === 'gemini' ? 'gemini' : 'openai'
  const model = resolveModel(config, service, customProvider)
  let endpoint = ''
  let token = customProvider?.token || config.token?.[service] || ''

  if (customProvider) endpoint = completeEndpoint(customProvider.url, protocol)
  else if (service === 'newapi') endpoint = completeEndpoint(config.newApiUrl, 'openai')
  else if (service === 'gemini') {
    endpoint = config.proxy?.[service]
      || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(token)}`
  }
  else if (service === 'claude') endpoint = config.proxy?.[service] || 'https://api.anthropic.com/v1/messages'
  else if (service === 'minimax') endpoint = `https://api.minimax.chat/v1/text/${encodeURIComponent(config.model?.[service] || 'chatcompletion_v2')}`
  else endpoint = config.proxy?.[service] || OPENAI_COMPATIBLE_ENDPOINTS[service]

  if (!endpoint) throw new Error(`Service "${service}" is not supported by the benchmark`)
  if (!token) throw new Error(`No API token configured for service "${service}"`)
  if (service === 'zhipu') token = createZhipuToken(token)
  return { service, customProvider, protocol, model, endpoint, token }
}

function resolveHistoricalOpenAIPolicy(model, thinkingWanted) {
  const normalized = normalizeTranslationModelId(model)
  if (/^gpt-5(?:-(?:mini|nano))?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)) {
    return { reasoningEffort: thinkingWanted ? 'medium' : 'minimal', removeTemperature: true }
  }
  if (/^gpt-5\.1(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)) {
    return { reasoningEffort: thinkingWanted ? 'medium' : 'none', removeTemperature: true }
  }
  if (/^o3(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized)) {
    return { reasoningEffort: thinkingWanted ? 'medium' : 'low', removeTemperature: true }
  }
  return { removeTemperature: false }
}

function applyPolicy(payload, policy) {
  delete payload.enable_thinking
  delete payload.reasoning_effort
  delete payload.reasoning
  delete payload.thinking
  if (policy.removeTemperature) delete payload.temperature
  if (policy.temperature !== undefined) payload.temperature = policy.temperature
  if (policy.reasoningEffort) payload.reasoning_effort = policy.reasoningEffort
  if (policy.reasoning) payload.reasoning = policy.reasoning
  if (policy.thinking) payload.thinking = policy.thinking
  if (policy.enableThinking !== undefined) payload.enable_thinking = policy.enableThinking
}

function applyOpenAIProfile(payload, resolved, config, profile, fastMode) {
  const thinkingConfigured = config.thinking?.[resolved.service] === true
  const thinkingWanted = !fastMode && thinkingConfigured

  if (profile === 'v1.3.0') {
    if (resolved.service === 'deepseek') {
      if (fastMode && payload.model === 'deepseek-reasoner') payload.model = 'deepseek-chat'
      delete payload.reasoning_effort
      payload.thinking = { type: thinkingWanted ? 'enabled' : 'disabled' }
      if (payload.model === 'deepseek-reasoner') delete payload.temperature
      if (thinkingWanted && !fastMode) payload.reasoning_effort = 'high'
      return
    }
    payload.reasoning_effort = thinkingConfigured ? 'medium' : 'none'
    if (fastMode && /^(?:gpt-5|o\d(?:-|$))/i.test(resolved.model)) {
      delete payload.temperature
      payload.reasoning_effort = 'low'
    }
    return
  }

  if (profile === 'v1.5.0') {
    if (resolved.service === 'deepseek') {
      payload.thinking = { type: thinkingWanted ? 'enabled' : 'disabled' }
      if (thinkingWanted) {
        delete payload.temperature
        payload.reasoning_effort = 'high'
      }
      return
    }
    applyPolicy(payload, resolveHistoricalOpenAIPolicy(resolved.model, thinkingWanted))
    return
  }

  const provider = inferOpenAICompatibleProvider(resolved.service, resolved.model, resolved.endpoint)
  applyPolicy(payload, resolveOpenAICompatibleTranslationPolicy(provider, resolved.model, thinkingWanted))
}

function buildOpenAIRequest(resolved, config, profile, text, target, fastMode) {
  const prompt = resolvePrompt(config, resolved.service, text, target)
  const payload = {
    model: resolved.model,
    temperature: resolved.service === 'deepseek' ? 0.7 : 1,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
  }
  applyOpenAIProfile(payload, resolved, config, profile, fastMode)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${resolved.token}` }
  if (resolved.service === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/airhunter/OnlyTranslate'
    headers['X-Title'] = 'OnlyTranslate'
  }
  return { headers, payload }
}

function buildGeminiRequest(resolved, config, profile, text, target, fastMode) {
  const prompt = resolvePrompt(config, resolved.service, text, target)
  const thinkingConfigured = config.thinking?.[resolved.service] === true
  let thinkingConfig
  if (profile === 'v1.3.0') {
    thinkingConfig = { thinkingBudget: thinkingConfigured ? 1024 : 0 }
    if (fastMode && /^gemini-2\.5-/i.test(resolved.model)) {
      thinkingConfig = { thinkingBudget: /pro/i.test(resolved.model) ? 128 : 0 }
    }
    else if (fastMode && /^gemini-3/i.test(resolved.model)) thinkingConfig = { thinkingLevel: 'minimal' }
  }
  else {
    thinkingConfig = resolveGeminiTranslationPolicy(
      resolved.model,
      !fastMode && thinkingConfigured,
    ).thinkingConfig
  }
  return {
    headers: { 'Content-Type': 'application/json' },
    payload: {
      generationConfig: thinkingConfig ? { thinkingConfig } : {},
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    },
  }
}

function applyAnthropicPolicy(payload, policy) {
  delete payload.thinking
  delete payload.output_config
  if (policy.removeTemperature) delete payload.temperature
  if (policy.thinking) payload.thinking = policy.thinking
  if (policy.outputConfig) payload.output_config = policy.outputConfig
}

function buildAnthropicRequest(resolved, config, profile, text, target, fastMode) {
  const prompt = resolvePrompt(config, resolved.service, text, target)
  const payload = {
    model: resolved.model,
    max_tokens: 4096,
    stream: false,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  }
  const thinkingConfigured = config.thinking?.[resolved.service] === true
  if (profile === 'v1.3.0') {
    payload.thinking = thinkingConfigured
      ? { type: 'enabled', budget_tokens: 1024 }
      : { type: 'disabled' }
  }
  else {
    applyAnthropicPolicy(
      payload,
      resolveAnthropicTranslationPolicy(resolved.model, !fastMode && thinkingConfigured),
    )
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': resolved.token,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    payload,
  }
}

function buildMinimaxRequest(resolved, config, text, target) {
  const prompt = resolvePrompt(config, resolved.service, text, target)
  return {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolved.token}` },
    payload: {
      model: 'MiniMax-Text-01',
      stream: false,
      temperature: 0.7,
      thinking: { type: config.thinking?.[resolved.service] ? 'adaptive' : 'disabled' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    },
  }
}

function publicEndpointHost(endpoint) {
  try {
    return new URL(endpoint).host
  }
  catch {
    return 'invalid'
  }
}

export function buildBenchmarkRequest(configInput, options) {
  const config = assertObject(configInput, 'Exported config must be a JSON object')
  const service = options.service || config.service
  if (!service) throw new Error('No service selected')
  const profile = options.profile || 'current'
  if (!BENCHMARK_PROFILES.includes(profile)) throw new Error(`Unsupported profile: ${profile}`)
  const text = String(options.text || '')
  if (!text.trim()) throw new Error('Benchmark text must not be empty')
  const target = options.target || config.to || 'zh-Hans'
  const resolved = resolveService(config, service)
  const request = resolved.protocol === 'gemini'
    ? buildGeminiRequest(resolved, config, profile, text, target, options.fastMode === true)
    : resolved.protocol === 'anthropic'
      ? buildAnthropicRequest(resolved, config, profile, text, target, options.fastMode === true)
      : resolved.service === 'minimax'
        ? buildMinimaxRequest(resolved, config, text, target)
        : buildOpenAIRequest(resolved, config, profile, text, target, options.fastMode === true)

  return {
    endpoint: resolved.endpoint,
    headers: request.headers,
    body: JSON.stringify(request.payload),
    public: {
      service,
      model: resolved.model,
      protocol: resolved.protocol,
      profile,
      endpointHost: publicEndpointHost(resolved.endpoint),
      fastMode: options.fastMode === true,
      requestPolicy: extractRequestPolicy(request.payload),
    },
  }
}

export function extractRequestPolicy(payload) {
  const policy = {}
  for (const key of [
    'model', 'temperature', 'reasoning_effort', 'reasoning', 'thinking',
    'enable_thinking', 'output_config', 'generationConfig', 'stream', 'max_tokens',
  ]) {
    if (payload[key] !== undefined) policy[key] = payload[key]
  }
  return policy
}

function classifyBenchmarkError(error, status) {
  if (status === 401 || status === 403) return 'authentication'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'provider_5xx'
  if (status >= 400) return `http_${status}`
  const message = `${error?.name || ''} ${error?.message || error || ''}`.toLowerCase()
  if (message.includes('abort') || message.includes('timeout')) return 'timeout'
  if (message.includes('json') || message.includes('response')) return 'response_parse'
  return 'network'
}

function validateResponse(protocol, bodyText) {
  const parsed = JSON.parse(bodyText)
  if (protocol === 'gemini') {
    const parts = parsed?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts) || !parts.some(part => part?.thought !== true && typeof part?.text === 'string')) {
      throw new Error('Invalid Gemini response')
    }
  }
  else if (protocol === 'anthropic') {
    if (!Array.isArray(parsed?.content) || !parsed.content.some(block => typeof block?.text === 'string')) {
      throw new Error('Invalid Anthropic response')
    }
  }
  else if (typeof parsed?.choices?.[0]?.message?.content !== 'string') {
    throw new Error('Invalid OpenAI-compatible response')
  }
}

export async function executeBenchmarkRequest(request, options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  const timeoutMs = options.timeoutMs || 60_000
  const now = options.now || (() => performance.now())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Benchmark request timed out')), timeoutMs)
  const startedAt = now()
  let status = 0

  try {
    const response = await fetchImpl(request.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    })
    status = response.status
    const headersMs = now() - startedAt
    let firstByteMs
    let responseBytes = 0
    const chunks = []

    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (firstByteMs === undefined) firstByteMs = now() - startedAt
        responseBytes += value.byteLength
        chunks.push(value)
      }
    }
    const totalMs = now() - startedAt
    const bodyText = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')

    if (!response.ok) {
      return {
        success: false, httpStatus: status, headersMs, firstByteMs, totalMs, responseBytes,
        errorType: classifyBenchmarkError(undefined, status),
      }
    }
    try {
      validateResponse(request.public.protocol, bodyText)
    }
    catch (error) {
      return {
        success: false, httpStatus: status, headersMs, firstByteMs, totalMs, responseBytes,
        errorType: classifyBenchmarkError(error, status),
      }
    }
    return { success: true, httpStatus: status, headersMs, firstByteMs, totalMs, responseBytes }
  }
  catch (error) {
    return {
      success: false,
      httpStatus: status || undefined,
      totalMs: now() - startedAt,
      responseBytes: 0,
      errorType: classifyBenchmarkError(error, status),
    }
  }
  finally {
    clearTimeout(timer)
  }
}

function round(value) {
  return typeof value === 'number' ? Math.round(value * 10) / 10 : undefined
}

function percentile(sorted, quantile) {
  if (!sorted.length) return undefined
  const index = (sorted.length - 1) * quantile
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function metricSummary(runs, field) {
  const values = runs.map(run => run[field]).filter(value => typeof value === 'number').sort((a, b) => a - b)
  if (!values.length) return undefined
  return {
    min: round(values[0]),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    max: round(values.at(-1)),
  }
}

export function summarizeBenchmarkRuns(runs) {
  const measured = runs.filter(run => !run.warmup)
  const successful = measured.filter(run => run.success)
  const errorTypes = {}
  for (const run of measured.filter(run => !run.success)) {
    errorTypes[run.errorType || 'unknown'] = (errorTypes[run.errorType || 'unknown'] || 0) + 1
  }
  return {
    measuredRuns: measured.length,
    successCount: successful.length,
    failureCount: measured.length - successful.length,
    errorTypes,
    headersMs: metricSummary(successful, 'headersMs'),
    firstByteMs: metricSummary(successful, 'firstByteMs'),
    totalMs: metricSummary(successful, 'totalMs'),
  }
}

function csvValue(value) {
  if (value === undefined || value === null) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function benchmarkReportToCsv(report) {
  const columns = [
    'label', 'service', 'model', 'protocol', 'profile', 'fastMode', 'run', 'warmup',
    'success', 'httpStatus', 'headersMs', 'firstByteMs', 'totalMs', 'responseBytes', 'errorType',
  ]
  const rows = [columns.join(',')]
  for (const result of report.results) {
    for (const run of result.runs) {
      const row = {
        label: report.label,
        service: result.service,
        model: result.model,
        protocol: result.protocol,
        profile: result.profile,
        fastMode: result.fastMode,
        ...run,
      }
      rows.push(columns.map(column => csvValue(row[column])).join(','))
    }
  }
  return `${rows.join('\n')}\n`
}

export function sanitizeLabel(label) {
  const sanitized = String(label || 'benchmark').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return sanitized || 'benchmark'
}
