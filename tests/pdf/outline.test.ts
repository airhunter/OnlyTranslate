import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy, type PageViewport } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { findPdfOutlineBlock, pdfDestinationAnchor, PdfOutlineController, type PdfOutlineItem } from '../../entrypoints/pdf/outline'

GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
let fixtureDocument: PDFDocumentProxy
let fixturePage: PDFPageProxy
beforeAll(async () => {
  fixtureDocument = await getDocument({ data: new Uint8Array(readFileSync(resolve('tests/fixtures/pdf/embedded-outline.pdf'))) }).promise
  fixturePage = await fixtureDocument.getPage(1)
})
afterAll(async () => { await fixtureDocument?.destroy() })
function viewport(rotation = 0): PageViewport {
  return fixturePage.getViewport({ scale: 1, rotation })
}

function item(id: string, dest: PdfOutlineItem['dest']): PdfOutlineItem {
  return { id, title: id, dest, items: [] }
}

function documentStub() {
  return {
    numPages: 10,
    getOutline: vi.fn().mockResolvedValue(null),
    getDestination: vi.fn().mockResolvedValue([{ num: 5, gen: 0 }, { name: 'XYZ' }, 70, 620, null]),
    getPageIndex: vi.fn().mockResolvedValue(2),
    getPage: vi.fn().mockResolvedValue({ getViewport: () => viewport() }),
  }
}

function controller(document: ReturnType<typeof documentStub>): PdfOutlineController {
  return new PdfOutlineController(document as unknown as PDFDocumentProxy)
}

