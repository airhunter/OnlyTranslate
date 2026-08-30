import { describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  isTranslationCancelledError: vi.fn(() => false),
  translateText: vi.fn(),
}))

vi.mock('@/entrypoints/utils/translationDiagnostics', () => ({
  createTranslationDiagnosticId: vi.fn(() => 'pdf-session'),
}))

import type { PdfTextBlock } from '@/entrypoints/pdf/layout'
import { PdfTranslationCoordinator } from '@/entrypoints/pdf/translationCoordinator'

function block(id: string, text: string, translatable = true): PdfTextBlock {
  return {
    id,
    text,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    column: 'left',
    kind: translatable ? 'body' : 'formula',
    translatable,
  }
}

describe('PdfTranslationCoordinator', () => {
  it('translates readable blocks with shared high-priority batching and skips formulas', async () => {
    const translate = vi.fn(async (text: string) => `译文：${text}`)
    const onTranslation = vi.fn()
    const onStatus = vi.fn()
    const coordinator = new PdfTranslationCoordinator({ translate, onTranslation, onStatus })

    await coordinator.start([
      block('body-1', 'Readable paragraph'),
      block('formula-1', 'x = y + 1', false),
    ], 'Paper · page 1', 'https://example.com/paper.pdf')

    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenCalledWith('Readable paragraph', 'Paper · page 1', expect.objectContaining({
      allowBatch: true,
      priority: 'high',
      diagnostics: expect.objectContaining({
        scene: 'pdf',
        pageUrl: 'https://example.com/paper.pdf',
      }),
    }))
    expect(onTranslation).toHaveBeenCalledWith('body-1', '译文：Readable paragraph')
    expect(onStatus).toHaveBeenLastCalledWith({ total: 1, completed: 1, failed: 0, running: false })
  })

  it('does not publish a stale translation after cancellation', async () => {
    let resolveTranslation!: (translation: string) => void
    const translate = vi.fn(() => new Promise<string>(resolve => {
      resolveTranslation = resolve
    }))
    const onTranslation = vi.fn()
    const coordinator = new PdfTranslationCoordinator({ translate, onTranslation })

    const pending = coordinator.start([block('body-1', 'Old page')], 'page 1')
    coordinator.cancel()
    resolveTranslation('旧页译文')
    await pending

    expect(onTranslation).not.toHaveBeenCalled()
  })

  it('protects academic acronyms and normalizes an ambiguous Chinese section heading', async () => {
    const translate = vi.fn(async (text: string) => {
      if (text === 'Abstract') return '抽象的'
      return text.replace('These {{PDFTERM0}} use the {{PDFTERM1}} framework.', '这些 {{PDFTERM0}} 使用 {{PDFTERM1}} 框架。')
    })
    const onTranslation = vi.fn()
    const coordinator = new PdfTranslationCoordinator({ translate, onTranslation })

    await coordinator.start([
      { ...block('heading', 'Abstract'), kind: 'heading' },
      block('body', 'These LLMs use the MAPS framework.'),
    ], 'paper · page 1')

    expect(translate).toHaveBeenCalledWith(
      'These {{PDFTERM0}} use the {{PDFTERM1}} framework.',
      'paper · page 1',
      expect.any(Object),
    )
    expect(onTranslation).toHaveBeenCalledWith('heading', '摘要')
    expect(onTranslation).toHaveBeenCalledWith('body', '这些 LLMs 使用 MAPS 框架。')
  })

  it('translates the completed cross-page source instead of the visible fragment', async () => {
    const translate = vi.fn(async () => '尽管最近大语言模型研究进展迅速。')
    const onTranslation = vi.fn()
    const coordinator = new PdfTranslationCoordinator({ translate, onTranslation })

    await coordinator.start([{
      ...block('body', 'Although recent'),
      translationSource: 'Although recent advances in LLM research are rapid.',
    }], 'paper · page 1')

    expect(translate).toHaveBeenCalledWith(
      'Although recent advances in {{PDFTERM0}} research are rapid.',
      'paper · page 1',
      expect.any(Object),
    )
    expect(onTranslation).toHaveBeenCalledWith('body', '尽管最近大语言模型研究进展迅速。')
  })
})
