import { describe, expect, it } from 'vitest'
import type { PdfTextSpan } from '@/entrypoints/pdf/layout'
import { buildSemanticPdfBlocks, type PdfLayoutRegion } from '@/entrypoints/pdf/semanticLayout'

function span(text: string, x: number, y: number, width = 190, height = 11): PdfTextSpan {
  return { text, x, y, width, height }
}

function region(label: string, x: number, y: number, width: number, height: number, score = 0.9): PdfLayoutRegion {
  return { classId: 0, label, score, coordinate: [x, y, x + width, y + height] }
}

describe('PDF semantic layout fusion', () => {
  it('keeps simultaneous left and right baselines in column reading order', () => {
    const blocks = buildSemanticPdfBlocks([
      span('A Reliable Document Translation Study', 160, 35, 280, 22),
      span('Abstract', 70, 120, 60, 13),
      span('The abstract starts in the left column and explains the complete method.', 70, 145, 210),
      span('It ends with a reliable conclusion.', 70, 159, 210),
      span('The right column starts at exactly the same baseline.', 320, 145, 210),
      span('It must be read only after the left column.', 320, 159, 210),
    ], [
      region('doc_title', 140, 25, 320, 40),
      region('paragraph_title', 65, 112, 100, 22),
      region('abstract', 65, 137, 225, 42),
      region('text', 315, 137, 225, 42),
    ], 595, 842)

    expect(blocks.map(block => block.text)).toEqual([
      'A Reliable Document Translation Study',
      'Abstract',
      'The abstract starts in the left column and explains the complete method. It ends with a reliable conclusion.',
      'The right column starts at exactly the same baseline. It must be read only after the left column.',
    ])
    expect(blocks[2]).toMatchObject({ kind: 'abstract', column: 'left', translatable: true })
    expect(blocks[3]).toMatchObject({ kind: 'body', column: 'right', translatable: true })
  })

  it('preserves a chart as one visual block and keeps chart labels out of prose', () => {
    const blocks = buildSemanticPdfBlocks([
      span('SENT', 350, 125, 30, 7),
      span('PARA', 420, 125, 30, 7),
      span('de-ja', 385, 155, 24, 7),
      span('Figure 1: Translation errors across language pairs.', 320, 260, 215, 10),
      span('The prose below the figure remains a complete readable paragraph.', 320, 310, 215),
    ], [
      region('chart', 315, 90, 225, 150, 0.91),
      region('image', 318, 92, 220, 146, 0.75),
      region('figure_title', 315, 252, 225, 28),
      region('text', 315, 302, 225, 28),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(1)
    expect(blocks.find(block => block.kind === 'visual')).toMatchObject({ visualKind: 'chart', translatable: false })
    expect(blocks.some(block => block.text.includes('SENT') || block.text.includes('de-ja'))).toBe(false)
    expect(blocks.find(block => block.kind === 'caption')).toMatchObject({
      text: 'Figure 1: Translation errors across language pairs.',
      translatable: true,
    })
  })

  it('moves lower-page footnotes after both body columns', () => {
    const blocks = buildSemanticPdfBlocks([
      span('Left-column body ends with a complete sentence.', 70, 180, 210),
      span('Right-column body is read after the left column.', 320, 180, 210),
      span('1 Footnote text remains available at the end.', 70, 735, 210, 8),
    ], [
      region('text', 65, 172, 225, 25),
      region('text', 315, 172, 225, 25),
      region('footnote', 65, 725, 225, 35),
    ], 595, 842)

    expect(blocks.map(block => block.kind)).toEqual(['body', 'body', 'footnote'])
    expect(blocks.at(-1)).toMatchObject({ translatable: false })
  })
})
