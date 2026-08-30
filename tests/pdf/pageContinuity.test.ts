import { describe, expect, it } from 'vitest'
import type { PdfTextBlock } from '@/entrypoints/pdf/layout'
import { addCrossPageContext, isCrossPageParagraph } from '@/entrypoints/pdf/pageContinuity'

function body(id: string, text: string): PdfTextBlock {
  return {
    id,
    text,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    column: 'left',
    kind: 'body',
    translatable: true,
  }
}

function rightBody(id: string, text: string): PdfTextBlock {
  return { ...body(id, text), column: 'right' }
}

function caption(id: string, text: string): PdfTextBlock {
  return { ...rightBody(id, text), kind: 'caption' }
}

describe('PDF page continuity', () => {
  it('completes a paragraph that continues onto the next page', () => {
    const current = [body('current', 'Although recent')]
    const next = [body('next', 'advances in LLM research indicate rapid progress.')]

    const [enriched] = addCrossPageContext(current, undefined, next)

    expect(enriched).toMatchObject({
      text: 'Although recent',
      translationSource: 'Although recent advances in LLM research indicate rapid progress.',
      continuesToNextPage: true,
    })
  })

  it('prepends the previous-page fragment when opening the continuation page directly', () => {
    const previous = [body('previous', 'Although recent')]
    const current = [body('current', 'advances in LLM research indicate rapid progress.')]

    const [enriched] = addCrossPageContext(current, previous)

    expect(enriched.translationSource).toBe('Although recent advances in LLM research indicate rapid progress.')
    expect(enriched.continuesFromPreviousPage).toBe(true)
  })

  it('does not merge pages when the previous paragraph is complete', () => {
    const previous = body('previous', 'The first page ends with a complete sentence.')
    const current = body('current', 'A new paragraph starts here.')

    expect(isCrossPageParagraph(previous, current)).toBe(false)
    expect(addCrossPageContext([current], [previous])[0].translationSource).toBeUndefined()
  })

  it('joins a word split by a page-ending soft hyphen', () => {
    const current = [body('current', 'The model is demon-')]
    const next = [body('next', 'strated on several datasets.')]

    expect(addCrossPageContext(current, undefined, next)[0].translationSource)
      .toBe('The model is demonstrated on several datasets.')
  })

  it('combines a paragraph split between academic columns into one reading-flow unit', () => {
    const blocks = addCrossPageContext([
      body('left-end', 'Automatic evaluation improves COMET'),
      rightBody('right-start', 'and BLEURT. Further analysis confirms the result.'),
    ])

    expect(blocks[0]).toMatchObject({
      translationSource: 'Automatic evaluation improves COMET and BLEURT. Further analysis confirms the result.',
      continuesToNextColumn: true,
    })
    expect(blocks[1]).toMatchObject({
      hiddenInReadingFlow: true,
      readingFlowOwnerId: 'left-end',
    })
  })

  it('keeps independent paragraphs on opposite columns separate', () => {
    const blocks = addCrossPageContext([
      body('left-end', 'The left paragraph is complete.'),
      rightBody('right-start', 'A new paragraph starts in the right column.'),
    ])

    expect(blocks[0].translationSource).toBeUndefined()
    expect(blocks[1].hiddenInReadingFlow).toBeUndefined()
  })

  it('does not join a short footnote-like fragment to a chart label across columns', () => {
    const blocks = addCrossPageContext([
      body('left-end', 'LiteraryTranslation'),
      rightBody('right-start', 'cs-pl'),
    ])

    expect(blocks[0].translationSource).toBeUndefined()
    expect(blocks[1].hiddenInReadingFlow).toBeUndefined()
  })

  it('does not join column fragments whose font sizes are incompatible', () => {
    const before = { ...body('left-end', 'The evaluation improves several important metrics'), fontHeight: 10 }
    const after = { ...rightBody('right-start', 'and BLEURT across all directions.'), fontHeight: 5 }
    const blocks = addCrossPageContext([before, after])

    expect(blocks[0].translationSource).toBeUndefined()
    expect(blocks[1].hiddenInReadingFlow).toBeUndefined()
  })

  it('joins body text across a figure caption that interrupts the visual column flow', () => {
    const blocks = addCrossPageContext([
      body('left-end', 'The method is evaluated on several benchmarks;'),
      caption('figure-caption', 'Figure 1: Evaluation results.'),
      rightBody('right-start', 'Pawlak, 2023), followed by a detailed human analysis.'),
    ])

    expect(blocks[0]).toMatchObject({
      translationSource: 'The method is evaluated on several benchmarks; Pawlak, 2023), followed by a detailed human analysis.',
      continuesToNextColumn: true,
    })
    expect(blocks[1].hiddenInReadingFlow).toBeUndefined()
    expect(blocks[2]).toMatchObject({ hiddenInReadingFlow: true, readingFlowOwnerId: 'left-end' })
  })
})
