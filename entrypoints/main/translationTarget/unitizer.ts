import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';

export type DomUnitKind = 'block' | 'inline' | 'paragraph' | 'skip';

export interface DomTextUnit {
    element: Element;
    kind: DomUnitKind;
    reason: string;
}

const FORCE_BLOCK_TAGS = new Set([
    'article', 'section', 'main', 'div', 'p', 'li', 'ul', 'ol',
    'blockquote', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]);

const INLINE_TAGS = new Set([
    'a', 'b', 'strong', 'span', 'em', 'i', 'u', 'small', 'sub', 'sup',
    'font', 'mark', 'cite', 'q', 'abbr', 'time', 'ruby', 'bdi', 'bdo',
    'img', 'br', 'wbr', 'svg'
]);

const SKIP_SELECTOR = [
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'pre',
    'code',
    'table',
    'nav',
    'footer',
    'form',
    'button',
    '[role="navigation"]',
    '[role="toolbar"]',
    '[role="menu"]',
    '[role="tablist"]',
    '[hidden]',
    '[aria-hidden="true"]',
    '.notranslate',
    '[translate="no"]',
    `.${BILINGUAL_CONTENT_CLASS}`,
    `[${TRANSLATED_ATTR}="true"]`
].join(', ');

export function classifyDomUnit(element: Element): DomTextUnit {
    if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) {
        return { element, kind: 'skip', reason: 'skip-selector' };
    }

    const text = normalizeText(getUnitText(element));
    if (text.length < 3) return { element, kind: 'skip', reason: 'too-short' };

    const tag = element.tagName.toLowerCase();
    if (isInlineElement(element)) {
        return { element, kind: 'inline', reason: 'inline-display-or-tag' };
    }

    if (isParagraphElement(element)) {
        return { element, kind: 'paragraph', reason: 'paragraph-shape' };
    }

    if (FORCE_BLOCK_TAGS.has(tag) || getDisplay(element).includes('block')) {
        return { element, kind: 'block', reason: 'block-display-or-tag' };
    }

    return { element, kind: 'paragraph', reason: 'fallback-paragraph' };
}

export function collectDomTextUnits(root: ParentNode): Element[] {
    const elements = root instanceof Element
        ? [root, ...Array.from(root.querySelectorAll<Element>('*'))]
        : Array.from(root.querySelectorAll<Element>('*'));

    const result: Element[] = [];

    for (const element of elements) {
        if (result.some(parent => parent.contains(element))) continue;

        const unit = classifyDomUnit(element);
        if (unit.kind !== 'paragraph') continue;
        if (hasParagraphChild(element)) continue;

        result.push(element);
    }

    return result;
}

export function collectInlineTextRuns(root: Element): Element[][] {
    const runs: Element[][] = [];
    let currentRun: Element[] = [];

    for (const child of Array.from(root.children)) {
        const unit = classifyDomUnit(child);
        if (unit.kind === 'inline') {
            currentRun.push(child);
            continue;
        }

        if (currentRun.length > 0) {
            runs.push(currentRun);
            currentRun = [];
        }
    }

    if (currentRun.length > 0) runs.push(currentRun);
    return runs;
}

function isParagraphElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (['p', 'li', 'blockquote', 'figcaption'].includes(tag)) return true;
    if (/^h[1-6]$/.test(tag)) return true;
    if (isInlineElement(element)) return false;
    if (hasBlockChild(element)) return false;

    const text = normalizeText(getUnitText(element));
    return text.length >= 20 || /[.!?。！？]/.test(text);
}

function hasParagraphChild(element: Element): boolean {
    return Array.from(element.children).some(child => classifyDomUnit(child).kind === 'paragraph');
}

function hasBlockChild(element: Element): boolean {
    return Array.from(element.children).some(child => {
        const tag = child.tagName.toLowerCase();
        if (FORCE_BLOCK_TAGS.has(tag) && !INLINE_TAGS.has(tag)) return true;
        const display = getDisplay(child);
        return display.includes('block') || display === 'list-item' || display.includes('flex') || display.includes('grid');
    });
}

function isInlineElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return INLINE_TAGS.has(tag) || getDisplay(element).startsWith('inline');
}

function getDisplay(element: Element): string {
    try {
        return window.getComputedStyle(element).display;
    } catch (_) {
        return '';
    }
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function getUnitText(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll(SKIP_SELECTOR).forEach(node => node.remove());
    return clone.textContent ?? '';
}
