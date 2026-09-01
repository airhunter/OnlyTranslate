import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type RenderTask,
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { buildPdfTextBlocks, type PdfTextBlock, type PdfTextSpan } from './layout'
import { PdfLayoutModelClient } from './layoutModelClient'
import { buildSemanticPdfBlocks } from './semanticLayout'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PdfRenderedPage {
  pageNumber: number
  pageCount: number
  width: number
  height: number
  blocks: PdfTextBlock[]
  layoutMode: 'heuristic' | 'semantic'
  layoutElapsedMs?: number
  layoutError?: string
}

export interface PdfRenderOptions {
  semanticLayout?: boolean
}

export class PdfSourceError extends Error {
  constructor(
    public readonly code: 'LOAD_FAILED' | 'NOT_PDF' | 'PASSWORD_REQUIRED',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'PdfSourceError'
  }
}

function looksLikePdf(data: Uint8Array): boolean {
  const header = new TextDecoder('latin1').decode(data.subarray(0, Math.min(1024, data.length)))
  return header.includes('%PDF-')
}

async function fetchPdfData(sourceUrl: string): Promise<Uint8Array> {
  const response = await fetch(sourceUrl, { credentials: 'include' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const data = new Uint8Array(await response.arrayBuffer())
  if (!looksLikePdf(data)) throw new PdfSourceError('NOT_PDF', 'The selected URL did not return a PDF file')
  return data
}

export async function downloadRemotePdf(sourceUrl: string): Promise<File> {
  const data = await fetchPdfData(sourceUrl)
  let filename = 'document.pdf'
  try {
    const url = new URL(sourceUrl)
    const candidate = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '')
    filename = candidate.toLocaleLowerCase().endsWith('.pdf') ? candidate : `${candidate || 'document'}.pdf`
  }
  catch {
    // Keep the stable fallback filename.
  }
  return new File([data], filename, { type: 'application/pdf' })
}

async function extractTextSpans(page: PDFPageProxy, viewport: PageViewport, scale: number): Promise<PdfTextSpan[]> {
  const textContent = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false })
  return textContent.items.flatMap(item => {
    if (!('str' in item)) return []
    const [x, baselineY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    const fontHeight = Math.max(1, Math.hypot(item.transform[2], item.transform[3]) * scale)
    return [{
      text: item.str,
      x,
      y: baselineY - fontHeight,
      width: item.width * scale,
      height: Math.max(fontHeight, item.height * scale),
      baseline: baselineY,
      fontName: item.fontName,
    }]
  })
}

function createLayoutCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) throw new PdfSourceError('LOAD_FAILED', 'Canvas layout analysis is unavailable')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function attachVisualCrops(
  page: PDFPageProxy,
  blocks: PdfTextBlock[],
  viewport: PageViewport,
): Promise<PdfTextBlock[]> {
  const imageUrls = new Map<string, string>()
  for (const block of blocks) {
    if (block.kind !== 'visual') continue
    const padding = 7
    const x = Math.max(0, block.x - padding)
    const y = Math.max(0, block.y - padding)
    const width = Math.min(viewport.width - x, block.width + padding * 2)
    const height = Math.min(viewport.height - y, block.height + padding * 2)
    if (width <= 0 || height <= 0) continue

    // Layout analysis intentionally uses a page-sized CSS-pixel canvas. Rendering
    // the detected region again keeps vector formulas and embedded figures sharp
    // when the reading view or lightbox displays them larger than the source pane.
    const targetWidth = block.visualKind === 'formula' ? 1200 : 1500
    const desiredScale = Math.max(3, targetWidth / width)
    const cropScale = Math.max(1, Math.min(20, desiredScale, 1800 / width, 1600 / height))
    const crop = document.createElement('canvas')
    crop.width = Math.max(1, Math.ceil(width * cropScale))
    crop.height = Math.max(1, Math.ceil(height * cropScale))
    const cropContext = crop.getContext('2d', { alpha: false })
    if (!cropContext) continue
    const cropViewport = viewport.clone({
      scale: viewport.scale * cropScale,
      offsetX: -x * cropScale,
      offsetY: -y * cropScale,
    })
    await page.render({
      canvas: crop,
      canvasContext: cropContext,
      viewport: cropViewport,
      background: '#ffffff',
    }).promise
    imageUrls.set(block.id, crop.toDataURL('image/png'))
  }

  return blocks.map(block => imageUrls.has(block.id)
    ? { ...block, imageUrl: imageUrls.get(block.id) }
    : block)
}

export class PdfReaderController {
  private document?: PDFDocumentProxy
  private loadingTask?: PDFDocumentLoadingTask
  private renderTask?: RenderTask
  private readonly layoutModel = new PdfLayoutModelClient()
  private readonly textLayoutCache = new Map<number, Promise<PdfRenderedPage>>()

  get pageCount(): number {
    return this.document?.numPages ?? 0
  }

  async openRemote(sourceUrl: string): Promise<number> {
    this.close()
    try {
      // Prefer PDF.js URL loading so servers that support byte ranges can stream
      // large documents. Extension-origin fetch is the compatibility fallback.
      return await this.openTask(getDocument({ url: sourceUrl, withCredentials: false }))
    }
    catch (error) {
      this.loadingTask?.destroy()
      this.loadingTask = undefined
      try {
        return await this.openData(await fetchPdfData(sourceUrl))
      }
      catch (fallbackError) {
        if (fallbackError instanceof PdfSourceError) throw fallbackError
        throw new PdfSourceError('LOAD_FAILED', 'The online PDF could not be loaded', { cause: fallbackError ?? error })
      }
    }
  }

