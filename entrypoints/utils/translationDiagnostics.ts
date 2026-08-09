import { storage } from '@wxt-dev/storage'

export const TRANSLATION_DIAGNOSTICS_STORAGE_KEY = 'local:translationDiagnostics'
export const TRANSLATION_DIAGNOSTICS_MAX_SESSIONS = 5
export const TRANSLATION_DIAGNOSTICS_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type TranslationDiagnosticScene =
  | 'webpage'
  | 'selection'
  | 'hover'
  | 'input'
  | 'video'
  | 'ebook'
  | 'other'

export interface TranslationDiagnosticMetadata {
  sessionId: string
  requestId: string
  scene: TranslationDiagnosticScene
  startedAt: number
  queuedAt: number
  requestStartedAt: number
  attempt: number
  pageUrl?: string
}

export interface TranslationDiagnosticSession {
  id: string
  scene: TranslationDiagnosticScene
  startedAt: number
  updatedAt: number
  service: string
  model: string
  pageUrl?: string
  textCharacters: number
  requestCount: number
  cacheHits: number
  retryCount: number
  queueDurationMs: number
  apiDurationMs: number
  firstResultMs?: number
  firstVisibleMs?: number
  extensionProcessingMs?: number
  totalDurationMs: number
  errorTypes: string[]
}

export interface TranslationDiagnosticContext {
  sessionId?: string
  scene?: TranslationDiagnosticScene
  startedAt?: number
  pageUrl?: string
}

interface RecordRequestInput {
  metadata: TranslationDiagnosticMetadata
  service: string
  model: string
  characters: number
  durationMs: number
  success: boolean
  error?: unknown
}

let writeChain: Promise<void> = Promise.resolve()
let persistenceChain: Promise<void> = Promise.resolve()
let cachedSessions: TranslationDiagnosticSession[] | undefined
let persistTimer: ReturnType<typeof setTimeout> | undefined

