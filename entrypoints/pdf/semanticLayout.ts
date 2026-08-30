import type { PdfBlockKind, PdfTextBlock, PdfTextSpan } from './layout'

export interface PdfLayoutRegion {
  classId: number
  label: string
  score: number
  coordinate: [number, number, number, number]
}

type ReadingZone = 'top' | 'left' | 'right' | 'bottom'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface SemanticLine extends Rect {
  id: string
  text: string
  fontHeight: number
  region?: PdfLayoutRegion & { index: number }
  visual: boolean
  zone: ReadingZone
}

const VISUAL_LABELS = new Set(['image', 'chart', 'table', 'formula', 'algorithm', 'header_image', 'footer_image'])
const HEADING_LABELS = new Set(['doc_title', 'paragraph_title'])
const TEXT_LABELS = new Set([
  'text',
  'content',
  'abstract',
  'paragraph_title',
  'doc_title',
  'figure_title',
  'table_title',
  'chart_title',
  'footnote',
  'reference',
  'reference_content',
  'aside_text',
])
const OMITTED_LABELS = new Set(['header', 'footer', 'number', 'seal', 'header_image', 'footer_image'])

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function unionRect(items: Rect[]): Rect {
  const x = Math.min(...items.map(item => item.x))
  const y = Math.min(...items.map(item => item.y))
  const right = Math.max(...items.map(item => item.x + item.width))
  const bottom = Math.max(...items.map(item => item.y + item.height))
  return { x, y, width: right - x, height: bottom - y }
}

function regionRect(region: PdfLayoutRegion): Rect {
  const [x1, y1, x2, y2] = region.coordinate
  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) }
}

function intersectionArea(left: Rect, right: Rect): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y))
  return width * height
}

function dominantRegion(rect: Rect, regions: PdfLayoutRegion[]): SemanticLine['region'] {
  let best: SemanticLine['region']
  let bestScore = 0
  regions.forEach((region, index) => {
    const target = regionRect(region)
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const containsCenter = centerX >= target.x
      && centerX <= target.x + target.width
      && centerY >= target.y
      && centerY <= target.y + target.height
    const score = intersectionArea(rect, target) + (containsCenter ? Math.max(1, rect.width * rect.height) : 0)
    if (score > bestScore) {
      bestScore = score
      best = { ...region, index }
    }
  })
  return best
}

