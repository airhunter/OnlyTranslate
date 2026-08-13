import type { TranslationDiagnosticSession } from './translationDiagnostics'

export const PRIVATE_FEEDBACK_ENDPOINT = 'https://onlytranslate.top/api/feedback'

export type FeedbackDiagnosticRange = 'latest' | 'last3'
export type FeedbackDiagnosticSession = Omit<TranslationDiagnosticSession, 'id' | 'pageUrl' | 'startedAt' | 'updatedAt'>

export interface PrivateFeedbackPayload {
  type: 'extension_feedback'
  schemaVersion: 1
  source: 'extension'
  version: string
  locale: string
  category: string
  message: string
  contact?: {
    email: string
    consent: true
  }
  pageUrl?: string
  diagnostics?: {
    formatVersion: 1
    browser: string
    sessions: FeedbackDiagnosticSession[]
  }
}

export function normalizeFeedbackEmail(value: string): string | undefined {
  const normalized = value.trim()
  if (
    !normalized
    || normalized.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return undefined
  }
  return normalized
}

export function describeBrowser(userAgent: string): string {
  const patterns: Array<[string, RegExp]> = [
    ['Edge', /Edg\/([0-9]+)/],
    ['Firefox', /Firefox\/([0-9]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([0-9]+)/],
    ['Safari', /Version\/([0-9]+).+Safari/],
  ]
  for (const [name, pattern] of patterns) {
    const version = pattern.exec(userAgent)?.[1]
    if (version) return `${name} ${version}`
  }
  return 'Unknown'
}

export function sanitizeFeedbackPageUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return `${url.origin}${url.pathname}${url.search}`.slice(0, 2048)
  }
  catch {
    return undefined
  }
}

export function selectFeedbackDiagnostics(
  sessions: TranslationDiagnosticSession[],
  range: FeedbackDiagnosticRange,
): FeedbackDiagnosticSession[] {
  const limit = range === 'last3' ? 3 : 1
  return sessions.slice(0, limit).map(({
    id: _id,
    pageUrl: _pageUrl,
    startedAt: _startedAt,
    updatedAt: _updatedAt,
    ...session
  }) => session)
}

export async function submitPrivateFeedback(
  payload: PrivateFeedbackPayload,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(PRIVATE_FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({})) as { id?: unknown; error?: unknown }
  if (!response.ok || typeof body.id !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${response.status}`)
  }
  return body.id
}
