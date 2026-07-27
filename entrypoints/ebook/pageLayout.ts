const IMAGE_PAGE_TYPES = new Set(['cover', 'titlepage']);
const PAGE_PADDING = 24;

export interface EbookViewportSize {
  width: number;
  height: number;
}

function hasImagePageType(element: Element): boolean {
  return (element.getAttribute('epub:type') ?? '')
    .split(/\s+/)
    .some(type => IMAGE_PAGE_TYPES.has(type));
}

/**
 * Fits semantic cover and title pages to the real rendition viewport.
 *
 * epub.js measures reflowable images before a scrolled iframe has expanded,
 * which can leave viewport-sized artwork with a near-zero max-height.
 */
export function fitEbookImagePage(document: Document, viewport: EbookViewportSize): boolean {
  if (viewport.width <= 0 || viewport.height <= 0 || !document.body) return false;

  const pageRoot = [document.body, ...Array.from(document.querySelectorAll('section,figure'))]
    .find(hasImagePageType);
  if (!pageRoot) return false;

  const images = Array.from(pageRoot.querySelectorAll<HTMLImageElement>('img'));
  const visibleText = (pageRoot.textContent ?? '').replace(/\s+/g, '').trim();
  if (images.length !== 1 || visibleText) return false;

  const availableWidth = Math.max(1, Math.floor(viewport.width) - PAGE_PADDING * 2);
  const availableHeight = Math.max(1, Math.floor(viewport.height) - PAGE_PADDING * 2);
  const body = document.body;
  const image = images[0];
  const figure = image.closest('figure');

  document.documentElement.dataset.onlytranslateEbookImagePage = 'true';
  document.documentElement.style.setProperty('min-height', `${Math.floor(viewport.height)}px`, 'important');
  body.style.setProperty('box-sizing', 'border-box', 'important');
  body.style.setProperty('display', 'grid', 'important');
  body.style.setProperty('place-items', 'center', 'important');
  body.style.setProperty('min-height', `${Math.floor(viewport.height)}px`, 'important');
  body.style.setProperty('margin', '0', 'important');
  body.style.setProperty('padding', `${PAGE_PADDING}px`, 'important');

  if (pageRoot !== body) {
    (pageRoot as HTMLElement).style.setProperty('display', 'grid', 'important');
    (pageRoot as HTMLElement).style.setProperty('place-items', 'center', 'important');
    (pageRoot as HTMLElement).style.setProperty('width', '100%', 'important');
    (pageRoot as HTMLElement).style.setProperty('min-height', `${availableHeight}px`, 'important');
  }
  if (figure) {
    figure.style.setProperty('display', 'grid', 'important');
    figure.style.setProperty('place-items', 'center', 'important');
    figure.style.setProperty('width', '100%', 'important');
    figure.style.setProperty('margin', '0', 'important');
  }

  image.style.setProperty('display', 'block', 'important');
  image.style.setProperty('width', '100%', 'important');
  image.style.setProperty('height', `${availableHeight}px`, 'important');
  image.style.setProperty('max-width', `${availableWidth}px`, 'important');
  image.style.setProperty('max-height', `${availableHeight}px`, 'important');
  image.style.setProperty('object-fit', 'contain', 'important');
  image.style.setProperty('margin', 'auto', 'important');
  return true;
}
