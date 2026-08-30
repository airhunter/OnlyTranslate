import browser from 'webextension-polyfill'

const PDF_PATH_PATTERN = /\.pdf$/i

export function isPdfContentType(value: string | null | undefined): boolean {
  return /^application\/pdf(?:\s*;|$)/i.test(value?.trim() ?? '')
}

export function isLikelyPdfUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) return false
    if (PDF_PATH_PATTERN.test(url.pathname)) return true
    return [...url.searchParams.values()].some(part => PDF_PATH_PATTERN.test(part.split(/[?#]/, 1)[0] ?? ''))
  }
  catch {
    return false
  }
}

export function getPdfReaderUrl(
  sourceUrl?: string,
  runtime: { getURL(path: string): string } = browser.runtime,
): string {
  const readerUrl = new URL(runtime.getURL('/pdf.html'))
  if (sourceUrl) readerUrl.searchParams.set('source', sourceUrl)
  return readerUrl.toString()
}

export function getRequestedPdfSource(search: string): string | undefined {
  const value = new URLSearchParams(search).get('source')?.trim()
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.toString() : undefined
  }
  catch {
    return undefined
  }
}
