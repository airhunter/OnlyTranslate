export interface PdfTextSpan {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName?: string
}

export type PdfBlockKind =
  | 'heading'
  | 'body'
  | 'abstract'
  | 'list-item'
  | 'caption'
  | 'footnote'
  | 'formula'
  | 'visual'
  | 'figure-text'
  | 'table-text'
  | 'metadata'

export interface PdfTextBlock {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  column: 'full' | 'left' | 'right'
  kind: PdfBlockKind
  translatable: boolean
  fontHeight?: number
  regionLabel?: string
  visualKind?: 'image' | 'chart' | 'table' | 'formula' | 'algorithm'
  imageUrl?: string
  hiddenInReadingFlow?: boolean
}

interface PdfTextLine extends Omit<PdfTextBlock, 'id' | 'kind' | 'translatable' | 'fontHeight'> {
  fontHeight: number
  kindHint?: PdfBlockKind
}

const PURE_PAGE_NUMBER = /^[-–—]?\s*\d{1,4}\s*[-–—]?$/
const FORMULA_SYMBOLS = /[=<>±×÷∑∏∫√∞≈≠≤≥∂∆∇∈∉∪∩⊂⊃→←↔α-ωΑ-Ω]/gu
const SECTION_HEADING = /^(?:\d+(?:\.\d+)*\s+)?(?:abstract|summary|introduction|background|related work|method(?:ology)?|experiments?|results?|discussion|conclusion|references|acknowledg(?:e)?ments?|appendix|摘要|引言|背景|方法|实验|结果|讨论|结论|参考文献)\b/iu
const NUMBERED_SECTION_HEADING = /^(?:\d+(?:\.\d+)*|[A-H])\s+[\p{Lu}\p{Lt}\d][^.!?。！？]{1,78}$/u
const CONTACT_METADATA = /(?:\b[\w.+-]+@|\}\s*@|@\s*[\w.-]+\.[a-z]{2,}\b)/iu
const CAPTION_START = /^(?:figure|fig\.|table|图|表)\s*\d+\s*[:.：]/iu
const TABLE_CAPTION_START = /^(?:table|表)\s*\d+\s*[:.：]/iu

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))]
}

function shouldInsertSpace(previous: PdfTextSpan, current: PdfTextSpan): boolean {
  const gap = current.x - (previous.x + previous.width)
  if (gap <= Math.max(1, Math.min(previous.height, current.height) * 0.12)) return false
  if (/[-‐‑]$/.test(previous.text) || /^[,.;:!?%)\]}]/.test(current.text)) return false
  return true
}

function joinSpans(spans: PdfTextSpan[]): string {
  return spans.reduce((text, span, index) => {
    if (index === 0) return span.text
    return `${text}${shouldInsertSpace(spans[index - 1], span) ? ' ' : ''}${span.text}`
  }, '').replace(/\s+/g, ' ').trim()
}

function mergeSpansIntoLines(spans: PdfTextSpan[], pageWidth: number): PdfTextLine[] {
  const groups: PdfTextSpan[][] = []
  const ordered = [...spans].sort((left, right) => left.y - right.y || left.x - right.x)

  for (const span of ordered) {
    const center = span.y + span.height / 2
    const matching = groups.find(group => {
      const representative = group[0]
      const representativeCenter = representative.y + representative.height / 2
      return Math.abs(center - representativeCenter) <= Math.max(2, Math.max(span.height, representative.height) * 0.55)
    })
    if (matching) matching.push(span)
    else groups.push([span])
  }

  return groups.flatMap(group => {
    group.sort((left, right) => left.x - right.x)
    const segments: PdfTextSpan[][] = []
    for (const item of group) {
      const segment = segments.at(-1)
      const previous = segment?.at(-1)
      const gap = previous ? item.x - (previous.x + previous.width) : 0
      // PDF text items from two columns frequently share almost the same
      // baseline. A conservative threshold keeps justified words together
      // while splitting the 20–40pt gutter used by academic papers.
      const splitThreshold = previous
        ? Math.max(pageWidth * 0.015, Math.max(previous.height, item.height) * 1.45)
        : 0
      const crossesPageMidpoint = previous
        && previous.x + previous.width <= pageWidth / 2
        && item.x >= pageWidth / 2
        && gap > pageWidth * 0.012
      if (!segment || gap > splitThreshold || crossesPageMidpoint) segments.push([item])
      else segment.push(item)
    }
    return segments.map(segment => {
      const x = Math.min(...segment.map(item => item.x))
      const y = Math.min(...segment.map(item => item.y))
      const right = Math.max(...segment.map(item => item.x + item.width))
      const bottom = Math.max(...segment.map(item => item.y + item.height))
      return {
        text: joinSpans(segment),
        x,
        y,
        width: right - x,
        height: bottom - y,
        fontHeight: median(segment.map(item => item.height)),
        column: 'full' as const,
      }
    })
  }).filter(line => line.text && !PURE_PAGE_NUMBER.test(line.text))
}

