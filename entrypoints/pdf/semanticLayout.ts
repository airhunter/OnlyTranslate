import type { PdfBlockKind, PdfTextBlock, PdfTextSpan } from './layout'
import { reconstructInlineMath } from './inlineMath'

export interface PdfLayoutRegion {
  classId: number
  label: string
  score: number
  coordinate: [number, number, number, number]
}

type ReadingZone = 'top' | 'single' | 'left' | 'right' | 'bottom'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface SemanticLine extends Rect {
  id: string
  text: string
  spans: PdfTextSpan[]
  fontHeight: number
  region?: PdfLayoutRegion & { index: number }
  visual: boolean
  zone: ReadingZone
}

interface CaptionEnvelope {
  rect: Rect
  region: PdfLayoutRegion & { index: number }
}

const VISUAL_LABELS = new Set(['image', 'chart', 'table', 'formula', 'algorithm', 'header_image', 'footer_image'])
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
const CAPTION_LABELS = new Set(['figure_title', 'table_title', 'chart_title'])
const INLINE_MATH_TEXT_LABELS = new Set(['text', 'content', 'abstract', 'aside_text', ...CAPTION_LABELS])
const CAPTION_START = /^(?:figure|fig\.|table|图|表)\s*\d+\s*[:.：]/iu
const TERMINAL_LINE_END = /[.!?][“”"'’）)\]]?$/u

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

function isEmbeddedProseFormula(
  region: PdfLayoutRegion,
  spans: PdfTextSpan[],
  pageWidth: number,
  regions: PdfLayoutRegion[],
): boolean {
  if (region.label !== 'formula') return false
  const target = regionRect(region)
  const textHeights = spans.filter(span => span.text.trim() && span.height > 0).map(span => span.height)
  const typicalTextHeight = Math.max(7, median(textHeights))
  // A diagram containing mathematical notation may itself be classified as one
  // large formula. Only override compact, line-sized detections inside prose.
  if (target.height > Math.max(48, typicalTextHeight * 4.5) || target.width > pageWidth * 0.72) return false
  const targetArea = Math.max(1, target.width * target.height)
  const nestedInTextRegion = regions.some(candidate => (
    candidate !== region
    && INLINE_MATH_TEXT_LABELS.has(candidate.label)
    && intersectionArea(target, regionRect(candidate)) / targetArea >= 0.55
  ))
  if (nestedInTextRegion) return true

  const targetCenterY = target.y + target.height / 2
  const adjacentProse = spans.filter(span => {
    const text = span.text.trim()
    if (!/\p{L}{2,}/u.test(text)) return false
    const spanCenterY = span.y + span.height / 2
    if (Math.abs(spanCenterY - targetCenterY) > Math.max(4, typicalTextHeight * 0.7)) return false
    const horizontalGap = span.x + span.width < target.x
      ? target.x - (span.x + span.width)
      : span.x > target.x + target.width
        ? span.x - (target.x + target.width)
        : 0
    return horizontalGap <= typicalTextHeight * 6
  })
  const proseOnLeft = adjacentProse.some(span => span.x + span.width <= target.x + typicalTextHeight)
  const proseOnRight = adjacentProse.some(span => span.x >= target.x + target.width - typicalTextHeight)
  if (proseOnLeft && proseOnRight) return true

  const overlappingText = spans.filter(span => {
    const horizontalOverlap = Math.max(0, Math.min(span.x + span.width, target.x + target.width) - Math.max(span.x, target.x))
    const verticalOverlap = Math.max(0, Math.min(span.y + span.height, target.y + target.height) - Math.max(span.y, target.y))
    return horizontalOverlap > 0 && verticalOverlap >= Math.min(span.height, target.height) * 0.55
  }).map(span => span.text.trim()).filter(Boolean).join(' ')
  if (!overlappingText) return false
  const proseWords = overlappingText.match(/\p{L}{2,}/gu)?.length ?? 0
  const hanCharacters = overlappingText.match(/\p{Script=Han}/gu)?.length ?? 0
  return proseWords >= 5 || hanCharacters >= 10
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
    const overlap = intersectionArea(rect, target)
    const visualBonus = VISUAL_LABELS.has(region.label) && overlap > rect.width * rect.height * 0.55
      ? rect.width * rect.height * 0.35
      : 0
    const score = overlap + (containsCenter ? Math.max(1, rect.width * rect.height) : 0) + visualBonus
    if (score > bestScore) {
      bestScore = score
      best = { ...region, index }
    }
  })
  return best
}

