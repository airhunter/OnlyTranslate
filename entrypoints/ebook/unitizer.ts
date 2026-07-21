import { sanitizeTranslatedInlineHtml } from './sanitizer';

const UNIT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th';
const PROTECTED_SELECTOR = 'code,kbd,samp,var,math,svg';
const INLINE_TAGS = [
  'a', 'abbr', 'b', 'br', 'cite', 'del', 'em', 'i', 'ins', 'mark', 'q', 'rp', 'rt',
  'ruby', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u',
];

export interface EbookTranslationUnit {
  id: string;
  element: HTMLElement;
  sourceText: string;
  sourceHtml: string;
  placeholders: Map<string, string>;
  translationElement?: HTMLElement;
  failed?: boolean;
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const inlineStyle = element.style;
  if (inlineStyle.display === 'none' || inlineStyle.visibility === 'hidden') return false;
  try {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  } catch {
    return true;
  }
}

function hasTranslatableText(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 && /[\p{L}\p{N}]/u.test(normalized);
}

function buildSource(element: HTMLElement): { html: string; placeholders: Map<string, string> } {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-onlytranslate-ebook-translation]').forEach(node => node.remove());
  const placeholders = new Map<string, string>();
  clone.querySelectorAll(PROTECTED_SELECTOR).forEach((node, index) => {
    const token = `{{ONLYTRANSLATE_PROTECTED_${index}}}`;
    placeholders.set(token, (node as HTMLElement).outerHTML);
    node.replaceWith(clone.ownerDocument.createTextNode(token));
  });
  clone.querySelectorAll('*').forEach(node => {
    if (!INLINE_TAGS.includes(node.tagName.toLocaleLowerCase())) node.replaceWith(...Array.from(node.childNodes));
  });
  return {
    html: sanitizeTranslatedInlineHtml(clone.innerHTML).trim(),
    placeholders,
  };
}

export function collectEbookTranslationUnits(document: Document): EbookTranslationUnit[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(UNIT_SELECTOR));
  return candidates
    .filter(element => !element.matches('[data-onlytranslate-ebook-translation]'))
    .filter(element => !element.closest('[data-onlytranslate-ebook-translation], [translate="no"], .notranslate'))
    .filter(element => !element.querySelector(UNIT_SELECTOR))
    .filter(element => isVisible(element) && hasTranslatableText(element.textContent ?? ''))
    .map((element, index) => {
      const { html, placeholders } = buildSource(element);
      element.dataset.onlytranslateEbookOriginal = 'true';
      return {
        id: `ebook-unit-${index}`,
        element,
        sourceText: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        sourceHtml: html,
        placeholders,
      };
    });
}

export function hasAllPlaceholders(value: string, placeholders: Map<string, string>): boolean {
  return Array.from(placeholders.keys()).every(token => value.includes(token));
}

function restoreProtectedNodes(container: HTMLElement, placeholders: Map<string, string>): void {
  if (placeholders.size === 0) return;
  const showText = container.ownerDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = container.ownerDocument.createTreeWalker(container, showText);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach(textNode => {
    const matchingTokens = Array.from(placeholders.keys()).filter(token => textNode.data.includes(token));
    if (matchingTokens.length === 0) return;
    const fragment = container.ownerDocument.createDocumentFragment();
    let remaining = textNode.data;
    while (remaining.length > 0) {
      const next = matchingTokens
        .map(token => ({ token, index: remaining.indexOf(token) }))
        .filter(match => match.index >= 0)
        .sort((left, right) => left.index - right.index)[0];
      if (!next) {
        fragment.append(remaining);
        break;
      }
      fragment.append(remaining.slice(0, next.index));
      const template = container.ownerDocument.createElement('template');
      template.innerHTML = placeholders.get(next.token) ?? '';
      fragment.append(template.content);
      remaining = remaining.slice(next.index + next.token.length);
    }
    textNode.replaceWith(fragment);
  });
}

export function insertEbookTranslation(unit: EbookTranslationUnit, translatedHtml: string): HTMLElement {
  unit.translationElement?.remove();
  const isTableCell = unit.element.matches('td,th');
  const translation = unit.element.ownerDocument.createElement(isTableCell ? 'div' : unit.element.tagName.toLocaleLowerCase());
  translation.className = 'onlytranslate-ebook-translation';
  translation.dataset.onlytranslateEbookTranslation = unit.id;
  translation.innerHTML = sanitizeTranslatedInlineHtml(translatedHtml);
  restoreProtectedNodes(translation, unit.placeholders);
  unit.element.classList.add('onlytranslate-ebook-has-translation');
  if (isTableCell) {
    let original = unit.element.querySelector<HTMLElement>(':scope > [data-onlytranslate-ebook-original-content]');
    if (!original) {
      original = unit.element.ownerDocument.createElement('div');
      original.dataset.onlytranslateEbookOriginalContent = 'true';
      const originalNodes = Array.from(unit.element.childNodes);
      original.append(...originalNodes);
      unit.element.append(original);
    }
    unit.element.append(translation);
  } else {
    unit.element.insertAdjacentElement('afterend', translation);
  }
  unit.translationElement = translation;
  unit.failed = false;
  return translation;
}

export function applyEbookDisplayMode(document: Document, display: number): void {
  document.documentElement.dataset.onlytranslateEbookDisplay = display === 0 ? 'translation' : 'bilingual';
}

export function isUnitVisible(unit: EbookTranslationUnit): boolean {
  const rect = unit.element.getBoundingClientRect();
  const viewportHeight = unit.element.ownerDocument.defaultView?.innerHeight ?? 0;
  return rect.bottom >= 0 && rect.top <= viewportHeight;
}