export function createTranslationDiagnosticId(prefix = 'translation'): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomId}`
}

export function sanitizeDiagnosticPageUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return `${url.origin}${url.pathname}`.slice(0, 2048)
  }
  catch {
    return undefined
  }
}

export function classifyTranslationDiagnosticError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  const status = /\b([45]\d{2})\b/.exec(message)?.[1]
  const errorName = error instanceof Error ? error.name : ''
  if (status) {
    if (status === '404' && errorName === 'MicrosoftEndpointUnavailableError') {
      return 'microsoft_endpoint_unavailable'
    }
    if (status === '401' || status === '403') return 'authentication'
    if (status === '408') return 'timeout'
    if (status === '429') return 'rate_limit'
    if (status.startsWith('5')) return 'provider_5xx'
    return `http_${status}`
  }
  if (/(?:timeout|timed out|超时)/.test(message)) return 'timeout'
  if (/(?:network|failed to fetch|load failed|connection|econn|socket|网络|连接)/.test(message)) return 'network'
  if (/(?:parse|json|response.*invalid|unexpected.*response)/.test(message)) return 'response_parse'
  if (/(?:abort|cancel)/.test(message)) return 'cancelled'
  return 'unknown'
}

function pruneSessions(sessions: TranslationDiagnosticSession[], now = Date.now()): TranslationDiagnosticSession[] {
  const cutoff = now - TRANSLATION_DIAGNOSTICS_MAX_AGE_MS
  return sessions
    .filter(session => session.updatedAt >= cutoff)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, TRANSLATION_DIAGNOSTICS_MAX_SESSIONS)
}

async function readStoredSessions(): Promise<TranslationDiagnosticSession[]> {
  const stored = await storage.getItem(TRANSLATION_DIAGNOSTICS_STORAGE_KEY)
  if (typeof stored !== 'string' || !stored.trim()) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? pruneSessions(parsed as TranslationDiagnosticSession[]) : []
  }
  catch {
    return []
  }
}

function enqueueWrite(update: (sessions: TranslationDiagnosticSession[]) => TranslationDiagnosticSession[]): Promise<void> {
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      cachedSessions ??= await readStoredSessions()
      cachedSessions = pruneSessions(update(cachedSessions))
      schedulePersistence()
    })
  return writeChain
}

function schedulePersistence(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    void persistCachedSessions()
  }, 400)
}

async function persistCachedSessions(): Promise<void> {
  if (!cachedSessions) return
  const snapshot = JSON.stringify(pruneSessions(cachedSessions))
  persistenceChain = persistenceChain
    .catch(() => undefined)
    .then(() => storage.setItem(TRANSLATION_DIAGNOSTICS_STORAGE_KEY, snapshot))
  await persistenceChain
}

export async function recordTranslationDiagnosticRequest(input: RecordRequestInput): Promise<void> {
  const now = Date.now()
  await enqueueWrite((sessions) => {
    const existing = sessions.find(session => session.id === input.metadata.sessionId)
    const errorType = input.success ? undefined : classifyTranslationDiagnosticError(input.error)
    if (!existing) {
      return [{
        id: input.metadata.sessionId,
        scene: input.metadata.scene,
        startedAt: input.metadata.startedAt,
        updatedAt: now,
        service: input.service,
        model: input.model,
        pageUrl: sanitizeDiagnosticPageUrl(input.metadata.pageUrl),
        textCharacters: input.metadata.attempt === 0 ? input.characters : 0,
        requestCount: 1,
        cacheHits: 0,
        retryCount: input.metadata.attempt,
        queueDurationMs: Math.max(0, input.metadata.requestStartedAt - input.metadata.queuedAt),
        apiDurationMs: Math.max(0, input.durationMs),
        firstResultMs: input.success ? Math.max(0, now - input.metadata.startedAt) : undefined,
        totalDurationMs: Math.max(0, now - input.metadata.startedAt),
        errorTypes: errorType ? [errorType] : [],
      }, ...sessions]
    }

    existing.updatedAt = now
    existing.service = input.service
    existing.model = input.model
    existing.pageUrl ??= sanitizeDiagnosticPageUrl(input.metadata.pageUrl)
    if (input.metadata.attempt === 0) existing.textCharacters += input.characters
    existing.requestCount += 1
    existing.retryCount = Math.max(existing.retryCount, input.metadata.attempt)
    existing.queueDurationMs += Math.max(0, input.metadata.requestStartedAt - input.metadata.queuedAt)
    existing.apiDurationMs += Math.max(0, input.durationMs)
    existing.totalDurationMs = Math.max(0, now - existing.startedAt)
    if (input.success && existing.firstResultMs === undefined) {
      existing.firstResultMs = Math.max(0, now - existing.startedAt)
    }
    if (errorType && !existing.errorTypes.includes(errorType)) existing.errorTypes.push(errorType)
    return sessions
  })
}

export async function recordTranslationDiagnosticCacheHit(input: {
  context: TranslationDiagnosticContext
  characters: number
}): Promise<void> {
  const now = Date.now()
  const sessionId = input.context.sessionId ?? createTranslationDiagnosticId()
  await enqueueWrite((sessions) => {
    const existing = sessions.find(session => session.id === sessionId)
    if (existing) {
      existing.updatedAt = now
      existing.textCharacters += Math.max(0, input.characters)
      existing.cacheHits += 1
      existing.firstResultMs ??= Math.max(0, now - existing.startedAt)
      existing.totalDurationMs = Math.max(0, now - existing.startedAt)
      return sessions
    }
    return [{
      id: sessionId,
      scene: input.context.scene ?? 'other',
      startedAt: input.context.startedAt ?? now,
      updatedAt: now,
      service: 'cache',
      model: 'none',
      pageUrl: sanitizeDiagnosticPageUrl(input.context.pageUrl),
      textCharacters: Math.max(0, input.characters),
      requestCount: 0,
      cacheHits: 1,
      retryCount: 0,
      queueDurationMs: 0,
      apiDurationMs: 0,
      firstResultMs: 0,
      totalDurationMs: 0,
      errorTypes: [],
    }, ...sessions]
  })
}

export async function recordTranslationDiagnosticVisible(sessionId: string, visibleAt = Date.now()): Promise<void> {
  await enqueueWrite((sessions) => {
    const existing = sessions.find(session => session.id === sessionId)
    if (!existing) return sessions
    existing.updatedAt = visibleAt
    existing.firstVisibleMs ??= Math.max(0, visibleAt - existing.startedAt)
    existing.extensionProcessingMs ??= existing.firstResultMs === undefined
      ? undefined
      : Math.max(0, existing.firstVisibleMs - existing.firstResultMs)
    existing.totalDurationMs = Math.max(0, visibleAt - existing.startedAt)
    return sessions
  })
}

export async function getRecentTranslationDiagnostics(): Promise<TranslationDiagnosticSession[]> {
  await writeChain.catch(() => undefined)
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = undefined
    await persistCachedSessions()
  }
  await persistenceChain.catch(() => undefined)
  cachedSessions = await readStoredSessions()
  return cachedSessions
}

export async function clearTranslationDiagnostics(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      await persistenceChain.catch(() => undefined)
      cachedSessions = []
      await storage.removeItem(TRANSLATION_DIAGNOSTICS_STORAGE_KEY)
    })
  await writeChain
}

export function createDiagnosticMetadata(
  context: TranslationDiagnosticContext | undefined,
  attempt: number,
  queuedAt: number,
): TranslationDiagnosticMetadata {
  const startedAt = context?.startedAt ?? queuedAt
  return {
    sessionId: context?.sessionId ?? createTranslationDiagnosticId(),
    requestId: createTranslationDiagnosticId('request'),
    scene: context?.scene ?? 'other',
    startedAt,
    queuedAt,
    requestStartedAt: Date.now(),
    attempt,
    pageUrl: sanitizeDiagnosticPageUrl(context?.pageUrl),
  }
}