function isNearbyVisualDelimiterFragment(
  text: string,
  rect: Rect,
  region: PdfLayoutRegion | undefined,
): boolean {
  if (!region || !VISUAL_LABELS.has(region.label)) return false
  const compact = text.replace(/\s/g, '')
  if (!/^(?:\(\)|\[\]|\{\}|\|\||[()[\]{}|])$/.test(compact)) return false
  const target = regionRect(region)
  const horizontalOverlap = Math.max(
    0,
    Math.min(rect.x + rect.width, target.x + target.width) - Math.max(rect.x, target.x),
  )
  const horizontalCoverage = horizontalOverlap / Math.max(1, Math.min(rect.width, target.width))
  const verticalGap = target.y - (rect.y + rect.height)
  return horizontalCoverage >= 0.45
    && verticalGap >= -rect.height * 0.65
    && verticalGap <= rect.height * 2.5
}

function nearbyEquationNumberRegion(
  text: string,
  rect: Rect,
  regions: PdfLayoutRegion[],
): PdfLayoutRegion | undefined {
  if (!/^\(\d+(?:\.\d+)*\)$/.test(text.replace(/\s/g, ''))) return undefined
  return regions
    .filter(region => region.label === 'formula')
    .map(region => {
      const target = regionRect(region)
      const centerGap = Math.abs(
        (rect.y + rect.height / 2) - (target.y + target.height / 2),
      )
      const horizontalGap = rect.x - (target.x + target.width)
      return { region, target, centerGap, horizontalGap }
    })
    .filter(candidate => (
      candidate.horizontalGap >= -rect.height
      && candidate.horizontalGap <= rect.height * 6
      && candidate.centerGap <= Math.max(rect.height, candidate.target.height) * 0.8
    ))
    .sort((left, right) => left.horizontalGap - right.horizontalGap)[0]?.region
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

function captionLabel(text: string): 'figure_title' | 'table_title' {
  return /^(?:table|表)/iu.test(text.trim()) ? 'table_title' : 'figure_title'
}

function detectCaptionEnvelopes(lineGroups: PdfTextSpan[][], pageWidth: number): CaptionEnvelope[] {
  const lines = lineGroups.map(spans => ({
    spans,
    text: joinSpans(spans),
    rect: unionRect(spans),
    fontHeight: Math.max(...spans.map(span => span.height)),
  })).sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)
  const envelopes: CaptionEnvelope[] = []

  lines.forEach((start, startIndex) => {
    if (!CAPTION_START.test(start.text.trim())) return
    const typicalHeight = Math.max(7, start.fontHeight)
    const collected = [start.rect]
    let bottom = start.rect.y + start.rect.height
    const maximumBottom = start.rect.y + typicalHeight * 9

    for (const candidate of lines.slice(startIndex + 1)) {
      if (candidate.rect.y > maximumBottom) break
      const verticalGap = candidate.rect.y - bottom
      if (verticalGap > typicalHeight * 1.6) break
      const current = unionRect(collected)
      const horizontalOverlap = Math.max(
        0,
        Math.min(current.x + current.width, candidate.rect.x + candidate.rect.width)
          - Math.max(current.x, candidate.rect.x),
      )
      const horizontallyRelated = horizontalOverlap > 0
        || Math.abs(candidate.rect.x - current.x) <= typicalHeight * 1.5
      if (!horizontallyRelated) continue
      collected.push(candidate.rect)
      bottom = Math.max(bottom, candidate.rect.y + candidate.rect.height)
    }

    const rect = unionRect(collected)
    if (rect.width < pageWidth * 0.16) return
    envelopes.push({
      rect,
      region: {
        classId: -1,
        label: captionLabel(start.text),
        score: 1,
        coordinate: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
        index: -(envelopes.length + 1),
      },
    })
  })

  return envelopes
}

function matchingCaptionEnvelope(rect: Rect, envelopes: CaptionEnvelope[]): CaptionEnvelope | undefined {
  return envelopes.find(envelope => {
    const overlap = intersectionArea(rect, envelope.rect)
    return overlap / Math.max(1, rect.width * rect.height) >= 0.35
  })
}

function hasTwoColumnTextLayout(lines: SemanticLine[], pageWidth: number): boolean {
  const candidates = lines.filter(line => (
    !line.visual
    && !OMITTED_LABELS.has(line.region?.label ?? '')
    && line.region?.label !== 'doc_title'
  ))
  const left = candidates.filter(line => (
    line.x + line.width <= pageWidth * 0.54
    && line.x + line.width / 2 < pageWidth * 0.43
  ))
  const right = candidates.filter(line => (
    line.x >= pageWidth * 0.46
    && line.x + line.width / 2 > pageWidth * 0.57
  ))
  if (left.length < 2 || right.length < 2) return false

  const leftTop = Math.min(...left.map(line => line.y))
  const leftBottom = Math.max(...left.map(line => line.y + line.height))
  const rightTop = Math.min(...right.map(line => line.y))
  const rightBottom = Math.max(...right.map(line => line.y + line.height))
  return Math.max(leftTop, rightTop) <= Math.min(leftBottom, rightBottom)
}

