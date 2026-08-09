import { describe, expect, it } from 'vitest'
import {
  classifyTranslationDiagnosticError,
  createDiagnosticMetadata,
  sanitizeDiagnosticPageUrl,
} from '@/entrypoints/utils/translationDiagnostics'

describe('translation diagnostics privacy and classification', () => {
  it('stores only a URL origin and pathname', () => {
    expect(sanitizeDiagnosticPageUrl('https://example.com/article?q=secret#section')).toBe('https://example.com/article')
    expect(sanitizeDiagnosticPageUrl('file:///Users/example/private.html')).toBeUndefined()
  })

  it('classifies errors without retaining provider error text', () => {
    expect(classifyTranslationDiagnosticError(new Error('HTTP 429: quota exceeded'))).toBe('rate_limit')
    expect(classifyTranslationDiagnosticError(new Error('request timed out with secret text'))).toBe('timeout')
    expect(classifyTranslationDiagnosticError(new Error('invalid JSON response'))).toBe('response_parse')
  })

  it('uses a shared session and records retry attempt metadata', () => {
    const metadata = createDiagnosticMetadata({
      sessionId: 'webpage-test', scene: 'webpage', startedAt: 100, pageUrl: 'https://example.com/a?secret=1',
    }, 2, 150)
    expect(metadata).toMatchObject({
      sessionId: 'webpage-test', scene: 'webpage', startedAt: 100, attempt: 2,
      pageUrl: 'https://example.com/a', queuedAt: 150,
    })
  })
})
