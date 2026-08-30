import { describe, expect, it } from 'vitest'
import { buildPdfTextBlocks, type PdfTextSpan } from '@/entrypoints/pdf/layout'

function span(text: string, x: number, y: number, width = 180, height = 10): PdfTextSpan {
  return { text, x, y, width, height }
}

describe('PDF text layout', () => {
  it('reads a two-column academic page down the left column before the right column', () => {
    const blocks = buildPdfTextBlocks([
      span('A document-level translation study', 60, 30, 480, 18),
      span('Left paragraph starts here and introduces the research.', 50, 100),
      span('It continues on the next line without changing columns.', 50, 112),
      span('The final left line completes the paragraph.', 50, 124),
      span('Right paragraph starts after the left column.', 330, 100),
      span('It preserves the intended academic reading order.', 330, 112),
      span('The final right line completes the discussion.', 330, 124),
      span('419', 285, 770, 20, 9),
    ], 600, 800)

    expect(blocks.map(block => block.column)).toEqual(['full', 'left', 'right'])
    expect(blocks[1].text).toContain('Left paragraph starts')
    expect(blocks[1].text).toContain('final left line')
    expect(blocks[2].text).toContain('Right paragraph starts')
    expect(blocks.some(block => block.text === '419')).toBe(false)
  })

  it('protects symbol-heavy formulas while keeping captions translatable', () => {
    const blocks = buildPdfTextBlocks([
      span('x = ∑ αᵢ × yᵢ ≥ 0', 80, 120, 220, 12),
      span('Figure 2: Translation quality across', 80, 170, 360, 10),
      span('language pairs.', 80, 182, 180, 10),
    ], 600, 800)

    expect(blocks[0]).toMatchObject({ kind: 'formula', translatable: false })
    expect(blocks[1]).toMatchObject({
      kind: 'caption',
      text: 'Figure 2: Translation quality across language pairs.',
      translatable: true,
    })
  })

  it('separates near-aligned academic columns before rebuilding paragraphs', () => {
    const blocks = buildPdfTextBlocks([
      span('A Human-Like Translation Strategy', 155, 60, 285, 15),
      span('author@example.edu', 220, 180, 155, 10),
      span('Abstract', 155, 237, 50, 12),
      span('1 Introduction', 307, 237, 85, 12),
      span('Large language models have demon-', 89, 271, 184, 10),
      span('demonstrated remarkable capabilities', 307, 272, 218, 11),
      span('strated impressive capabilities in general.', 89, 283, 184, 10),
      span('across a wide range of tasks.', 307, 286, 218, 11),
    ], 595, 842)

    const leftBody = blocks.find(block => block.column === 'left' && block.kind === 'body')
    const rightBody = blocks.find(block => block.column === 'right' && block.kind === 'body')
    const metadata = blocks.find(block => block.kind === 'metadata')

    expect(leftBody?.text).toBe('Large language models have demonstrated impressive capabilities in general.')
    expect(rightBody?.text).toBe('demonstrated remarkable capabilities across a wide range of tasks.')
    expect(leftBody?.text).not.toContain('remarkable')
    expect(rightBody?.text).not.toContain('impressive')
    expect(metadata).toMatchObject({ text: 'author@example.edu', translatable: false })
    expect(blocks.filter(block => block.kind === 'heading').map(block => block.text)).toEqual([
      'A Human-Like Translation Strategy',
      'Abstract',
      '1 Introduction',
    ])
  })

  it('separates narrow-gutter columns even when their baselines nearly align', () => {
    const blocks = buildPdfTextBlocks([
      span('Left-column sentence continues here.', 70, 650, 220, 10.9),
      span('Right-column paragraph starts separately.', 306, 653, 219, 10.9),
      span('The left column has another line.', 70, 664, 220, 10.9),
      span('The right column also continues.', 306, 667, 219, 10.9),
      span('Left column closes normally.', 70, 678, 220, 10.9),
      span('Right column closes normally.', 306, 681, 219, 10.9),
    ], 595, 842)

    const left = blocks.find(block => block.column === 'left')
    const right = blocks.find(block => block.column === 'right')

    expect(left?.text).toContain('Left-column sentence')
    expect(left?.text).not.toContain('Right-column paragraph')
    expect(right?.text).toContain('Right-column paragraph')
    expect(right?.text).not.toContain('Left-column sentence')
  })

  it('keeps a small lower-page footnote after both body columns', () => {
    const blocks = buildPdfTextBlocks([
      span('Abstract', 90, 100, 70, 12),
      span('Left column body.', 90, 130, 180, 11),
      span('A relevant author note.', 72, 690, 210, 8),
      span('1 Introduction', 320, 100, 100, 12),
      span('Right column body.', 320, 130, 190, 11),
      span('Publisher footer', 210, 760, 180, 7),
    ], 600, 800)

    const footnoteIndex = blocks.findIndex(block => block.kind === 'footnote')
    const bodyIndexes = blocks
      .map((block, index) => block.kind === 'body' ? index : -1)
      .filter(index => index >= 0)
    const footerIndex = blocks.findIndex(block => block.kind === 'metadata')

    expect(footnoteIndex).toBeGreaterThan(Math.max(...bodyIndexes))
    expect(footerIndex).toBeGreaterThan(footnoteIndex)
  })

  it('keeps chart axis labels out of the reading flow while preserving its caption', () => {
    const blocks = buildPdfTextBlocks([
      span('Abstract', 90, 100, 70, 12),
      span('A complete abstract paragraph with enough prose to establish the body style.', 90, 125, 190, 10),
      span('It continues on another regularly aligned line.', 90, 137, 190, 10),
      span('cs-pl', 406, 230, 13, 5.1),
      span('de-pl', 434, 240, 13, 5.1),
      span('en-pl', 458, 254, 13, 5.1),
      span('fr-pl', 475, 273, 12, 5.1),
      span('ja-pl', 482, 298, 12, 5.1),
      span('ru-pl', 483, 323, 13, 5.1),
      span('Figure 1: Errors across language pairs.', 306, 412, 218, 10),
      span('The right-column prose resumes below the figure.', 306, 507, 218, 11),
      span('It remains a normal translatable paragraph.', 306, 520, 218, 11),
    ], 595, 842)

    const figureLabels = blocks.filter(block => block.kind === 'figure-text')
    const caption = blocks.find(block => block.kind === 'caption')

    expect(figureLabels).toHaveLength(6)
    expect(figureLabels.every(block => !block.translatable)).toBe(true)
    expect(caption).toMatchObject({
      text: 'Figure 1: Errors across language pairs.',
      translatable: true,
    })
    expect(blocks.some(block => block.kind === 'body' && block.text.includes('right-column prose'))).toBe(true)
  })

  it('recognizes small bottom-of-column URL continuations as footnotes', () => {
    const blocks = buildPdfTextBlocks([
      span('1 Introduction', 70, 615, 90, 12),
      span('The body continues near the bottom of the left column.', 70, 690, 220, 10.9),
      span('https://github.com/example/', 90, 752, 135, 9),
      span('LiteraryTranslation', 70, 762, 86, 9),
      span('Right-column body.', 306, 615, 218, 10.9),
    ], 595, 842)

    expect(blocks.find(block => block.text.includes('LiteraryTranslation'))).toMatchObject({
      kind: 'footnote',
      translatable: true,
    })
  })

  it('excludes text-rich figures above a full-width caption', () => {
    const blocks = buildPdfTextBlocks([
      span('Japanese source example', 86, 90, 190, 5.7),
      span('English sentence-level example', 350, 92, 155, 5.7),
      span('Additional source annotation', 86, 110, 190, 5.7),
      span('Additional translated annotation', 350, 112, 155, 5.7),
      span('Figure 2: A text-rich translation example.', 70, 237, 454, 10),
      span('Body text resumes after the figure caption.', 70, 295, 220, 10.9),
      span('The paragraph continues in the normal body style.', 70, 309, 220, 10.9),
      span('Right-column body starts here.', 306, 295, 219, 10.9),
      span('It also continues normally.', 306, 309, 219, 10.9),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'figure-text')).toHaveLength(4)
    expect(blocks.find(block => block.kind === 'caption')).toMatchObject({
      text: 'Figure 2: A text-rich translation example.',
      translatable: true,
    })
    expect(blocks.filter(block => block.kind === 'body')).toHaveLength(2)
    expect(blocks.findIndex(block => block.kind === 'caption'))
      .toBeLessThan(blocks.findIndex(block => block.kind === 'body'))
  })

  it('starts a new paragraph when the vertical gap is materially larger than normal leading', () => {
    const blocks = buildPdfTextBlocks([
      span('The first paragraph starts here.', 70, 300, 220, 10.9),
      span('It ends with a complete sentence.', 70, 314, 220, 10.9),
      span('Why this matters? A new paragraph starts after visible spacing.', 70, 338, 220, 10.9),
      span('It continues with normal line leading.', 70, 352, 220, 10.9),
    ], 595, 842)

    expect(blocks.filter(block => block.kind === 'body').map(block => block.text)).toEqual([
      'The first paragraph starts here. It ends with a complete sentence.',
      'Why this matters? A new paragraph starts after visible spacing. It continues with normal line leading.',
    ])
  })

  it('keeps small-cap academic acronyms on the same visual line', () => {
    const blocks = buildPdfTextBlocks([
      span('The ', 70, 300, 22, 10),
      span('P', 92, 300, 7, 10),
      span('ARA', 99, 303, 18, 6),
      span(' method improves translation quality.', 117, 300, 170, 10),
    ], 595, 842)

    expect(blocks.some(block => block.text.includes('PARA method'))).toBe(true)
    expect(blocks.some(block => block.text === 'P' || block.text === 'ARA')).toBe(false)
  })

  it('protects table cells while keeping the table caption translatable', () => {
    const blocks = buildPdfTextBlocks([
      span('The prose above the table remains readable.', 70, 110, 220, 10),
      span('It ends as a complete paragraph.', 70, 122, 220, 10),
      span('LANGUAGE', 320, 190, 65, 7),
      span('FAMILY', 420, 190, 45, 7),
      span('English', 320, 204, 42, 7),
      span('Germanic', 420, 204, 52, 7),
      span('French', 320, 218, 38, 7),
      span('Romance', 420, 218, 48, 7),
      span('Table 4: Languages included in the study.', 306, 240, 220, 10),
      span('The prose below the table starts separately.', 306, 300, 220, 10),
      span('It also ends as a complete paragraph.', 306, 312, 220, 10),
    ], 595, 842)

    const tableText = blocks.filter(block => block.kind === 'table-text')
    expect(tableText.map(block => block.text)).toEqual(expect.arrayContaining([
      'LANGUAGE',
      'FAMILY',
      'English',
      'Germanic',
      'French',
      'Romance',
    ]))
    expect(tableText.every(block => !block.translatable)).toBe(true)
    expect(blocks.find(block => block.kind === 'caption')).toMatchObject({
      text: 'Table 4: Languages included in the study.',
      translatable: true,
    })
  })
})
