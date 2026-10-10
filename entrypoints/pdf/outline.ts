import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist'
import type { PdfTextBlock } from './layout'

export interface PdfOutlineItem {
  id: string
  title: string
  dest: string | unknown[] | null
  items: PdfOutlineItem[]
}

export interface PdfOutlineTarget {
  pageNumber: number
  // Fractions of the displayed page, after crop and rotation are applied.
  x: number
  y: number
}

type OutlineDocument = Pick<PDFDocumentProxy, 'numPages' | 'getOutline' | 'getDestination' | 'getPageIndex' | 'getPage'>

export function pdfDestinationAnchor(dest: unknown[], viewport: PageViewport): Pick<PdfOutlineTarget, 'x' | 'y'> {
  const type = (dest[1] as { name?: string } | undefined)?.name
  const [left, bottom, right, top] = viewport.viewBox
  const coordinate = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback
  let bounds: number[]
  switch (type) {
    case 'XYZ':
      bounds = [coordinate(dest[2], left), coordinate(dest[3], top)]
      break
    case 'FitH':
    case 'FitBH':
      bounds = [left, coordinate(dest[2], top), right, coordinate(dest[2], top)]
      break
    case 'FitV':
    case 'FitBV':
      bounds = [coordinate(dest[2], left), bottom, coordinate(dest[2], left), top]
      break
    case 'FitR':
      bounds = [coordinate(dest[2], left), coordinate(dest[3], bottom), coordinate(dest[4], right), coordinate(dest[5], top)]
      break
    default:
      return { x: 0, y: 0 }
  }
  const first = viewport.convertToViewportPoint(bounds[0], bounds[1])
  const second = bounds.length === 4 ? viewport.convertToViewportPoint(bounds[2], bounds[3]) : first
  const clamp = (value: number): number => Math.min(1, Math.max(0, value))
  return {
    x: clamp(Math.min(first[0], second[0]) / viewport.width),
    y: clamp(Math.min(first[1], second[1]) / viewport.height),
  }
}

// Each instance belongs to one open document, so late lookups cannot populate
// the next document's cache. Destinations are resolved only when selected.
export class PdfOutlineController {
  private readonly targets = new Map<string, Promise<PdfOutlineTarget | undefined>>()

  constructor(private readonly document: OutlineDocument) {}

  async getItems(): Promise<PdfOutlineItem[]> {
    const mapItems = (items: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>, parent = ''): PdfOutlineItem[] => {
      return (items ?? []).map((item, index) => {
        const id = `${parent}${index}`
        return {
          id,
          title: item.title,
          dest: item.dest,
          items: mapItems(item.items, `${id}.`),
        }
      })
    }
    return mapItems(await this.document.getOutline())
  }

  resolveTarget(item: PdfOutlineItem): Promise<PdfOutlineTarget | undefined> {
    if (!item.dest) return Promise.resolve(undefined)
    const cached = this.targets.get(item.id)
    if (cached) return cached
    const lookup = this.resolveDestination(item.dest)
    this.targets.set(item.id, lookup)
    // Allow retrying transient errors (for example a remote range request).
    void lookup.catch(() => this.targets.delete(item.id))
    return lookup
  }

  private async resolveDestination(destination: string | unknown[]): Promise<PdfOutlineTarget | undefined> {
    const dest = typeof destination === 'string' ? await this.document.getDestination(destination) : destination
    if (!Array.isArray(dest) || !dest.length) return undefined
    const ref = dest[0]
    let pageIndex: number
    if (typeof ref === 'number' && Number.isInteger(ref)) pageIndex = ref
    else if (ref && typeof ref === 'object' && Number.isInteger(ref.num) && Number.isInteger(ref.gen)) {
      pageIndex = await this.document.getPageIndex(ref)
    }
    else return undefined
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= this.document.numPages) return undefined
    const pageNumber = pageIndex + 1
    const page = await this.document.getPage(pageNumber)
    return { pageNumber, ...pdfDestinationAnchor(dest, page.getViewport({ scale: 1 })) }
  }
}

export function findPdfOutlineBlock<T extends Pick<PdfTextBlock, 'id' | 'x' | 'y' | 'width' | 'height'>>(
  blocks: readonly T[], target: PdfOutlineTarget, pageWidth: number, pageHeight: number,
): T | undefined {
  if (!blocks.length || pageWidth <= 0 || pageHeight <= 0 || (target.x === 0 && target.y === 0)) return undefined
  const x = target.x * pageWidth
  const y = target.y * pageHeight
  const distance = (block: T): number => {
    const dx = Math.max(block.x - x, 0, x - block.x - block.width)
    const dy = Math.max(block.y - y, 0, y - block.y - block.height)
    return Math.hypot(dx, dy)
  }
  return blocks.reduce((nearest, block) => distance(block) < distance(nearest) ? block : nearest)
}
