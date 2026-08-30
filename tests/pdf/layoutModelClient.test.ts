import { describe, expect, it, vi } from 'vitest'
import { getPdfLayoutWorkerUrl, PDF_LAYOUT_WORKER_PATH } from '@/entrypoints/pdf/layoutModelClient'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
  },
}))

describe('PDF layout model worker URL', () => {
  it('always resolves the worker from the extension origin', () => {
    const runtime = {
      getURL: (path: string) => `chrome-extension://onlytranslate${path}`,
    }

    expect(PDF_LAYOUT_WORKER_PATH).toBe('/pdf-layout-model.js')
    expect(getPdfLayoutWorkerUrl(runtime as any))
      .toBe('chrome-extension://onlytranslate/pdf-layout-model.js')
  })
})