describe('PDF embedded outline', () => {
  it('reads a real PDF outline with nested same-page bookmarks and a rotated named destination', async () => {
    const outline = new PdfOutlineController(fixtureDocument)
    const entries = await outline.getItems()
    expect(entries.map(entry => entry.title)).toEqual(['Part One', 'Chapter Two'])
    expect(entries[0].dest).toBeNull()
    expect(entries[0].items.map(entry => entry.title)).toEqual(['Section A', 'Section B'])
    expect(await outline.resolveTarget(entries[0].items[0])).toEqual({ pageNumber: 2, x: 0.1, y: 0.25 })
    expect(await outline.resolveTarget(entries[0].items[1])).toEqual({ pageNumber: 2, x: 0.1, y: 0.65 })
    expect(await outline.resolveTarget(entries[1])).toEqual({ pageNumber: 3, x: 0.75, y: 0 })
  })
  it('preserves nested entries and gives repeated titles distinct identities without looking up destinations', async () => {
    const doc = documentStub()
    doc.getOutline.mockResolvedValue([
      { title: 'Chapter', dest: null, items: [{ title: 'Section', dest: 'section', items: [] }] },
      { title: 'Chapter', dest: [3, { name: 'Fit' }], items: [] },
    ])
    expect(await controller(doc).getItems()).toEqual([
      { id: '0', title: 'Chapter', dest: null, items: [{ id: '0.0', title: 'Section', dest: 'section', items: [] }] },
      { id: '1', title: 'Chapter', dest: [3, { name: 'Fit' }], items: [] },
    ])
    expect(doc.getDestination).not.toHaveBeenCalled()
    expect(doc.getPage).not.toHaveBeenCalled()
  })

  it('returns an empty directory when no outline exists and propagates a loading failure', async () => {
    const doc = documentStub()
    expect(await controller(doc).getItems()).toEqual([])
    doc.getOutline.mockRejectedValue(new Error('Range request failed'))
    await expect(controller(doc).getItems()).rejects.toThrow('Range request failed')
  })

  it('resolves named destinations and page references once per selected entry', async () => {
    const doc = documentStub()
    const outline = controller(doc)
    const selected = item('0', 'section')
    const [first, second] = await Promise.all([outline.resolveTarget(selected), outline.resolveTarget(selected)])
    expect(first).toEqual({ pageNumber: 3, x: 0.1, y: 0.25 })
    expect(second).toEqual(first)
    expect(doc.getDestination).toHaveBeenCalledExactlyOnceWith('section')
    expect(doc.getPageIndex).toHaveBeenCalledExactlyOnceWith({ num: 5, gen: 0 })
    expect(doc.getPage).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('accepts a zero-based direct page index without a page reference lookup', async () => {
    const doc = documentStub()
    expect(await controller(doc).resolveTarget(item('0', [0, { name: 'Fit' }]))).toEqual({ pageNumber: 1, x: 0, y: 0 })
    expect(doc.getPageIndex).not.toHaveBeenCalled()
  })

  it.each([null, [], [-1], [10], [1.5], ['invalid'], [{}], [{ num: 1 }]])('rejects missing or malformed targets: %j', async (dest) => {
    const doc = documentStub()
    expect(await controller(doc).resolveTarget(item('0', dest))).toBeUndefined()
    expect(doc.getPage).not.toHaveBeenCalled()
  })

  it('handles missing named destinations and permits retry after a lookup error', async () => {
    const doc = documentStub()
    const outline = controller(doc)
    doc.getDestination.mockResolvedValueOnce(null)
    expect(await outline.resolveTarget(item('missing', 'missing'))).toBeUndefined()
    doc.getDestination.mockRejectedValueOnce(new Error('offline'))
    await expect(outline.resolveTarget(item('retry', 'retry'))).rejects.toThrow('offline')
    expect(await outline.resolveTarget(item('retry', 'retry'))).toMatchObject({ pageNumber: 3 })
  })

  it('isolates destination caches between documents', async () => {
    const first = documentStub()
    const second = documentStub()
    second.getPageIndex.mockResolvedValue(7)
    const selected = item('0', 'chapter')
    expect(await controller(first).resolveTarget(selected)).toMatchObject({ pageNumber: 3 })
    expect(await controller(second).resolveTarget(selected)).toMatchObject({ pageNumber: 8 })
  })
})

describe('PDF outline positions', () => {
  it('converts coordinates using the cropped page and page rotation', () => {
    const dest = [0, { name: 'XYZ' }, 70, 620, null]
    expect(pdfDestinationAnchor(dest, viewport())).toEqual({ x: 0.1, y: 0.25 })
    expect(pdfDestinationAnchor(dest, viewport(90))).toEqual({ x: 0.75, y: 0.1 })
    expect(pdfDestinationAnchor(dest, viewport(180))).toEqual({ x: 0.9, y: 0.75 })
    expect(pdfDestinationAnchor(dest, viewport(270))).toEqual({ x: 0.25, y: 0.9 })
  })

  it('supports horizontal, vertical and rectangular destinations', () => {
    for (const name of ['FitH', 'FitBH']) {
      expect(pdfDestinationAnchor([0, { name }, 620], viewport())).toEqual({ x: 0, y: 0.25 })
    }
    for (const name of ['FitV', 'FitBV']) {
      expect(pdfDestinationAnchor([0, { name }, 70], viewport())).toEqual({ x: 0.1, y: 0 })
    }
    expect(pdfDestinationAnchor([0, { name: 'FitR' }, 70, 220, 370, 620], viewport())).toEqual({ x: 0.1, y: 0.25 })
    expect(pdfDestinationAnchor([0, { name: 'FitH' }, 620], viewport(90))).toEqual({ x: 0.75, y: 0 })
  })

  it('falls back to page start for unspecified positions and clamps invalid coordinates', () => {
    expect(pdfDestinationAnchor([0, { name: 'XYZ' }, null, null], viewport())).toEqual({ x: 0, y: 0 })
    expect(pdfDestinationAnchor([0, { name: 'XYZ' }, NaN, Infinity], viewport())).toEqual({ x: 0, y: 0 })
    expect(pdfDestinationAnchor([0, { name: 'XYZ' }, -200, -200], viewport())).toEqual({ x: 0, y: 1 })
    expect(pdfDestinationAnchor([0, { name: 'Fit' }], viewport())).toEqual({ x: 0, y: 0 })
  })

  it('chooses the nearest visible reading block in the correct column', () => {
    const blocks = [
      { id: 'left', x: 30, y: 200, width: 200, height: 100 },
      { id: 'right', x: 330, y: 200, width: 200, height: 100 },
      { id: 'later', x: 30, y: 500, width: 500, height: 100 },
    ]
    expect(findPdfOutlineBlock(blocks, { pageNumber: 1, x: 0.6, y: 0.25 }, 600, 800)?.id).toBe('right')
    expect(findPdfOutlineBlock(blocks, { pageNumber: 1, x: 0.1, y: 0.6 }, 600, 800)?.id).toBe('later')
    expect(findPdfOutlineBlock(blocks, { pageNumber: 1, x: 0, y: 0 }, 600, 800)).toBeUndefined()
    expect(findPdfOutlineBlock([], { pageNumber: 1, x: 0.1, y: 0.5 }, 600, 800)).toBeUndefined()
  })
})
