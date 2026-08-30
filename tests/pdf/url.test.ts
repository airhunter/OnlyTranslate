import { describe, expect, it, vi } from 'vitest'

vi.mock('webextension-polyfill', () => ({
  default: { runtime: { getURL: vi.fn() } },
}))
import { getPdfReaderUrl, getRequestedPdfSource, isLikelyPdfUrl, isPdfContentType } from '@/entrypoints/pdf/url'

describe('PDF reader URL routing', () => {
  it('recognizes direct and query-wrapped PDF links', () => {
    expect(isLikelyPdfUrl('https://aclanthology.org/2023.wmt-1.41.pdf')).toBe(true)
    expect(isLikelyPdfUrl('https://example.com/download?file=paper.pdf')).toBe(true)
    expect(isLikelyPdfUrl('https://example.com/article')).toBe(false)
    expect(isLikelyPdfUrl('chrome://settings')).toBe(false)
  })

  it('recognizes PDF response content types with optional parameters', () => {
    expect(isPdfContentType('application/pdf')).toBe(true)
    expect(isPdfContentType('application/pdf; charset=binary')).toBe(true)
    expect(isPdfContentType('text/html')).toBe(false)
  })

  it('round-trips an online source through the extension reader URL', () => {
    const source = 'https://example.com/paper.pdf?download=1&lang=en'
    const readerUrl = getPdfReaderUrl(source, { getURL: path => `chrome-extension://onlytranslate${path}` })
    expect(readerUrl).toBe(`chrome-extension://onlytranslate/pdf.html?source=${encodeURIComponent(source)}`)
    expect(getRequestedPdfSource(new URL(readerUrl).search)).toBe(source)
  })

  it('rejects unsafe reader source schemes', () => {
    expect(getRequestedPdfSource('?source=javascript%3Aalert(1)')).toBeUndefined()
    expect(getRequestedPdfSource('?source=data%3Aapplication%2Fpdf%2Cbad')).toBeUndefined()
  })
})
