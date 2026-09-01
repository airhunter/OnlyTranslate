import type { PdfTextBlock } from './layout'

export type PdfDisplayMode = 'semantic' | 'overlay' | 'original' | 'translation'

export function usesPdfSemanticLayout(mode: PdfDisplayMode): boolean {
  return mode === 'semantic' || mode === 'translation'
}

export function shouldTranslatePdfMode(mode: PdfDisplayMode): boolean {
  return mode !== 'original'
}

export function shouldShowTranslationOnlySource(
  block: Pick<PdfTextBlock, 'translatable'> & { translation?: string },
  translationRunning: boolean,
): boolean {
  return !block.translation && (!block.translatable || !translationRunning)
}
