import { describe, expect, it } from 'vitest'
import { refineFormulaCropBounds } from '../../entrypoints/pdf/formulaCrop'

function raster(width: number, height: number, rectangles: Array<[number, number, number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const [left, top, right, bottom] of rectangles) {
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * width + x) * 4
        data[offset] = 0
        data[offset + 1] = 0
        data[offset + 2] = 0
      }
    }
  }
  return { data, width, height }
}

describe('PDF formula crop refinement', () => {
  it('removes a small fragment from the following equation', () => {
    const bounds = refineFormulaCropBounds(raster(180, 100, [
      [25, 24, 155, 56],
      [65, 79, 120, 84],
    ]), 2)

    expect(bounds.y).toBeLessThanOrEqual(18)
    expect(bounds.y + bounds.height).toBeLessThan(79)
  })

  it('keeps a nearby superscript with the main formula', () => {
    const bounds = refineFormulaCropBounds(raster(180, 90, [
      [112, 15, 130, 24],
      [28, 28, 152, 58],
    ]), 2)

    expect(bounds.y).toBeLessThanOrEqual(15)
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(58)
  })

  it('keeps two substantial rows in a genuine multi-line formula', () => {
    const bounds = refineFormulaCropBounds(raster(180, 110, [
      [22, 18, 158, 40],
      [30, 67, 150, 91],
    ]), 2)

    expect(bounds.y).toBeLessThanOrEqual(18)
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(91)
  })

  it('falls back to the original crop when no ink is detected', () => {
    expect(refineFormulaCropBounds(raster(120, 60, []), 2)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    })
  })
})
