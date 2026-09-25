import { describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  isTranslationCancelledError: vi.fn(() => false),
  translateText: vi.fn(),
}))
vi.mock('@/entrypoints/utils/config', () => ({
  config: { service: 'microsoft', from: 'auto', to: 'zh', style: 0, model: {}, customModel: {}, customProviders: [] },
}))

vi.mock('@/entrypoints/utils/translationDirection', () => ({
  resolveTranslationDirection: vi.fn(() => ({
    sourceLang: 'en',
    targetLang: 'zh-Hans',
    shouldTranslate: true,
  })),
}))
import { collectBilingualPdfPages } from '../../entrypoints/pdf/translatedExport'
import { config } from '../../entrypoints/utils/config'
import { EbookRepository } from '../../entrypoints/ebook/repository'
import { createExportFingerprint } from '../../entrypoints/ebook/exportTranslation'
import { IDBFactory } from 'fake-indexeddb'
import type { PdfRenderedPage, PdfReaderController } from '../../entrypoints/pdf/readerController'

function fakeReader(text = 'Reading a document in another language should preserve its meaning.') {
  const extractPage = vi.fn(async (number: number): Promise<PdfRenderedPage> => ({
    pageNumber: number,
    pageCount: 2,
    width: 600,
    height: 800,
    layoutMode: 'heuristic',
    blocks: [{
      id: `page-${number}-body`,
      text,
      x: 20,
      y: 20,
      width: 500,
      height: 30,
      column: 'full',
      kind: 'body',
      translatable: Boolean(text),
    }],
  }))
  const renderThumbnail = vi.fn(async (number: number) => `data:image/jpeg;base64,page${number}`)
  return { pageCount: 2, extractPage, renderThumbnail } as unknown as Pick<PdfReaderController, 'pageCount' | 'extractPage' | 'renderThumbnail'>
}

describe('bilingual PDF export', () => {
  it('collects original page images and translated text for the entire document', async () => {
    const reader = fakeReader()
    const onProgress = vi.fn()
    const pages = await collectBilingualPdfPages(reader, {
      title: 'Research note',
      translate: async () => '阅读外语文档时应保留原意。',
      onProgress,
    })
    expect(pages).toHaveLength(2)
    expect(pages[0].originalImage).toContain('page1')
    expect(pages[1].blocks[0]).toMatchObject({
      original: 'Reading a document in another language should preserve its meaning.',
      translation: '阅读外语文档时应保留原意。',
    })
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 2, total: 2 })
  })

  it('does not return an incomplete export when a page translation fails', async () => {
    await expect(collectBilingualPdfPages(fakeReader(), {
      title: 'Research note',
      translate: async () => { throw new Error('service unavailable') },
    })).rejects.toMatchObject({ code: 'INCOMPLETE' })
  })

  it('reports Google 429 without continuing to later PDF pages', async () => {
    const previous = config.service
    config.service = 'google'
    try {
      const reader = fakeReader()
      const translate = vi.fn(async () => { throw new Error('translation failed: 429') })
      await expect(collectBilingualPdfPages(reader, { title: 'Research note', translate }))
        .rejects.toMatchObject({ code: 'RATE_LIMITED' })
      expect(translate).toHaveBeenCalledOnce()
      expect(reader.extractPage).toHaveBeenCalledOnce()
    } finally {
      config.service = previous
    }
  })

  it('does not label a scanned document with no extractable text as translated', async () => {
    await expect(collectBilingualPdfPages(fakeReader(''), {
      title: 'Scanned document',
      translate: vi.fn(),
    })).rejects.toMatchObject({ code: 'NO_TEXT' })
  })

  it('does not start when cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const reader = fakeReader()
    await expect(collectBilingualPdfPages(reader, {
      title: 'Research note',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(reader.extractPage).not.toHaveBeenCalled()
  })

  it('does not return partially translated pages when cancelled after a page', async () => {
    const controller = new AbortController()
    await expect(collectBilingualPdfPages(fakeReader(), {
      title: 'Research note',
      signal: controller.signal,
      translate: async () => '完整译文',
      onProgress: progress => {
        if (progress.completed === 1) controller.abort()
      },
    })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('resumes saved PDF page translations after cancellation', async () => {
    const indexedDb = new IDBFactory()
    const repository = new EbookRepository(indexedDb)
    const book = (await repository.importBook(new File(['%PDF-1.7\nfixture'], 'fixture.pdf'), async () => ({
      title: 'Research note', author: '',
    }))).book
    const checkpoint = { repository, bookId: book.bookId, fingerprint: await createExportFingerprint('pdf') }
    const controller = new AbortController()
    await expect(collectBilingualPdfPages(fakeReader(), {
      title: book.title,
      checkpoint,
      signal: controller.signal,
      translate: async () => '第一轮译文',
      onProgress: progress => { if (progress.completed === 1) controller.abort() },
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(await repository.getExportCheckpoint(book.bookId, 'pdf')).toMatchObject({ completed: 1, total: 2 })

    const reopened = new EbookRepository(indexedDb)
    const translate = vi.fn(async () => '第二轮译文')
    const pages = await collectBilingualPdfPages(fakeReader(), {
      title: book.title,
      checkpoint: { ...checkpoint, repository: reopened },
      translate,
    })
    expect(pages[0].blocks[0].translation).toBe('第一轮译文')
    expect(pages[1].blocks[0].translation).toBe('第二轮译文')
    expect(translate).toHaveBeenCalledOnce()
    repository.close()
    reopened.close()
  })

  it('retranslates a saved PDF page when its extracted text changes', async () => {
    const indexedDb = new IDBFactory()
    const repository = new EbookRepository(indexedDb)
    const book = (await repository.importBook(new File(['%PDF-1.7\nfixture'], 'fixture.pdf'), async () => ({
      title: 'Research note', author: '',
    }))).book
    const fingerprint = await createExportFingerprint('pdf')
    await repository.startExportCheckpoint(book.bookId, 'pdf', fingerprint, 2)
    await repository.saveExportSegment(book.bookId, 'pdf', fingerprint, 0, 'outdated-source', { 'page-1-body': '旧译文' })
    const translate = vi.fn(async () => '新译文')
    const pages = await collectBilingualPdfPages(fakeReader(), {
      title: book.title,
      checkpoint: { repository, bookId: book.bookId, fingerprint },
      translate,
    })
    expect(pages[0].blocks[0].translation).toBe('新译文')
    expect(translate).toHaveBeenCalledTimes(2)
    repository.close()
  })
})
