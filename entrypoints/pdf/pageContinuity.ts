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

function blockText(block: PdfTextBlock | PdfContinuousBlock): string {
  return 'translationSource' in block && block.translationSource
    ? block.translationSource
    : block.text
}

function firstBody<T extends PdfTextBlock>(blocks: T[] | undefined): T | undefined {
  return blocks?.find(block => (
    block.kind === 'body'
    && block.translatable
    && !('hiddenInReadingFlow' in block && block.hiddenInReadingFlow)
  ))
}

function lastBody<T extends PdfTextBlock>(blocks: T[] | undefined): T | undefined {
  return blocks?.findLast(block => (
    block.kind === 'body'
    && block.translatable
    && !('hiddenInReadingFlow' in block && block.hiddenInReadingFlow)
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

export function addCrossPageContext(
  currentBlocks: PdfTextBlock[],
  previousBlocks?: PdfTextBlock[],
  nextBlocks?: PdfTextBlock[],
): PdfContinuousBlock[] {
  const enriched: PdfContinuousBlock[] = currentBlocks.map(block => ({ ...block }))
  const lastLeftBody = enriched.findLast(block => block.kind === 'body' && block.column === 'left')
  const firstRightBody = enriched.find(block => block.kind === 'body' && block.column === 'right')

  if (
    lastLeftBody
    && firstRightBody
    && hasEnoughProse(lastLeftBody, firstRightBody)
    && hasCompatibleTypography(lastLeftBody, firstRightBody)
    && isCrossPageParagraph(lastLeftBody, firstRightBody)
  ) {
    lastLeftBody.translationSource = joinAcrossPage(blockText(lastLeftBody), blockText(firstRightBody))
    lastLeftBody.continuesToNextColumn = true
    firstRightBody.hiddenInReadingFlow = true
    firstRightBody.readingFlowOwnerId = lastLeftBody.id
  }

  const currentFirst = firstBody(enriched)
  const currentLast = lastBody(enriched)
  const previousLast = lastBody(previousBlocks)
  const nextFirst = firstBody(nextBlocks)

  if (currentFirst && isCrossPageParagraph(previousLast, currentFirst)) {
    currentFirst.translationSource = joinAcrossPage(blockText(previousLast!), blockText(currentFirst))
    currentFirst.continuesFromPreviousPage = true
  }

  if (currentLast && isCrossPageParagraph(currentLast, nextFirst)) {
    currentLast.translationSource = joinAcrossPage(blockText(currentLast), blockText(nextFirst!))
    currentLast.continuesToNextPage = true
  }

  return enriched
}