  async openFile(file: File): Promise<number> {
    if (!file.name.toLocaleLowerCase().endsWith('.pdf')) {
      throw new PdfSourceError('NOT_PDF', 'Only PDF files are supported')
    }
    const data = new Uint8Array(await file.arrayBuffer())
    if (!looksLikePdf(data)) throw new PdfSourceError('NOT_PDF', 'The selected file is not a valid PDF')
    this.close()
    return this.openData(data)
  }

  async renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    availableWidth: number,
    options: PdfRenderOptions = {},
  ): Promise<PdfRenderedPage> {
    const document = this.document
    if (!document) throw new PdfSourceError('LOAD_FAILED', 'No PDF is open')
    const safePageNumber = Math.min(document.numPages, Math.max(1, Math.trunc(pageNumber)))
    this.renderTask?.cancel()

    const page = await document.getPage(safePageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.max(0.5, Math.min(2.5, availableWidth / baseViewport.width))
    const viewport = page.getViewport({ scale })
    const outputScale = window.devicePixelRatio || 1
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new PdfSourceError('LOAD_FAILED', 'Canvas rendering is unavailable')

    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const transform = outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
    this.renderTask = page.render({ canvas, canvasContext: context, viewport, transform })

    const [spans] = await Promise.all([
      extractTextSpans(page, viewport, scale),
      this.renderTask.promise,
    ])

    let blocks = buildPdfTextBlocks(spans, viewport.width, viewport.height)
    let layoutMode: PdfRenderedPage['layoutMode'] = 'heuristic'
    let layoutElapsedMs: number | undefined
    let layoutError: string | undefined
    if (options.semanticLayout) {
      try {
        const layoutCanvas = createLayoutCanvas(canvas, viewport.width, viewport.height)
        const layoutContext = layoutCanvas.getContext('2d', { willReadFrequently: true })
        if (!layoutContext) throw new Error('无法读取 PDF 页面像素')
        const analysis = await this.layoutModel.analyze(
          layoutContext.getImageData(0, 0, layoutCanvas.width, layoutCanvas.height),
          new URL('/pdf-layout/', location.origin).toString(),
        )
        const semanticBlocks = buildSemanticPdfBlocks(
          spans,
          analysis.regions,
          viewport.width,
          viewport.height,
          `page-${safePageNumber}`,
        )
        const readableCharacters = semanticBlocks
          .filter(block => ['heading', 'body', 'abstract', 'list-item', 'caption'].includes(block.kind))
          .reduce((total, block) => total + block.text.replace(/\s/g, '').length, 0)
        if (readableCharacters < 24) throw new Error('模型未识别到足够的可读正文')
        blocks = await attachVisualCrops(page, semanticBlocks, viewport)
        layoutMode = 'semantic'
        layoutElapsedMs = analysis.elapsedMs
      }
      catch (error) {
        layoutError = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      pageNumber: safePageNumber,
      pageCount: document.numPages,
      width: viewport.width,
      height: viewport.height,
      blocks,
      layoutMode,
      layoutElapsedMs,
      layoutError,
    }
  }

  async renderThumbnail(pageNumber: number, width = 82): Promise<string> {
    const pdfDocument = this.document
    if (!pdfDocument) throw new PdfSourceError('LOAD_FAILED', 'No PDF is open')
    const safePageNumber = Math.min(pdfDocument.numPages, Math.max(1, Math.trunc(pageNumber)))
    const page = await pdfDocument.getPage(safePageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.max(0.1, width / baseViewport.width)
    const viewport = page.getViewport({ scale })
    const outputScale = Math.min(2, window.devicePixelRatio || 1)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new PdfSourceError('LOAD_FAILED', 'Canvas rendering is unavailable')

    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale))
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale))
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    }).promise
    return canvas.toDataURL('image/jpeg', 0.76)
  }

  extractPage(pageNumber: number): Promise<PdfRenderedPage> {
    const document = this.document
    if (!document) return Promise.reject(new PdfSourceError('LOAD_FAILED', 'No PDF is open'))
    const safePageNumber = Math.min(document.numPages, Math.max(1, Math.trunc(pageNumber)))
    const cached = this.textLayoutCache.get(safePageNumber)
    if (cached) return cached

    const extraction = (async () => {
      const page = await document.getPage(safePageNumber)
      const viewport = page.getViewport({ scale: 1 })
      return {
        pageNumber: safePageNumber,
        pageCount: document.numPages,
        width: viewport.width,
        height: viewport.height,
        blocks: buildPdfTextBlocks(await extractTextSpans(page, viewport, 1), viewport.width, viewport.height),
        layoutMode: 'heuristic' as const,
      }
    })()
    this.textLayoutCache.set(safePageNumber, extraction)
    void extraction.catch(() => this.textLayoutCache.delete(safePageNumber))
    return extraction
  }

  close(): void {
    this.renderTask?.cancel()
    this.renderTask = undefined
    void this.loadingTask?.destroy()
    this.loadingTask = undefined
    void this.document?.destroy()
    this.document = undefined
    this.layoutModel.destroy()
    this.textLayoutCache.clear()
  }

  resetLayoutModel(): void {
    this.layoutModel.destroy()
  }

  private openData(data: Uint8Array): Promise<number> {
    return this.openTask(getDocument({ data }))
  }

  private async openTask(task: PDFDocumentLoadingTask): Promise<number> {
    this.loadingTask = task
    let passwordRequested = false
    task.onPassword = () => {
      passwordRequested = true
      void task.destroy()
    }
    try {
      this.document = await task.promise
      return this.document.numPages
    }
    catch (error) {
      if (passwordRequested || /password/i.test(error instanceof Error ? error.message : String(error))) {
        throw new PdfSourceError('PASSWORD_REQUIRED', 'Password-protected PDFs are not supported yet', { cause: error })
      }
      throw error
    }
  }
}
