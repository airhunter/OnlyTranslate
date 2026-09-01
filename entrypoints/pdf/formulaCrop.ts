export interface FormulaCropImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface FormulaCropBounds {
  x: number
  y: number
  width: number
  height: number
}

interface InkBand {
  start: number
  end: number
  mass: number
}

function fullBounds(width: number, height: number): FormulaCropBounds {
  return { x: 0, y: 0, width, height }
}

function isInk(data: Uint8ClampedArray, offset: number): boolean {
  if (data[offset + 3] < 24) return false
  return data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245
}

function collectInkBands(rowInk: number[], activeThreshold: number, mergeGap: number): InkBand[] {
  const rawBands: InkBand[] = []
  let current: InkBand | undefined
  rowInk.forEach((mass, row) => {
    if (mass < activeThreshold) {
      if (current) {
        rawBands.push(current)
        current = undefined
      }
      return
    }
    if (!current) current = { start: row, end: row, mass: 0 }
    current.end = row
    current.mass += mass
  })
  if (current) rawBands.push(current)

  const merged: InkBand[] = []
  for (const band of rawBands) {
    const previous = merged.at(-1)
    if (previous && band.start - previous.end - 1 <= mergeGap) {
      previous.end = band.end
      previous.mass += band.mass
    }
    else {
      merged.push({ ...band })
    }
  }
  return merged
}

/**
 * Tightens a rendered formula crop and removes low-mass fragments from an
 * adjacent equation only when a clear blank separator exists. Substantial
 * neighboring bands are retained so matrices and genuine multi-line formulas
 * fall back to a single, complete crop.
 */
export function refineFormulaCropBounds(
  image: FormulaCropImage,
  cssPixelScale: number,
): FormulaCropBounds {
  const { data, width, height } = image
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return fullBounds(width, height)

  const rowInk = Array.from({ length: height }, () => 0)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isInk(data, (y * width + x) * 4)) rowInk[y] += 1
    }
  }

  const scale = Math.max(1, cssPixelScale)
  const activeThreshold = Math.max(2, Math.round(width * 0.0012))
  const mergeGap = Math.max(2, Math.round(scale * 1.5))
  const bands = collectInkBands(rowInk, activeThreshold, mergeGap)
  if (!bands.length) return fullBounds(width, height)

  const imageCenter = height / 2
  const mainIndex = bands.reduce((bestIndex, band, index) => {
    const center = (band.start + band.end) / 2
    const centerWeight = 1 - Math.min(0.35, Math.abs(center - imageCenter) / Math.max(1, height) * 0.7)
    const score = band.mass * centerWeight
    const best = bands[bestIndex]
    const bestCenter = (best.start + best.end) / 2
    const bestWeight = 1 - Math.min(0.35, Math.abs(bestCenter - imageCenter) / Math.max(1, height) * 0.7)
    return score > best.mass * bestWeight ? index : bestIndex
  }, 0)
  const main = bands[mainIndex]
  const mainHeight = main.end - main.start + 1
  const closeGap = Math.max(mergeGap, Math.round(scale * 3))
  const substantial = (band: InkBand) => (
    band.mass >= main.mass * 0.38
    || band.end - band.start + 1 >= mainHeight * 0.58
  )

  let first = mainIndex
  let last = mainIndex
  while (first > 0) {
    const candidate = bands[first - 1]
    const gap = bands[first].start - candidate.end - 1
    if (gap > closeGap && !substantial(candidate)) break
    first -= 1
  }
  while (last < bands.length - 1) {
    const candidate = bands[last + 1]
    const gap = candidate.start - bands[last].end - 1
    if (gap > closeGap && !substantial(candidate)) break
    last += 1
  }

  const selectedTop = bands[first].start
  const selectedBottom = bands[last].end
  let minX = width
  let maxX = -1
  for (let y = selectedTop; y <= selectedBottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInk(data, (y * width + x) * 4)) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
  }
  if (maxX < minX) return fullBounds(width, height)

  const padding = Math.max(2, Math.round(scale * 3))
  const x = Math.max(0, minX - padding)
  const y = Math.max(0, selectedTop - padding)
  const right = Math.min(width, maxX + 1 + padding)
  const bottom = Math.min(height, selectedBottom + 1 + padding)
  const refined = { x, y, width: right - x, height: bottom - y }
  if (refined.width < scale * 6 || refined.height < scale * 6) return fullBounds(width, height)
  return refined
}
