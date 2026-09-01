import { describe, expect, it } from 'vitest'
import {
  normalizedPdfPageAnchor,
  normalizePdfWheelDelta,
  PDF_ORIGINAL_ZOOM_MAX,
  PDF_ORIGINAL_ZOOM_MIN,
  resolvePdfWheelZoom,
} from '../../entrypoints/pdf/zoom'

describe('PDF original page zoom', () => {
  it('zooms in and out with wheel movement', () => {
    expect(resolvePdfWheelZoom(1, -100)).toBeGreaterThan(1)
    expect(resolvePdfWheelZoom(1, 100)).toBeLessThan(1)
  })

  it('normalizes line and page wheel units', () => {
    expect(normalizePdfWheelDelta(3, 1)).toBe(48)
    expect(normalizePdfWheelDelta(1, 2)).toBe(100)
  })

  it('keeps zoom inside the supported range', () => {
    expect(resolvePdfWheelZoom(PDF_ORIGINAL_ZOOM_MAX, -100)).toBe(PDF_ORIGINAL_ZOOM_MAX)
    expect(resolvePdfWheelZoom(PDF_ORIGINAL_ZOOM_MIN, 100)).toBe(PDF_ORIGINAL_ZOOM_MIN)
  })

  it('anchors zoom to the pointer position within the PDF page', () => {
    expect(normalizedPdfPageAnchor(350, 100, 500)).toBe(0.5)
    expect(normalizedPdfPageAnchor(50, 100, 500)).toBe(0)
    expect(normalizedPdfPageAnchor(700, 100, 500)).toBe(1)
  })
})