function assignColumns(lines: PdfTextLine[], pageWidth: number): PdfTextLine[] {
  const midpoint = pageWidth / 2
  const gutter = pageWidth * 0.035
  const leftCandidates = lines.filter(line => line.x + line.width <= midpoint + gutter)
  const rightCandidates = lines.filter(line => line.x >= midpoint - gutter)
  const hasTwoColumns = leftCandidates.length >= 3 && rightCandidates.length >= 3
  if (!hasTwoColumns) return lines

  return lines.map(line => {
    const crossesMidpoint = line.x < midpoint - gutter && line.x + line.width > midpoint + gutter
    const isWide = line.width >= pageWidth * 0.62
    if (crossesMidpoint || isWide) return { ...line, column: 'full' }
    if (line.x + line.width <= midpoint + gutter) return { ...line, column: 'left' }
    if (line.x >= midpoint - gutter) return { ...line, column: 'right' }
    return { ...line, column: line.x < midpoint ? 'left' : 'right' }
  })
}

function orderLines(lines: PdfTextLine[]): PdfTextLine[] {
  const decorativeKinds = new Set<PdfBlockKind>(['figure-text', 'table-text'])
  const decorative = lines.filter(line => line.kindHint && decorativeKinds.has(line.kindHint))
  const semanticLines = lines.filter(line => !line.kindHint || !decorativeKinds.has(line.kindHint))
  const columnLines = semanticLines.filter(line => line.column !== 'full')
  if (columnLines.length === 0) return [...lines].sort((left, right) => left.y - right.y || left.x - right.x)
  const columnTop = Math.min(...columnLines.map(line => line.y))
  const columnBottom = Math.max(...columnLines.map(line => line.y + line.height))
  const before = semanticLines.filter(line => line.column === 'full' && line.y + line.height <= columnTop)
  const after = semanticLines.filter(line => line.column === 'full' && line.y >= columnBottom)
  const embedded = semanticLines.filter(line => line.column === 'full' && !before.includes(line) && !after.includes(line))

  // Embedded wide lines are rare in academic PDFs. Keep them with the nearest
  // column so they do not force left/right text to interleave by y coordinate.
  const normalizedEmbedded = embedded.map(line => ({
    ...line,
    column: line.x + line.width / 2 < Math.max(...lines.map(item => item.x + item.width)) / 2
      ? 'left' as const
      : 'right' as const,
  }))
  const body = [...columnLines, ...normalizedEmbedded]
  const byPosition = (left: PdfTextLine, right: PdfTextLine) => left.y - right.y || left.x - right.x
  return [
    ...[...before, ...decorative].sort(byPosition),
    ...body.filter(line => line.column === 'left').sort(byPosition),
    ...body.filter(line => line.column === 'right').sort(byPosition),
    ...after.sort(byPosition),
  ]
}