function shouldInsertSpace(previous: PdfTextSpan, current: PdfTextSpan): boolean {
  const gap = current.x - (previous.x + previous.width)
  if (gap <= Math.max(1.5, Math.min(previous.height, current.height) * 0.13)) return false
  return !/^[,.;:!?%)\]}]/.test(current.text) && !/[([{/]$/.test(previous.text)
}

function joinSpans(spans: PdfTextSpan[]): string {
  return [...spans]
    .sort((left, right) => left.x - right.x)
    .reduce((text, span, index, ordered) => {
      if (!index) return span.text
      return `${text}${shouldInsertSpace(ordered[index - 1], span) ? ' ' : ''}${span.text}`
    }, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitBaselinesIntoLines(spans: PdfTextSpan[], pageWidth: number): PdfTextSpan[][] {
  const bands: Array<{ spans: PdfTextSpan[]; centerY: number; height: number }> = []
  const ordered = spans
    .filter(span => span.text.trim())
    .sort((left, right) => left.y - right.y || left.x - right.x)

  for (const span of ordered) {
    const centerY = span.y + span.height / 2
    let band = bands.find(candidate => (
      Math.abs(candidate.centerY - centerY) <= Math.max(2.4, Math.min(candidate.height, span.height) * 0.42)
    ))
    if (!band) {
      band = { spans: [], centerY, height: span.height }
      bands.push(band)
    }
    band.spans.push(span)
    band.centerY = band.spans.reduce((sum, item) => sum + item.y + item.height / 2, 0) / band.spans.length
    band.height = Math.max(band.height, span.height)
  }

  return bands.flatMap(band => {
    const groups: PdfTextSpan[][] = []
    for (const span of band.spans.sort((left, right) => left.x - right.x)) {
      const group = groups.at(-1)
      const previous = group?.at(-1)
      const gap = previous ? span.x - (previous.x + previous.width) : 0
      const crossesGutter = previous
        && previous.x + previous.width < pageWidth * 0.5
        && span.x > pageWidth * 0.5
        && gap > pageWidth * 0.02
      const largeGap = previous && gap > Math.max(pageWidth * 0.035, band.height * 2.5)
      if (!group || crossesGutter || largeGap) groups.push([span])
      else group.push(span)
    }
    return groups
  })
}

function buildLines(
  spans: PdfTextSpan[],
  regions: PdfLayoutRegion[],
  pageWidth: number,
  pageHeight: number,
): SemanticLine[] {
  const lines = splitBaselinesIntoLines(spans, pageWidth).map((lineSpans, index) => {
    const rect = unionRect(lineSpans)
    const region = dominantRegion(rect, regions)
    const overlap = region ? intersectionArea(rect, regionRect(region)) : 0
    const visual = Boolean(region && VISUAL_LABELS.has(region.label) && overlap > rect.width * rect.height * 0.45)
    const centered = Math.abs(rect.x + rect.width / 2 - pageWidth / 2) < pageWidth * 0.16
    const topMetadata = rect.y < pageHeight * 0.285 && (
      region?.label === 'doc_title'
      || region?.label === 'footnote'
      || region?.label === 'header'
      || (centered && rect.y < pageHeight * 0.14)
    )
    const fullWidth = rect.width > pageWidth * 0.67 || topMetadata
    const zone: ReadingZone = fullWidth
      ? (rect.y < pageHeight * 0.36 ? 'top' : 'bottom')
      : (rect.x + rect.width / 2 < pageWidth / 2 ? 'left' : 'right')
    return {
      id: `semantic-line-${index}`,
      text: joinSpans(lineSpans),
      fontHeight: Math.max(...lineSpans.map(span => span.height)),
      region,
      visual,
      zone,
      ...rect,
    }
  }).filter(line => line.text)

  const abstractY = lines.find(line => /^abstract$/i.test(line.text.trim()))?.y
  if (Number.isFinite(abstractY)) {
    lines.forEach(line => {
      if (line.y < abstractY! - line.height * 0.35) line.zone = 'top'
    })
  }
  lines.forEach(line => {
    if (line.region?.label === 'footnote' && line.y > pageHeight * 0.42) line.zone = 'bottom'
  })
  return lines
}

function isHeadingLine(line: SemanticLine): boolean {
  return HEADING_LABELS.has(line.region?.label ?? '')
    || /^\d+(?:\.\d+)*\s+[A-Z][^.!?]{0,80}$/.test(line.text)
    || /^(?:Abstract|Summary|Introduction|Conclusion|References|Acknowledg(?:e)?ments)$/i.test(line.text)
}

function isListLine(line: SemanticLine): boolean {
  return /^(?:[•●▪◦]|[-–—]\s|\(?[a-z0-9]{1,2}[.)]\s)/i.test(line.text)
}

function normalizeParagraphText(lines: SemanticLine[]): string {
  let result = ''
  lines.forEach((line, index) => {
    if (!index) {
      result = line.text
      return
    }
    if (/[A-Za-z]{2,}-$/.test(result) && /^[a-z]/.test(line.text)) result = result.slice(0, -1) + line.text
    else result += ` ${line.text}`
  })
  return result.replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim()
}

function lineOrder(left: SemanticLine, right: SemanticLine): number {
  const rank: Record<ReadingZone, number> = { top: 0, left: 1, right: 2, bottom: 3 }
  return rank[left.zone] - rank[right.zone] || left.y - right.y || left.x - right.x
}

function shouldStartParagraph(previous: SemanticLine | undefined, line: SemanticLine, group: SemanticLine[]): boolean {
  if (!previous || previous.zone !== line.zone) return true
  if (previous.region?.label === 'doc_title' && line.region?.label === 'doc_title' && previous.region?.index === line.region?.index) return false
  if (isHeadingLine(previous) || isHeadingLine(line)) return true
  if (isListLine(line)) return true
  if (isListLine(group[0]) && /[?!.]$/.test(previous.text) && /^[A-Z]/.test(line.text)) return true
  const gap = line.y - (previous.y + previous.height)
  const typicalHeight = Math.max(7, (previous.height + line.height) / 2)
  if (gap > typicalHeight * 0.82) return true
  if (previous.region?.index === line.region?.index && TEXT_LABELS.has(line.region?.label ?? '')) return false
  const baseX = group.length ? Math.min(...group.map(item => item.x)) : previous.x
  return line.x - baseX > typicalHeight * 0.8 && /[.!?)]$/.test(previous.text)
}

function blockKind(lines: SemanticLine[]): PdfBlockKind {
  const lead = lines[0]
  const label = lead.region?.label ?? 'text'
  if (isHeadingLine(lead)) return 'heading'
  if (label === 'abstract') return 'abstract'
  if (isListLine(lead)) return 'list-item'
  if (label === 'footnote') return lead.zone === 'top' ? 'metadata' : 'footnote'
  if (label.includes('title')) return 'caption'
  if (lead.zone === 'top') return 'metadata'
  return 'body'
}

function dedupeVisualRegions(regions: PdfLayoutRegion[]): PdfLayoutRegion[] {
  const kept: PdfLayoutRegion[] = []
  for (const candidate of [...regions].sort((left, right) => right.score - left.score)) {
    const rect = regionRect(candidate)
    const area = rect.width * rect.height
    const duplicate = kept.some(existing => {
      const other = regionRect(existing)
      const overlap = intersectionArea(rect, other) / Math.max(1, Math.min(area, other.width * other.height))
      const imageChartPair = ['image', 'chart'].includes(candidate.label) && ['image', 'chart'].includes(existing.label)
      return candidate.label === existing.label ? overlap > 0.86 : imageChartPair && overlap > 0.78
    })
    if (!duplicate) kept.push(candidate)
  }
  return kept
}

function visualKind(label: string): PdfTextBlock['visualKind'] {
  if (label === 'chart') return 'chart'
  if (label === 'table') return 'table'
  if (label === 'formula') return 'formula'
  if (label === 'algorithm') return 'algorithm'
  return 'image'
}

export function buildSemanticPdfBlocks(
  spans: PdfTextSpan[],
  regions: PdfLayoutRegion[],
  pageWidth: number,
  pageHeight: number,
): PdfTextBlock[] {
  const lines = buildLines(spans, regions, pageWidth, pageHeight)
  const bodyLines = lines
    .filter(line => !line.visual && !OMITTED_LABELS.has(line.region?.label ?? ''))
    .sort(lineOrder)
  const textBlocks: PdfTextBlock[] = []
  let group: SemanticLine[] = []

  const flush = () => {
    if (!group.length) return
    const rect = unionRect(group)
    const kind = blockKind(group)
    const text = normalizeParagraphText(group)
    textBlocks.push({
      id: `pdf-semantic-${textBlocks.length + 1}`,
      text,
      ...rect,
      column: group[0].zone === 'left' ? 'left' : group[0].zone === 'right' ? 'right' : 'full',
      kind,
      translatable: ['heading', 'body', 'abstract', 'list-item', 'caption'].includes(kind) && text.length > 1,
      fontHeight: median(group.map(line => line.fontHeight)),
      regionLabel: group[0].region?.label,
    })
    group = []
  }

  bodyLines.forEach(line => {
    if (shouldStartParagraph(group.at(-1), line, group)) flush()
    group.push(line)
  })
  flush()

  const visuals = dedupeVisualRegions(regions.filter(region => VISUAL_LABELS.has(region.label) && region.score >= 0.42))
    .map((region, index): PdfTextBlock => {
      const rect = regionRect(region)
      const centerX = rect.x + rect.width / 2
      const centered = Math.abs(centerX - pageWidth / 2) < pageWidth * 0.18
      const column = rect.width > pageWidth * 0.68 || (centered && rect.y < pageHeight * 0.2)
        ? 'full' as const
        : centerX < pageWidth / 2 ? 'left' as const : 'right' as const
      return {
        id: `pdf-visual-${index + 1}`,
        text: region.label,
        ...rect,
        column,
        kind: 'visual',
        translatable: false,
        regionLabel: region.label,
        visualKind: visualKind(region.label),
      }
    })

  const rank = (block: PdfTextBlock): number => {
    if (block.column === 'full') return block.y < pageHeight * 0.36 ? 0 : 3
    return block.column === 'left' ? 1 : 2
  }
  return [...textBlocks, ...visuals].sort((left, right) => rank(left) - rank(right) || left.y - right.y || left.x - right.x)
}
