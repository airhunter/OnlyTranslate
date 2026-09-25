import type { PdfTextBlock } from './layout'
import { selectPdfReadingBlocks, selectPdfReadingTranslationBlocks } from './overlay'
import type { PdfReaderController } from './readerController'
import { PdfTranslationCoordinator, type PdfTranslationStatus } from './translationCoordinator'
import { translateText } from '@/entrypoints/utils/translateApi'
import { ExportCheckpointMismatchError, type EbookRepository } from '@/entrypoints/ebook/repository'
import { createExportFingerprint, createExportTranslator, ExportRateLimitError, ExportSettingsChangedError, hashExportSource } from '@/entrypoints/ebook/exportTranslation'

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
  checkpoint?: { repository: EbookRepository; bookId: string; fingerprint: string }
}

export class BilingualPdfExportError extends Error {
  constructor(public readonly code: 'INCOMPLETE' | 'NO_TEXT' | 'RATE_LIMITED' | 'SETTINGS_CHANGED', cause?: unknown) {
    super(code, { cause })
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
  const checkpoint = options.checkpoint
  const savedPages = new Map<number, { sourceKey: string; value: Record<string, string> }>()
  if (checkpoint) {
    if (await createExportFingerprint('pdf') !== checkpoint.fingerprint) throw new BilingualPdfExportError('SETTINGS_CHANGED')
    try {
      await checkpoint.repository.startExportCheckpoint(checkpoint.bookId, 'pdf', checkpoint.fingerprint, pageCount)
    } catch (error) {
      if (error instanceof ExportCheckpointMismatchError) throw new BilingualPdfExportError('SETTINGS_CHANGED', error)
      throw error
    }
    const segments = await checkpoint.repository.listExportSegments<Record<string, string>>(checkpoint.bookId, 'pdf')
    segments.forEach(segment => {
      if (segment.index >= 0 && segment.index < pageCount) savedPages.set(segment.index + 1, segment)
    })
  }
  options.onProgress?.({ completed: 0, total: pageCount })
  const exportTranslate = createExportTranslator(options.signal,
    options.translate ? async source => options.translate!(source) : translateText)

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    ensureActive(options.signal)
    const rendered = await reader.extractPage(pageNumber)
    ensureActive(options.signal)
    const readingBlocks = selectPdfReadingBlocks(rendered.blocks)
    const selected = selectPdfReadingTranslationBlocks(readingBlocks)
    const sourceKey = await hashExportSource(JSON.stringify(selected.map(block => [block.id, block.text, block.mathSource, block.translatable])))
    const saved = savedPages.get(pageNumber)
    const reusable = saved?.sourceKey === sourceKey
      && selected.filter(block => block.translatable).every(block => typeof saved.value[block.id] === 'string' && saved.value[block.id].trim())
    const translations = new Map<string, string>(reusable ? Object.entries(saved!.value) : [])
    let status: PdfTranslationStatus = { total: 0, completed: 0, failed: 0, running: false }
    if (!reusable) {
      let firstTranslationError: unknown
      const coordinator = new PdfTranslationCoordinator({
        translate: async (source, context, translateOptions) => {
          try {
            return await exportTranslate(source, context, translateOptions)
          } catch (error) {
            if (error instanceof ExportRateLimitError || error instanceof ExportSettingsChangedError) firstTranslationError = error
            else firstTranslationError ??= error
            throw error
          }
        },
        onTranslation: (id, translation) => translations.set(id, translation),
        onStatus: next => { status = next },
      })
      const cancel = () => coordinator.cancel()
      options.signal?.addEventListener('abort', cancel, { once: true })
      try {
        await coordinator.start(selected, `${options.title} · ${pageNumber}`, options.sourceUrl)
        ensureActive(options.signal)
        if (status.failed || status.completed !== status.total) {
          if (firstTranslationError instanceof ExportRateLimitError) throw new BilingualPdfExportError('RATE_LIMITED', firstTranslationError)
          if (firstTranslationError instanceof ExportSettingsChangedError) throw new BilingualPdfExportError('SETTINGS_CHANGED', firstTranslationError)
          throw new BilingualPdfExportError('INCOMPLETE', firstTranslationError)
        }
      } finally {
        options.signal?.removeEventListener('abort', cancel)
      }
      if (checkpoint) {
        await checkpoint.repository.saveExportSegment(checkpoint.bookId, 'pdf', checkpoint.fingerprint, pageNumber - 1, sourceKey, Object.fromEntries(translations))
      }
    }
    translatedCount += translations.size
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
