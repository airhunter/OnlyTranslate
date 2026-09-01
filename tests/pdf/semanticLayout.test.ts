import { describe, expect, it } from 'vitest'
import type { PdfTextSpan } from '@/entrypoints/pdf/layout'
import { buildSemanticPdfBlocks, type PdfLayoutRegion } from '@/entrypoints/pdf/semanticLayout'

function span(text: string, x: number, y: number, width = 190, height = 11): PdfTextSpan {
  return { text, x, y, width, height }
}

function positionedSpan(
  text: string,
  x: number,
  baseline: number,
  width: number,
  height: number,
  fontName: string,
): PdfTextSpan {
  return { text, x, y: baseline - height, width, height, baseline, fontName }
}

function region(label: string, x: number, y: number, width: number, height: number, score = 0.9): PdfLayoutRegion {
  return { classId: 0, label, score, coordinate: [x, y, x + width, y + height] }
}

describe('PDF semantic layout fusion', () => {
  it('keeps a single-column novel in top-to-bottom paragraph order', () => {
    const blocks = buildSemanticPdfBlocks([
      span('Chapter 1', 250, 70, 90, 20),
      span('It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want', 70, 120, 470),
      span('of a wife.', 55, 134, 55),
      span('However little known the feelings or views of such a man may be on his first entering a neighbourhood,', 70, 158, 470),
      span('this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property', 55, 172, 485),
      span('of some one or other of their daughters.', 55, 186, 205),
      span('"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"', 70, 215, 470),
      span('Mr. Bennet replied that he had not.', 70, 244, 210),
      span('"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."', 70, 273, 430),
      span('Mr. Bennet made no answer.', 70, 302, 180),
      span('"Bingley."', 70, 331, 58),
    ], [
      region('paragraph_title', 235, 58, 125, 38),
      region('paragraph_title', 55, 110, 490, 16),
      region('text', 55, 128, 490, 64),
      region('text', 55, 207, 490, 145),
    ], 595, 842)

    expect(blocks.map(block => block.text)).toEqual([
      'Chapter 1',
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
      '"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"',
      'Mr. Bennet replied that he had not.',
      '"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."',
      'Mr. Bennet made no answer.',
      '"Bingley."',
    ])
    expect(blocks.slice(1).map(block => ({ kind: block.kind, translatable: block.translatable }))).toEqual([
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
      { kind: 'body', translatable: true },
    ])
    expect(blocks.slice(1).every(block => block.column === 'full')).toBe(true)
  })

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

  it('keeps inline notation in prose while preserving a standalone display formula', () => {
    const blocks = buildSemanticPdfBlocks([
      span('For the notations, a subscript distinguishes the previous and current sentences.', 70, 120, 215),
      span('gH + (1 - g)Hcur', 370, 210, 95, 12),
      span('The explanation continues after the displayed equation.', 320, 242, 215),
    ], [
      region('text', 65, 112, 225, 25),
      region('formula', 190, 116, 35, 16, 0.78),
      region('formula', 360, 200, 125, 28, 0.94),
      region('text', 315, 234, 225, 25),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(1)
    expect(blocks.find(block => block.kind === 'visual')).toMatchObject({
      visualKind: 'formula',
      x: 360,
      y: 200,
    })
    expect(blocks.some(block => block.text.includes('For the notations'))).toBe(true)
  })

  it('removes an inline formula crop when prose continues on the same baseline', () => {
    const blocks = buildSemanticPdfBlocks([
      positionedSpan('and', 110, 300, 18, 11, 'body'),
      positionedSpan('e', 132, 300, 5, 11, 'math'),
      positionedSpan('i', 137, 301.6, 3, 8, 'script'),
      positionedSpan('are already predicted tokens.', 145, 300, 125, 11, 'body'),
    ], [
      region('text', 105, 288, 24, 24),
      region('formula', 130, 288, 14, 24, 0.91),
      region('text', 145, 288, 130, 24),
    ], 595, 842, 'page-2')

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(0)
    expect(blocks.flatMap(block => block.inlineMath ?? []).map(expression => expression.latex)).toContain('e_{i}')
  })

  it('keeps a notation-heavy diagram as one visual instead of translating its labels', () => {
    const blocks = buildSemanticPdfBlocks([
      span('p(ei | ei−1, fcur, fpre)', 105, 505, 105, 9),
      span('×N', 170, 535, 18, 9),
      span('Attention', 135, 590, 46, 10),
      span('Encoder', 90, 665, 38, 10),
      span('Decoder', 180, 665, 38, 10),
      span('The paragraph after the diagram remains readable.', 70, 790, 225),
    ], [
      region('formula', 70, 480, 190, 260, 0.89),
      region('text', 65, 782, 235, 25),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(1)
    expect(blocks.find(block => block.kind === 'visual')).toMatchObject({
      visualKind: 'formula',
      x: 70,
      y: 480,
    })
    expect(blocks.some(block => block.kind !== 'visual' && /Attention|Encoder|Decoder|×N/.test(block.text))).toBe(false)
    expect(blocks.some(block => block.text.includes('paragraph after the diagram'))).toBe(true)
  })

  it('does not crop formulas separately when they are nested inside a figure', () => {
    const blocks = buildSemanticPdfBlocks([
      span('Attention', 135, 590, 46, 10),
      span('Encoder', 90, 665, 38, 10),
    ], [
      region('image', 70, 480, 190, 260, 0.86),
      region('formula', 100, 500, 115, 28, 0.94),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(1)
    expect(blocks.find(block => block.kind === 'visual')).toMatchObject({ visualKind: 'image' })
  })

  it('keeps offset math parentheses inside the nearby visual formula region', () => {
    const blocks = buildSemanticPdfBlocks([
      positionedSpan('(', 452.14, 539.84, 3.94, 8.61, 'math-delimiter'),
      positionedSpan(')', 507.59, 539.84, 3.94, 8.61, 'math-delimiter'),
      positionedSpan('p', 446.48, 546.81, 4.23, 8.61, 'math'),
      positionedSpan('e', 456.09, 546.81, 3.91, 8.61, 'math'),
      positionedSpan('f', 496.75, 546.81, 2.96, 8.61, 'math'),
    ], [
      region('formula', 444, 538, 72, 20, 0.92),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'visual')).toHaveLength(1)
    expect(blocks.some(block => block.kind !== 'visual' && block.text.replace(/\s/g, '') === '()')).toBe(false)
  })

  it('keeps ordinary parenthetical prose when it is not adjacent to a visual region', () => {
    const blocks = buildSemanticPdfBlocks([
      span('(see Appendix A)', 70, 180, 85, 11),
    ], [
      region('text', 65, 172, 100, 25),
    ], 595, 842)

    expect(blocks.some(block => block.text === '(see Appendix A)')).toBe(true)
  })

  it('does not apply inline-math reconstruction to unclassified drawing text', () => {
    const blocks = buildSemanticPdfBlocks([
      positionedSpan('e', 100, 300, 5, 11, 'math'),
      positionedSpan('i', 105, 302, 3, 8, 'script'),
      positionedSpan('Attention', 125, 300, 45, 11, 'diagram-label'),
    ], [], 595, 842, 'page-2')

    expect(blocks.some(block => block.inlineMath?.length)).toBe(false)
  })

  it('reconstructs inline scripts through the complete semantic block pipeline', () => {
    const blocks = buildSemanticPdfBlocks([
      positionedSpan('For the notations, we denote a source sentence by', 75, 198, 210, 10.9091, 'body'),
      positionedSpan('f', 289, 198, 4, 10.9091, 'math'),
      positionedSpan('and its encoded representations by', 75, 211.398, 142, 10.9091, 'body'),
      positionedSpan('H', 221, 211.398, 8, 10.9091, 'math'),
      positionedSpan('. A subscript distinguishes the previous and current sentences.', 232, 211.398, 250, 10.9091, 'body'),
      positionedSpan('(cur) sentences.', 75, 224.947, 66, 10.9091, 'body'),
      positionedSpan('e', 145.957, 224.947, 5.079, 10.9091, 'math'),
      positionedSpan('i', 151.036, 226.583, 2.883, 7.9701, 'script'),
      positionedSpan('indicates a target token, and', 158.529, 224.947, 125, 10.9091, 'body'),
      positionedSpan('predicted at position i, and', 75, 238.496, 117, 10.9091, 'body'),
      positionedSpan('e', 196.699, 238.496, 5.079, 10.9091, 'math'),
      positionedSpan('i', 201.778, 233.908, 2.884, 7.9701, 'script'),
      positionedSpan('−', 204.662, 233.908, 6.586, 7.9701, 'symbol'),
      positionedSpan('1', 211.248, 233.908, 4.235, 7.9701, 'script-number'),
      positionedSpan('1', 201.778, 241.620, 4.235, 7.9701, 'script-number'),
      positionedSpan('are already pre-', 219.747, 238.496, 70, 10.9091, 'body'),
      positionedSpan('dicted tokens in previous positions. Z denotes encoded representations.', 75, 252.045, 270, 10.9091, 'body'),
    ], [
      region('text', 65, 180, 430, 80),
    ], 595, 842, 'page-2')

    const paragraph = blocks.find(block => block.inlineMath?.length === 4)
    expect(paragraph?.inlineMath?.map(expression => expression.latex)).toEqual([
      'f',
      'H',
      'e_{i}',
      'e_{1}^{i-1}',
    ])
    expect(paragraph?.mathSource).toContain('{{pdfmath:page-2:block-1:3}}')
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