function markFigureText(lines: PdfTextLine[], pageHeight: number): PdfTextLine[] {
  const bodyHeight = Math.max(1, percentile(lines.map(line => line.fontHeight), 0.7))
  const smallTextThreshold = bodyHeight * 0.74
  const detected = new Set<PdfTextLine>()
  const captions = lines.filter(line => CAPTION_START.test(line.text))

  for (const caption of captions) {
    if (/^(?:table|表)\b/iu.test(caption.text)) continue
    const candidates = lines.filter(line => (
      line !== caption
      && (caption.column === 'full' || line.column === caption.column)
      && line.y < caption.y
      && caption.y - (line.y + line.height) <= pageHeight * 0.36
      && line.fontHeight <= smallTextThreshold
      && line.text.length <= 120
    ))
    // A single superscript or small annotation is not enough evidence. Figure
    // labels form a spatial cluster of several atypically small text lines.
    if (candidates.length < 3) continue
    candidates.forEach(line => detected.add(line))
  }

  return lines.map(line => detected.has(line) ? { ...line, kindHint: 'figure-text' } : line)
}

function markTableText(lines: PdfTextLine[], pageHeight: number): PdfTextLine[] {
  const bodyHeight = Math.max(1, percentile(lines.map(line => line.fontHeight), 0.7))
  const detected = new Set<PdfTextLine>()
  const captions = lines.filter(line => TABLE_CAPTION_START.test(line.text))

  for (const caption of captions) {
    const candidates = lines
      .filter(line => (
        line !== caption
        && !line.kindHint
        && (caption.column === 'full' || line.column === caption.column)
        && line.y < caption.y
        && caption.y - (line.y + line.height) <= pageHeight * 0.34
        && !CAPTION_START.test(line.text)
        && (line.fontHeight <= bodyHeight * 0.9 || line.text.length <= 80)
      ))
      .sort((left, right) => right.y - left.y || left.x - right.x)

    if (candidates.length < 3) continue
    const nearestBand: PdfTextLine[] = []
    let bandTop = caption.y
    for (const line of candidates) {
      const gap = bandTop - (line.y + line.height)
      if (nearestBand.length >= 3 && gap > bodyHeight * 2.5) break
      nearestBand.push(line)
      bandTop = Math.min(bandTop, line.y)
    }
    if (nearestBand.length < 3) continue
    nearestBand.forEach(line => detected.add(line))
  }

  return lines.map(line => detected.has(line) ? { ...line, kindHint: 'table-text' } : line)
}

function isFormula(text: string): boolean {
  const meaningful = text.replace(/\s/g, '')
  if (meaningful.length < 3) return false
  const symbols = meaningful.match(FORMULA_SYMBOLS)?.length ?? 0
  const wordCharacters = meaningful.match(/[\p{L}\p{N}]/gu)?.length ?? 0
  return symbols >= 2 && symbols / meaningful.length >= 0.12 && wordCharacters / meaningful.length < 0.72
}

function classifyBlock(block: PdfTextLine, pageHeight: number, medianHeight: number): PdfBlockKind {
  if (CONTACT_METADATA.test(block.text) || block.y >= pageHeight * 0.93) return 'metadata'
  if (block.kindHint === 'figure-text') return 'figure-text'
  if (block.kindHint === 'table-text') return 'table-text'
  if (isFormula(block.text)) return 'formula'
  if (block.y >= pageHeight * 0.82 && block.fontHeight <= medianHeight * 0.94) return 'footnote'
  if (CAPTION_START.test(block.text)) return 'caption'
  if (SECTION_HEADING.test(block.text) || NUMBERED_SECTION_HEADING.test(block.text)) return 'heading'
  if (block.fontHeight >= medianHeight * 1.2 && block.text.length <= 180) return 'heading'
  return 'body'
}

function joinLineText(previous: string, next: string): string {
  if (/[-‐‑]$/.test(previous) && /^\p{Ll}/u.test(next)) return `${previous.slice(0, -1)}${next}`
  if (/[-‐‑]$/.test(previous)) return `${previous}${next}`
  return `${previous} ${next}`
}

