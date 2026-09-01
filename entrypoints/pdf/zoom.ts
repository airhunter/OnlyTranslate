export const PDF_ORIGINAL_ZOOM_MIN = 0.5
export const PDF_ORIGINAL_ZOOM_MAX = 3

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizePdfWheelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * 100
  return deltaY
}

export function resolvePdfWheelZoom(currentZoom: number, deltaY: number, deltaMode = 0): number {
  const normalizedDelta = clamp(normalizePdfWheelDelta(deltaY, deltaMode), -100, 100)
  if (!normalizedDelta) return currentZoom
  const nextZoom = currentZoom * Math.exp(-normalizedDelta * 0.002)
  return Math.round(clamp(nextZoom, PDF_ORIGINAL_ZOOM_MIN, PDF_ORIGINAL_ZOOM_MAX) * 100) / 100
}

export function normalizedPdfPageAnchor(pointer: number, pageStart: number, pageSize: number): number {
  if (pageSize <= 0) return 0.5
  return clamp((pointer - pageStart) / pageSize, 0, 1)
}
