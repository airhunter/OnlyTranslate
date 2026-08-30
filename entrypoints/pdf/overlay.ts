import type { PdfTextBlock } from './layout'

const COMPLETE_END = /(?:[.!?。！？:：]["')\]}»”’]?\d*|[”’»])$/u
const SAFE_START = /^["'([{«“‘]?\s*(?:[\p{Lu}\p{Lt}\d•●▪◦*-]|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/u
const YEAR_CITATION = /\b(?:19|20)\d{2}[a-z]?\s*[.)]/iu
const CITATION_CONTINUATION = /^[\p{Lu}\p{Lt}][\p{L}'’-]+,\s*(?:19|20)\d{2}[a-z]?\)/u
const TRUSTED_HEADING = /^(?:abstract|summary|introduction|background|related work|method(?:ology)?|experiments?|results?|discussion|conclusion|references|acknowledg(?:e)?ments?|appendix|limitations|摘要|引言|背景|方法|实验|结果|讨论|结论|参考文献)\b/iu
const NUMBERED_HEADING = /^(?:\d+(?:\.\d+)*|[A-H])\s+\S/u

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))]
}

function isMixedScriptExample(text: string): boolean {
  const groups = [
    text.match(/\p{Script=Latin}/gu)?.length ?? 0,
    text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0,
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0,
  ]
  return groups.filter(count => count >= 5).length >= 2
}

function isReferenceHeavy(blocks: PdfTextBlock[]): boolean {
  const prose = blocks.filter(block => block.kind === 'body' && block.text.length >= 45)
  if (prose.length < 7) return false
  const citations = prose.filter(block => YEAR_CITATION.test(block.text)).length
  return citations >= 5 && citations / prose.length >= 0.4
}

function isDenseDataPage(blocks: PdfTextBlock[]): boolean {
  const visible = blocks.filter(block => !['metadata', 'figure-text'].includes(block.kind))
  const short = visible.filter(block => block.text.length <= 45).length
  return visible.length >= 36 || (visible.length >= 18 && short / visible.length >= 0.45)
}

function isCompleteProse(text: string): boolean {
  const normalized = text.trim()
  if (normalized.length < 60 || /[-‐‑]$/u.test(normalized)) return false
  if (CITATION_CONTINUATION.test(normalized)) return false
  if (!SAFE_START.test(normalized) || !COMPLETE_END.test(normalized)) return false
  const words = normalized.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  return words >= 7 && !isMixedScriptExample(normalized)
}

export function selectPdfTranslationBlocks(blocks: PdfTextBlock[]): PdfTextBlock[] {
  return selectPdfTranslationBlocksWithOptions(blocks)
}

export interface PdfTranslationBlockOptions {
  semanticLayout?: boolean
}

export function selectPdfTranslationBlocksWithOptions(
  blocks: PdfTextBlock[],
  options: PdfTranslationBlockOptions = {},
): PdfTextBlock[] {
  if (options.semanticLayout) {
    return blocks.filter(block => {
      if (!block.translatable || ['metadata', 'visual', 'figure-text', 'table-text', 'formula', 'footnote'].includes(block.kind)) {
        return false
      }
      if (['reference', 'reference_content'].includes(block.regionLabel ?? '')) return false
      if (block.kind === 'heading') return block.text.trim().length >= 3 && block.text.trim().length <= 240
      if (block.kind === 'caption') return block.text.trim().length >= 12
      if (block.kind === 'list-item') return block.text.trim().length >= 8
      return ['body', 'abstract'].includes(block.kind) && block.text.trim().length >= 24
    })
  }

  const referenceHeavy = isReferenceHeavy(blocks)
  const denseDataPage = isDenseDataPage(blocks)
  const proseHeight = Math.max(1, percentile(
    blocks
      .filter(block => !['metadata', 'figure-text', 'table-text'].includes(block.kind))
      .map(block => block.fontHeight ?? 0)
      .filter(Boolean),
    0.8,
  ))

  return blocks.filter(block => {
    if (!block.translatable || ['metadata', 'visual', 'figure-text', 'table-text', 'formula', 'footnote'].includes(block.kind)) {
      return false
    }
    if (block.kind === 'caption') return block.text.length >= 12 && COMPLETE_END.test(block.text.trim())
    if (block.kind === 'heading') {
      const trustedByText = TRUSTED_HEADING.test(block.text.trim()) || NUMBERED_HEADING.test(block.text.trim())
      const trustedByTypography = block.column === 'full' && (block.fontHeight ?? 0) >= proseHeight * 1.15
      return block.text.length >= 3 && block.text.length <= 180 && (trustedByText || trustedByTypography)
    }
    if (block.kind === 'list-item') {
      return block.text.length >= 12 && COMPLETE_END.test(block.text.trim())
    }
    if (!['body', 'abstract'].includes(block.kind) || referenceHeavy || !isCompleteProse(block.text)) return false
    return !denseDataPage || block.text.length >= 180
  })
}
