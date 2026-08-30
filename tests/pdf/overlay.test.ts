import { describe, expect, it } from 'vitest'
import type { PdfBlockKind, PdfTextBlock } from '@/entrypoints/pdf/layout'
import { selectPdfTranslationBlocks, selectPdfTranslationBlocksWithOptions } from '@/entrypoints/pdf/overlay'

function block(id: string, text: string, kind: PdfBlockKind = 'body', translatable = true): PdfTextBlock {
  return {
    id,
    text,
    x: 0,
    y: 0,
    width: 200,
    height: 40,
    column: 'left',
    kind,
    translatable,
    fontHeight: 10,
  }
}

describe('PDF layout overlay selection', () => {
  it('selects complete prose, headings, and captions', () => {
    const selected = selectPdfTranslationBlocks([
      block('heading', '3 Results', 'heading'),
      block('body', 'The complete paragraph contains enough meaningful prose for a reliable translation.'),
      block('caption', 'Figure 2: Translation quality across language pairs.', 'caption'),
    ])

    expect(selected.map(item => item.id)).toEqual(['heading', 'body', 'caption'])
  })

  it('selects semantic abstracts and complete list items', () => {
    const selected = selectPdfTranslationBlocks([
      block('abstract', 'This abstract contains a complete explanation of the method and ends with a reliable conclusion.', 'abstract'),
      block('list', '• How much modeling capacity is required for these improvements?', 'list-item'),
    ])

    expect(selected.map(item => item.id)).toEqual(['abstract', 'list'])
  })

  it('translates semantic prose fragments while keeping references and visuals local', () => {
    const sourceFragment = block(
      'fragment',
      'Large language models are increasingly deployed for document-level translation (Book Maker, 2023;',
    )
    const continuation = block(
      'continuation',
      'Pawlak, 2023), a scenario for which there are currently no reliable automatic evaluation methods.',
    )
    const reference = {
      ...block('reference', 'Author. 2023. A cited research article title in conference proceedings.'),
      regionLabel: 'reference_content',
    }
    const visual = block('visual', 'chart', 'visual', false)

    expect(selectPdfTranslationBlocksWithOptions(
      [sourceFragment, visual, continuation, reference],
      { semanticLayout: true },
    ).map(item => item.id)).toEqual(['fragment', 'continuation'])
  })

  it('rejects table content, footnotes, formulas, and incomplete fragments', () => {
    const selected = selectPdfTranslationBlocks([
      block('table', 'LANGUAGE FAMILY', 'table-text', false),
      block('footnote', '1A compact author note.', 'footnote'),
      block('formula', 'x = y + 1', 'formula', false),
      block('tiny', 'ARA'),
      block('leading', 'tions over the alternative systems.'),
      block('citation-leading', 'Pawlak, 2023), a scenario without a reliable automatic evaluation method.'),
      block('trailing', 'The paragraph is cut before the next column'),
      block('mixed', 'The source says これは重要です and then repeats a long English explanation.'),
      block('caption-fragment', 'Table 3: Examples with English glosses', 'caption'),
    ])

    expect(selected).toEqual([])
  })

  it('keeps only complete long prose on a dense data page', () => {
    const fragments = Array.from({ length: 38 }, (_, index) => block(`cell-${index}`, `${index}`))
    const complete = block(
      'complete',
      'This complete analytical paragraph is intentionally long enough to remain useful on a dense page. '
      + 'It explains the evaluation setup, summarizes the observed differences, and ends with a reliable conclusion. '
      + 'The surrounding table cells remain in the original PDF without being translated.',
    )
    const shortParagraph = block('short', 'This otherwise complete paragraph is too short for a dense data page.')

    expect(selectPdfTranslationBlocks([...fragments, complete, shortParagraph]).map(item => item.id))
      .toEqual(['complete'])
  })

  it('leaves bibliography-heavy pages in their original form', () => {
    const references = Array.from({ length: 8 }, (_, index) => block(
      `reference-${index}`,
      `Author ${index}. 202${index % 4}. A cited research article title. Proceedings of a scholarly conference.`,
    ))

    expect(selectPdfTranslationBlocks(references)).toEqual([])
  })

  it('rejects body-sized fragments that were misclassified as headings', () => {
    const selected = selectPdfTranslationBlocks([
      { ...block('title', 'A Reliable Document Translation Study', 'heading'), column: 'full', fontHeight: 18 },
      block('fragment', 'corresponding translations are shown below.', 'heading'),
      block('section', '7 Conclusion', 'heading'),
      block('body', 'The complete paragraph provides the body-font baseline and ends normally.'),
    ])

    expect(selected.map(item => item.id)).toEqual(['title', 'section', 'body'])
  })
})
