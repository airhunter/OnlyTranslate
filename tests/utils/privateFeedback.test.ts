import { describe, expect, it, vi } from 'vitest'
import {
  describeBrowser,
  sanitizeFeedbackPageUrl,
  selectFeedbackDiagnostics,
  submitPrivateFeedback,
} from '@/entrypoints/utils/privateFeedback'
import type { TranslationDiagnosticSession } from '@/entrypoints/utils/translationDiagnostics'

function session(id: string, pageUrl?: string): TranslationDiagnosticSession {
  return {
    id,
    scene: 'webpage',
    startedAt: 1,
    updatedAt: 2,
    service: 'deepseek',
    model: 'deepseek-chat',
    pageUrl,
    textCharacters: 100,
    requestCount: 1,
    cacheHits: 0,
    retryCount: 0,
    queueDurationMs: 10,
    apiDurationMs: 50,
    firstResultMs: 60,
    firstVisibleMs: 65,
    extensionProcessingMs: 5,
    totalDurationMs: 65,
    errorTypes: [],
  }
}

describe('private feedback data', () => {
  it('keeps an explicitly submitted query string but removes the fragment', () => {
    expect(sanitizeFeedbackPageUrl('https://comuniq.xyz/post?t=1439#part')).toBe('https://comuniq.xyz/post?t=1439')
    expect(sanitizeFeedbackPageUrl('chrome-extension://secret/options.html')).toBeUndefined()
  })

  it('removes local ids and page URLs from submitted diagnostics', () => {
    const selected = selectFeedbackDiagnostics([
      session('one', 'https://example.com/a'),
      session('two'),
      session('three'),
      session('four'),
    ], 'last3')
    expect(selected).toHaveLength(3)
    expect(selected[0]).not.toHaveProperty('id')
    expect(selected[0]).not.toHaveProperty('pageUrl')
    expect(selected[0]).not.toHaveProperty('startedAt')
    expect(selected[0]).not.toHaveProperty('updatedAt')
  })

  it('reports only browser family and major version', () => {
    expect(describeBrowser('Mozilla/5.0 Chrome/140.0.7339.1 Safari/537.36')).toBe('Chrome 140')
    expect(describeBrowser('Mozilla/5.0 Edg/141.0 Chrome/141.0')).toBe('Edge 141')
  })

  it('returns the private feedback id from the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'OT-20260809-ABC' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
    await expect(submitPrivateFeedback({
      type: 'extension_feedback', schemaVersion: 1, source: 'extension', version: '1.7.0',
      locale: 'zh-CN', category: 'performance', message: '慢',
    }, fetcher)).resolves.toBe('OT-20260809-ABC')
  })
})