function mergeLinesIntoBlocks(lines: PdfTextLine[], pageHeight: number): PdfTextBlock[] {
  // The median can be dominated by dozens of tiny axis/table labels. A higher
  // percentile better represents the prose font used across academic pages.
  const medianHeight = Math.max(1, percentile(lines.map(line => line.fontHeight), 0.7))
  const blocks: PdfTextBlock[] = []

  for (const line of lines) {
    const kind = classifyBlock(line, pageHeight, medianHeight)
    const previous = blocks.at(-1)
    const verticalGap = previous ? line.y - (previous.y + previous.height) : Number.POSITIVE_INFINITY
    const sameColumn = previous?.column === line.column
    const indentation = previous ? Math.abs(line.x - previous.x) : Number.POSITIVE_INFINITY
    const startsIndentedParagraph = previous
      && line.x - previous.x >= medianHeight * 0.75
      && /[.!?]["')\]]?$/u.test(previous.text)
    const canMerge = previous
      && previous.kind === 'body'
      && kind === 'body'
      && sameColumn
      && verticalGap <= medianHeight * 0.9
      && verticalGap >= -medianHeight * 0.35
      && indentation <= Math.max(18, medianHeight * 1.8)
      && !startsIndentedParagraph
    const canMergeHeading = previous
      && previous.kind === 'heading'
      && kind === 'heading'
      && sameColumn
      && verticalGap <= medianHeight
      && Math.abs((previous.x + previous.width / 2) - (line.x + line.width / 2)) <= medianHeight * 1.8
    const canMergeFootnote = previous
      && previous.kind === 'footnote'
      && kind === 'footnote'
      && sameColumn
      && verticalGap <= medianHeight * 1.35
      && indentation <= Math.max(18, medianHeight * 2.2)
      && !/^[*∗†‡]/u.test(line.text)
    const canMergeCaption = previous
      && previous.kind === 'caption'
      && (kind === 'body' || kind === 'heading')
      && verticalGap <= medianHeight * 1.5
      && !/[.!?]["')\]]?$/u.test(previous.text)

    if (canMerge || canMergeHeading || canMergeFootnote || canMergeCaption) {
      previous.text = joinLineText(previous.text, line.text)
      previous.width = Math.max(previous.x + previous.width, line.x + line.width) - Math.min(previous.x, line.x)
      previous.x = Math.min(previous.x, line.x)
      previous.height = Math.max(previous.y + previous.height, line.y + line.height) - previous.y
      continue
    }

    blocks.push({
      id: `pdf-block-${blocks.length + 1}`,
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      column: line.column,
      kind,
      translatable: kind !== 'formula' && kind !== 'figure-text' && kind !== 'table-text' && kind !== 'metadata' && line.text.length > 1,
      fontHeight: line.fontHeight,
    })
  }

  const firstSectionIndex = blocks.findIndex(block => block.kind === 'heading' && SECTION_HEADING.test(block.text))
  if (firstSectionIndex > 0) {
    for (const block of blocks.slice(0, firstSectionIndex)) {
      if (block.kind !== 'body' || block.column !== 'full') continue
      block.kind = 'metadata'
      block.translatable = false
    }
  }

  const footnotes = blocks.filter(block => block.kind === 'footnote')
  if (footnotes.length === 0) return blocks
  const readingOrder = blocks.filter(block => block.kind !== 'footnote')
  const footerIndex = readingOrder.findIndex(block => block.kind === 'metadata' && block.y >= pageHeight * 0.9)
  readingOrder.splice(footerIndex >= 0 ? footerIndex : readingOrder.length, 0, ...footnotes)
  return readingOrder
}

export function buildPdfTextBlocks(
  spans: PdfTextSpan[],
  pageWidth: number,
  pageHeight: number,
): PdfTextBlock[] {
  const normalized = spans.filter(span => (
    span.text.trim()
    && Number.isFinite(span.x)
    && Number.isFinite(span.y)
    && span.width >= 0
    && span.height > 0
  ))
  const columns = assignColumns(mergeSpansIntoLines(normalized, pageWidth), pageWidth)
  const lines = markTableText(markFigureText(columns, pageHeight), pageHeight)
  return mergeLinesIntoBlocks(orderLines(lines), pageHeight)
}
