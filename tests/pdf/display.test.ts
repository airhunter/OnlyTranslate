import { describe, expect, it } from 'vitest'
import {
  shouldShowTranslationOnlySource,
  shouldTranslatePdfMode,
  usesPdfSemanticLayout,
} from '@/entrypoints/pdf/display'

describe('PDF display behavior', () => {
  it('keeps the source visible in translation-only mode when translation cannot finish', () => {
    expect(shouldShowTranslationOnlySource({ translatable: true }, false)).toBe(true)
    expect(shouldShowTranslationOnlySource({ translatable: false }, true)).toBe(true)
    expect(shouldShowTranslationOnlySource({ translatable: true }, true)).toBe(false)
    expect(shouldShowTranslationOnlySource({ translatable: true, translation: '译文' }, false)).toBe(false)
  })

  it('does not start translation while the reader is in original-only mode', () => {
    expect(shouldTranslatePdfMode('original')).toBe(false)
    expect(shouldTranslatePdfMode('semantic')).toBe(true)
    expect(shouldTranslatePdfMode('translation')).toBe(true)
    expect(shouldTranslatePdfMode('overlay')).toBe(true)
  })

  it('uses semantic layout only for the reading-flow modes', () => {
    expect(usesPdfSemanticLayout('semantic')).toBe(true)
    expect(usesPdfSemanticLayout('translation')).toBe(true)
    expect(usesPdfSemanticLayout('original')).toBe(false)
    expect(usesPdfSemanticLayout('overlay')).toBe(false)
  })
})
