import type { PdfTextBlock } from './layout'

export interface PdfContinuousBlock extends PdfTextBlock {
  translationSource?: string
  continuesFromPreviousPage?: boolean
  continuesToNextPage?: boolean
  continuesToNextColumn?: boolean
  hiddenInReadingFlow?: boolean
  readingFlowOwnerId?: string
}

const TERMINAL_PUNCTUATION = /[.!?。！？…]["'”’）)\]]?$/u
const CONTINUATION_PUNCTUATION = /[,;:，；：]$/u
const LOWERCASE_OR_CJK_START = /^(?:\p{Ll}|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/u
const REFERENCE_LABELS = new Set(['reference', 'reference_content'])
const REFERENCE_HEADING = /^(?:(?:references|bibliography)\b|参考文献)/iu
const YEAR_CITATION = /\b(?:19|20)\d{2}[a-z]?\s*[.)]/iu

function blockText(block: PdfTextBlock | PdfContinuousBlock): string {
  return 'translationSource' in block && block.translationSource
    ? block.translationSource
    : block.mathSource
      ? block.mathSource
    : block.text
}

function combineInlineMath(...blocks: Array<PdfTextBlock | PdfContinuousBlock>): PdfTextBlock['inlineMath'] {
  const combined = blocks.flatMap(block => block.inlineMath ?? [])
  if (!combined.length) return undefined
  return [...new Map(combined.map(expression => [expression.token, expression])).values()]
}

function isProseBlock(block: PdfTextBlock): boolean {
  return ['body', 'abstract'].includes(block.kind)
    && block.translatable
    && !REFERENCE_LABELS.has(block.regionLabel ?? '')
    && !('hiddenInReadingFlow' in block && block.hiddenInReadingFlow)
}

function firstBody<T extends PdfTextBlock>(blocks: T[] | undefined): T | undefined {
  return blocks?.find(block => (
    isProseBlock(block)
  ))
}

function lastBody<T extends PdfTextBlock>(blocks: T[] | undefined): T | undefined {
  return blocks?.findLast(block => (
    isProseBlock(block)
  ))
}

export function isCrossPageParagraph(before: PdfTextBlock | undefined, after: PdfTextBlock | undefined): boolean {
  if (!before || !after) return false
  const beforeText = blockText(before).trim()
  const afterText = blockText(after).trim()
  if (!beforeText || !afterText || TERMINAL_PUNCTUATION.test(beforeText)) return false
  if (/[-‐‑]$/u.test(beforeText) || CONTINUATION_PUNCTUATION.test(beforeText)) return true
  return LOWERCASE_OR_CJK_START.test(afterText)
}

function joinAcrossPage(before: string, after: string): string {
  const left = before.trimEnd()
  const right = after.trimStart()
  if (/[-‐‑]$/u.test(left) && /^\p{Ll}/u.test(right)) return `${left.slice(0, -1)}${right}`
  if (/[-‐‑]$/u.test(left)) return `${left}${right}`
  return `${left} ${right}`
}

function hasEnoughProse(before: PdfContinuousBlock, after: PdfContinuousBlock): boolean {
  const text = `${blockText(before)} ${blockText(after)}`.trim()
  const tokens = text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0
  const cjkCharacters = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0
  return text.length >= 80 || tokens >= 8 || cjkCharacters >= 16
}

function hasCompatibleTypography(before: PdfContinuousBlock, after: PdfContinuousBlock): boolean {
  if (!before.fontHeight || !after.fontHeight) return true
  return Math.max(before.fontHeight, after.fontHeight) / Math.min(before.fontHeight, after.fontHeight) <= 1.35
}

function hasCompatibleProseKind(before: PdfContinuousBlock, after: PdfContinuousBlock): boolean {
  return before.kind === after.kind
}

function isReferenceLikePage(blocks: PdfTextBlock[]): boolean {
  if (blocks.some(block => REFERENCE_LABELS.has(block.regionLabel ?? '') || REFERENCE_HEADING.test(block.text.trim()))) {
    return true
  }
  const prose = blocks.filter(block => block.kind === 'body' && block.text.length >= 35)
  if (prose.length < 5) return false
  const citations = prose.filter(block => YEAR_CITATION.test(block.text)).length
  return citations >= 4 && citations / prose.length >= 0.55
}

function hasStructuralBoundary(
  blocks: PdfContinuousBlock[],
  fromIndex: number,
  toIndex: number,
): boolean {
  return blocks.slice(fromIndex, toIndex).some(block => (
    ['heading', 'list-item', 'caption', 'visual', 'formula'].includes(block.kind)
    || ['paragraph_title', 'doc_title', 'figure_title', 'table_title', 'chart_title'].includes(block.regionLabel ?? '')
  ))
}

function mergeSamePageColumns(blocks: PdfTextBlock[]): PdfContinuousBlock[] {
  const enriched: PdfContinuousBlock[] = blocks.map(block => ({ ...block }))
  if (isReferenceLikePage(enriched)) return enriched
  const lastLeftBody = enriched.findLast(block => isProseBlock(block) && block.column === 'left')
  const firstRightBody = enriched.find(block => isProseBlock(block) && block.column === 'right')
  if (!lastLeftBody || !firstRightBody) return enriched

  const leftIndex = enriched.indexOf(lastLeftBody)
  const rightIndex = enriched.indexOf(firstRightBody)
  if (
    rightIndex <= leftIndex
    || hasStructuralBoundary(enriched, leftIndex + 1, rightIndex)
    || !hasEnoughProse(lastLeftBody, firstRightBody)
    || !hasCompatibleTypography(lastLeftBody, firstRightBody)
    || !hasCompatibleProseKind(lastLeftBody, firstRightBody)
    || !isCrossPageParagraph(lastLeftBody, firstRightBody)
  ) return enriched

  lastLeftBody.translationSource = joinAcrossPage(blockText(lastLeftBody), blockText(firstRightBody))
  lastLeftBody.inlineMath = combineInlineMath(lastLeftBody, firstRightBody)
  lastLeftBody.continuesToNextColumn = true
  firstRightBody.hiddenInReadingFlow = true
  firstRightBody.readingFlowOwnerId = lastLeftBody.id
  return enriched
}

export function addCrossPageContext(
  currentBlocks: PdfTextBlock[],
  previousBlocks?: PdfTextBlock[],
  nextBlocks?: PdfTextBlock[],
): PdfContinuousBlock[] {
  const enriched = mergeSamePageColumns(currentBlocks)
  const previousEnriched = previousBlocks ? mergeSamePageColumns(previousBlocks) : undefined
  const nextEnriched = nextBlocks ? mergeSamePageColumns(nextBlocks) : undefined
  const currentReferenceLike = isReferenceLikePage(currentBlocks)
  const previousReferenceLike = previousBlocks ? isReferenceLikePage(previousBlocks) : false
  const nextReferenceLike = nextBlocks ? isReferenceLikePage(nextBlocks) : false

  const currentFirst = firstBody(enriched)
  const currentLast = lastBody(enriched)
  const previousLast = lastBody(previousEnriched)
  const nextFirst = firstBody(nextEnriched)
  const currentFirstIndex = currentFirst ? enriched.indexOf(currentFirst) : -1
  const currentLastIndex = currentLast ? enriched.indexOf(currentLast) : -1
  const previousLastIndex = previousLast && previousEnriched ? previousEnriched.indexOf(previousLast) : -1
  const nextFirstIndex = nextFirst && nextEnriched ? nextEnriched.indexOf(nextFirst) : -1

  if (
    currentFirst
    && previousLast
    && !currentReferenceLike
    && !previousReferenceLike
    && !hasStructuralBoundary(previousEnriched!, previousLastIndex + 1, previousEnriched!.length)
    && !hasStructuralBoundary(enriched, 0, currentFirstIndex)
    && hasCompatibleProseKind(previousLast, currentFirst)
    && hasCompatibleTypography(previousLast, currentFirst)
    && isCrossPageParagraph(previousLast, currentFirst)
  ) {
    currentFirst.translationSource = joinAcrossPage(blockText(previousLast!), blockText(currentFirst))
    currentFirst.inlineMath = combineInlineMath(previousLast, currentFirst)
    currentFirst.continuesFromPreviousPage = true
  }

  if (
    currentLast
    && nextFirst
    && !currentReferenceLike
    && !nextReferenceLike
    && !hasStructuralBoundary(enriched, currentLastIndex + 1, enriched.length)
    && !hasStructuralBoundary(nextEnriched!, 0, nextFirstIndex)
    && hasCompatibleProseKind(currentLast, nextFirst)
    && hasCompatibleTypography(currentLast, nextFirst)
    && isCrossPageParagraph(currentLast, nextFirst)
  ) {
    currentLast.continuesToNextPage = true
    currentLast.hiddenInReadingFlow = true
    currentLast.readingFlowOwnerId = nextFirst.id
  }

  return enriched
}