function buildLines(
  spans: PdfTextSpan[],
  regions: PdfLayoutRegion[],
  pageWidth: number,
  pageHeight: number,
): { lines: SemanticLine[]; captionEnvelopes: CaptionEnvelope[] } {
  const lineGroups = splitBaselinesIntoLines(spans, pageWidth)
  const captionEnvelopes = detectCaptionEnvelopes(lineGroups, pageWidth)
  const lines = lineGroups.map((lineSpans, index): SemanticLine => {
    const rect = unionRect(lineSpans)
    const text = joinSpans(lineSpans)
    const caption = matchingCaptionEnvelope(rect, captionEnvelopes)
    const equationNumberRegion = nearbyEquationNumberRegion(text, rect, regions)
    const region = caption?.region ?? (equationNumberRegion
      ? { ...equationNumberRegion, index: regions.indexOf(equationNumberRegion) }
      : dominantRegion(rect, regions))
    const overlap = region ? intersectionArea(rect, regionRect(region)) : 0
    const visual = !caption && Boolean(region && VISUAL_LABELS.has(region.label) && (
      Boolean(equationNumberRegion)
      || overlap > rect.width * rect.height * 0.45
      || isNearbyVisualDelimiterFragment(text, rect, region)
    ))
    return {
      id: `semantic-line-${index}`,
      text,
      spans: lineSpans,
      fontHeight: Math.max(...lineSpans.map(span => span.height)),
      region,
      visual,
      zone: 'single' as const,
      ...rect,
    }
  }).filter(line => line.text)

  const twoColumnLayout = hasTwoColumnTextLayout(lines, pageWidth)
  lines.forEach(line => {
    if (CAPTION_LABELS.has(line.region?.label ?? '')) {
      line.zone = 'single'
      return
    }
    const topMetadata = line.y < pageHeight * 0.285 && (
      line.region?.label === 'doc_title'
      || line.region?.label === 'footnote'
      || line.region?.label === 'header'
    )
    if (topMetadata) {
      line.zone = 'top'
      return
    }
    if (line.region?.label === 'footnote' && line.y > pageHeight * 0.42) {
      line.zone = 'bottom'
      return
    }
    if (!twoColumnLayout) {
      line.zone = 'single'
      return
    }
    const fullWidth = line.width > pageWidth * 0.67
    line.zone = fullWidth
      ? (line.y < pageHeight * 0.36 ? 'top' : 'bottom')
      : (line.x + line.width / 2 < pageWidth / 2 ? 'left' : 'right')
  })

  const abstractY = lines.find(line => /^abstract$/i.test(line.text.trim()))?.y
  if (Number.isFinite(abstractY)) {
    lines.forEach(line => {
      if (line.y < abstractY! - line.height * 0.35) line.zone = 'top'
    })
  }
  lines.forEach(line => {
    if (line.region?.label === 'footnote' && line.y > pageHeight * 0.42) line.zone = 'bottom'
  })
  return { lines, captionEnvelopes }
}

function isHeadingLine(line: SemanticLine): boolean {
  const label = line.region?.label ?? ''
  const trustedLayoutHeading = label === 'doc_title'
    || (label === 'paragraph_title' && line.text.trim().length <= 90)
  return trustedLayoutHeading
    || /^\d+(?:\.\d+)*\s+[A-Z][^.!?]{0,80}$/.test(line.text)
    || /^(?:Abstract|Summary|Introduction|Conclusion|References|Acknowledg(?:e)?ments)$/i.test(line.text)
}

function isListLine(line: SemanticLine): boolean {
  return /^(?:[•●▪◦]|[-–—]\s|\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s)/i.test(line.text)
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
  const rank: Record<ReadingZone, number> = { top: 0, single: 1, left: 1, right: 2, bottom: 3 }
  return rank[left.zone] - rank[right.zone] || left.y - right.y || left.x - right.x
}

