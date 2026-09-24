import type { PdfTextBlock } from './layout'
import { selectPdfReadingBlocks, selectPdfReadingTranslationBlocks } from './overlay'
import type { PdfReaderController } from './readerController'
import { PdfTranslationCoordinator, type PdfTranslationStatus } from './translationCoordinator'

export interface BilingualPdfBlock {
  id: string
  kind: PdfTextBlock['kind']
  original: string
  translation?: string
}

export interface BilingualPdfPage {
  number: number
  originalImage: string
  blocks: BilingualPdfBlock[]
}

export interface BilingualPdfProgress {
  completed: number
  total: number
}

export interface BilingualPdfOptions {
  title: string
  sourceUrl?: string
  signal?: AbortSignal
  onProgress?: (progress: BilingualPdfProgress) => void
  translate?: (source: string) => Promise<string>
}

export class BilingualPdfExportError extends Error {
  constructor(public readonly code: 'INCOMPLETE' | 'NO_TEXT') {
    super(code)
    this.name = 'BilingualPdfExportError'
  }
}

function ensureActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('PDF export cancelled', 'AbortError')
}

export async function collectBilingualPdfPages(
  reader: Pick<PdfReaderController, 'pageCount' | 'extractPage' | 'renderThumbnail'>,
  options: BilingualPdfOptions,
): Promise<BilingualPdfPage[]> {
  ensureActive(options.signal)
  const pageCount = reader.pageCount
  if (!pageCount) throw new BilingualPdfExportError('NO_TEXT')
  const pages: BilingualPdfPage[] = []
  let translatedCount = 0
  options.onProgress?.({ completed: 0, total: pageCount })

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    ensureActive(options.signal)
    const rendered = await reader.extractPage(pageNumber)
    ensureActive(options.signal)
    const readingBlocks = selectPdfReadingBlocks(rendered.blocks)
    const selected = selectPdfReadingTranslationBlocks(readingBlocks)
    const translations = new Map<string, string>()
    let status: PdfTranslationStatus = { total: 0, completed: 0, failed: 0, running: false }
    const coordinator = new PdfTranslationCoordinator({
      ...(options.translate ? { translate: source => options.translate!(source) } : {}),
      onTranslation: (id, translation) => translations.set(id, translation),
      onStatus: next => { status = next },
    })
    const cancel = () => coordinator.cancel()
    options.signal?.addEventListener('abort', cancel, { once: true })
    try {
      await coordinator.start(selected, `${options.title} · ${pageNumber}`, options.sourceUrl)
      ensureActive(options.signal)
      if (status.failed || status.completed !== status.total) throw new BilingualPdfExportError('INCOMPLETE')
    } finally {
      options.signal?.removeEventListener('abort', cancel)
    }
    translatedCount += status.completed
    const originalImage = await reader.renderThumbnail(pageNumber, 760)
    ensureActive(options.signal)
    pages.push({
      number: pageNumber,
      originalImage,
      blocks: readingBlocks
        .filter(block => block.kind !== 'visual' && block.kind !== 'metadata' && block.text.trim())
        .map(block => ({
          id: block.id,
          kind: block.kind,
          original: block.mathSource?.trim() || block.text,
          ...(translations.has(block.id) ? { translation: translations.get(block.id) } : {}),
        })),
    })
    options.onProgress?.({ completed: pageNumber, total: pageCount })
  }
  if (!translatedCount) throw new BilingualPdfExportError('NO_TEXT')
  return pages
}