function shouldStartParagraph(previous: SemanticLine | undefined, line: SemanticLine, group: SemanticLine[]): boolean {
  if (!previous || previous.zone !== line.zone) return true
  if (previous.region?.label === 'doc_title' && line.region?.label === 'doc_title' && previous.region?.index === line.region?.index) return false
  if (
    previous.region?.index === line.region?.index
    && CAPTION_LABELS.has(line.region?.label ?? '')
  ) return false
  if (isHeadingLine(previous) || isHeadingLine(line)) return true
  if (isListLine(line)) return true
  if (isListLine(group[0]) && TERMINAL_LINE_END.test(previous.text) && /^[A-Z]/.test(line.text)) return true
  const gap = line.y - (previous.y + previous.height)
  const typicalHeight = Math.max(7, (previous.height + line.height) / 2)
  if (gap > typicalHeight * 0.82) return true
  const baseX = group.length ? Math.min(...group.map(item => item.x)) : previous.x
  const regionBaseX = line.region ? regionRect(line.region).x : baseX
  const paragraphBaseX = Math.min(baseX, regionBaseX)
  const startsIndentedParagraph = line.x - paragraphBaseX > typicalHeight * 0.9
    && TERMINAL_LINE_END.test(previous.text)
  if (startsIndentedParagraph) return true
  if (previous.region?.index === line.region?.index && TEXT_LABELS.has(line.region?.label ?? '')) return false
  return false
}

function blockKind(lines: SemanticLine[]): PdfBlockKind {
  const lead = lines[0]
  const label = lead.region?.label ?? 'text'
  if (isHeadingLine(lead)) return 'heading'
  if (label === 'abstract') return 'abstract'
  if (isListLine(lead)) return 'list-item'
  if (label === 'footnote') return lead.zone === 'top' ? 'metadata' : 'footnote'
  if (CAPTION_LABELS.has(label)) return 'caption'
  if (lead.zone === 'top') return 'metadata'
  return 'body'
}

function dedupeVisualRegions(regions: PdfLayoutRegion[]): PdfLayoutRegion[] {
  const structuralVisuals = regions.filter(region => region.label !== 'formula')
  const withoutNestedFormulas = regions.filter(region => {
    if (region.label !== 'formula') return true
    const rect = regionRect(region)
    const area = rect.width * rect.height
    return !structuralVisuals.some(structural => (
      intersectionArea(rect, regionRect(structural)) / Math.max(1, area) > 0.82
    ))
  })
  const kept: PdfLayoutRegion[] = []
  for (const candidate of [...withoutNestedFormulas].sort((left, right) => right.score - left.score)) {
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
  tokenNamespace = 'page',
): PdfTextBlock[] {
  // A layout detector may label inline notation inside a prose sentence as a
  // standalone formula. The PDF text layer is the safer authority here: if the
  // detected formula overlaps natural-language text, keep it in that paragraph.
  const readingRegions = regions.filter(region => !isEmbeddedProseFormula(region, spans, pageWidth, regions))
  const { lines, captionEnvelopes } = buildLines(spans, readingRegions, pageWidth, pageHeight)
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
    const trustedTextRegion = group.some(line => INLINE_MATH_TEXT_LABELS.has(line.region?.label ?? ''))
    const inlineMath = trustedTextRegion && ['body', 'abstract', 'list-item', 'caption'].includes(kind)
      ? reconstructInlineMath(group, `${tokenNamespace}:block-${textBlocks.length + 1}`)
      : undefined
    textBlocks.push({
      id: `pdf-semantic-${textBlocks.length + 1}`,
      text,
      ...rect,
      column: group[0].zone === 'left' ? 'left' : group[0].zone === 'right' ? 'right' : 'full',
      kind,
      translatable: ['heading', 'body', 'abstract', 'list-item', 'caption'].includes(kind) && text.length > 1,
      fontHeight: median(group.map(line => line.fontHeight)),
      regionLabel: group[0].region?.label,
      mathSource: inlineMath?.source,
      inlineMath: inlineMath?.expressions,
    })
    group = []
  }

  bodyLines.forEach(line => {
    if (shouldStartParagraph(group.at(-1), line, group)) flush()
    group.push(line)
  })
  flush()

  const visuals = dedupeVisualRegions(readingRegions.filter(region => VISUAL_LABELS.has(region.label) && region.score >= 0.42))
    .filter(region => {
      const rect = regionRect(region)
      const area = Math.max(1, rect.width * rect.height)
      return !captionEnvelopes.some(caption => intersectionArea(rect, caption.rect) / area >= 0.45)
    })
    .map((region, index): PdfTextBlock => {
      const detectedRect = regionRect(region)
      const captionBelow = captionEnvelopes
        .filter(caption => {
          const horizontalOverlap = Math.max(
            0,
            Math.min(detectedRect.x + detectedRect.width, caption.rect.x + caption.rect.width)
              - Math.max(detectedRect.x, caption.rect.x),
          )
          return caption.rect.y > detectedRect.y + detectedRect.height * 0.35
            && caption.rect.y < detectedRect.y + detectedRect.height
            && horizontalOverlap / Math.max(1, Math.min(detectedRect.width, caption.rect.width)) >= 0.45
        })
        .sort((left, right) => left.rect.y - right.rect.y)[0]
      const rect = captionBelow
        ? { ...detectedRect, height: Math.max(1, captionBelow.rect.y - detectedRect.y) }
        : detectedRect
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
