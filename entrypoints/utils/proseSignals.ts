export const PROSE_TEXT_MIN = 80;
export const PROSE_TEXT_MIN_SHORT = 40;
export const MIN_PROSE_WORDS = 12;
export const MAX_INTERACTIVE_DENSITY = 0.45;

export const SENTENCE_PATTERN = /[.!?\u3002\uff01\uff1f]/;

export const INLINE_TEXT_TAGS = new Set([
    'a', 'b', 'strong', 'span', 'em', 'i', 'u', 'small', 'sub', 'sup',
    'font', 'mark', 'cite', 'q', 'abbr', 'time', 'ruby', 'bdi', 'bdo',
    'img', 'br', 'wbr', 'svg'
]);

const SEMANTIC_PARAGRAPH_TAGS = new Set([
    'p', 'blockquote', 'figcaption', 'li'
]);

const TEXT_BLOCK_DESCENDANT_SELECTOR = [
    'p',
    'blockquote',
    'figcaption',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'div'
].join(', ');

export type ProseStrength = 'none' | 'weak' | 'strong';

export interface ProseEvidence {
    text: string;
    textLength: number;
    linkTextLength: number;
    buttonTextLength: number;
    interactiveTextLength: number;
    linkDensity: number;
    interactiveDensity: number;
    linkCount: number;
    buttonCount: number;
    hasSentence: boolean;
    hasEnoughWords: boolean;
    isParagraphLike: boolean;
    hasParagraphDescendant: boolean;
    strength: ProseStrength;
}

export interface ProseEvidenceOptions {
    getText?: (element: Element) => string;
}

export function getProseEvidence(element: Element, options: ProseEvidenceOptions = {}): ProseEvidence {
    const text = getElementText(element, options);
    const textLength = text.length;
    const links = Array.from(element.querySelectorAll('a'));
    const buttons = Array.from(element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    const linkTextLength = links.reduce((sum, link) => sum + getElementText(link, options).length, 0);
    const buttonTextLength = buttons.reduce((sum, button) => sum + getElementText(button, options).length, 0);
    const interactiveTextLength = linkTextLength + buttonTextLength;
    const linkDensity = textLength > 0 ? linkTextLength / textLength : 0;
    const interactiveDensity = textLength > 0 ? interactiveTextLength / textLength : 0;
    const hasSentence = SENTENCE_PATTERN.test(text);
    const hasEnoughWords = getWordCount(text) >= MIN_PROSE_WORDS;
    const isParagraphLike = isParagraphLikeElement(element, text);
    const hasParagraphDescendant = hasReadableTextBlockDescendant(element, options);
    const hasLowInteractiveDensity = interactiveDensity < MAX_INTERACTIVE_DENSITY;
    const hasReadableShape = hasSentence || hasEnoughWords;
    const hasStrongLength = textLength >= PROSE_TEXT_MIN || (textLength >= PROSE_TEXT_MIN_SHORT && hasSentence);
    const hasWeakLength = textLength >= PROSE_TEXT_MIN_SHORT;
    const hasParagraphShape = isParagraphLike || hasParagraphDescendant;
    const strength: ProseStrength = hasLowInteractiveDensity
        && hasStrongLength
        && hasParagraphShape
        ? 'strong'
        : hasLowInteractiveDensity && hasWeakLength && hasReadableShape
            ? 'weak'
            : 'none';

    return {
        text,
        textLength,
        linkTextLength,
        buttonTextLength,
        interactiveTextLength,
        linkDensity,
        interactiveDensity,
        linkCount: links.length,
        buttonCount: buttons.length,
        hasSentence,
        hasEnoughWords,
        isParagraphLike,
        hasParagraphDescendant,
        strength
    };
}

export function getStructuralHint(element: Element): string {
    return [
        element.tagName.toLowerCase(),
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('role') ?? '',
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('title') ?? '',
        element.getAttribute('slot') ?? '',
        element.getAttribute('itemprop') ?? '',
        element.getAttribute('data-testid') ?? '',
        element.getAttribute('data-test-id') ?? '',
        element.getAttribute('data-component-name') ?? ''
    ].join(' ');
}

export function hasReadableSentence(text: string): boolean {
    return SENTENCE_PATTERN.test(text) || getWordCount(text) >= MIN_PROSE_WORDS;
}

export function hasSentencePunctuation(text: string): boolean {
    return SENTENCE_PATTERN.test(text);
}

export function isInlineOnlyElement(element: Element): boolean {
    return Array.from(element.children)
        .every(child => INLINE_TEXT_TAGS.has(child.tagName.toLowerCase()));
}

function getElementText(element: Element, options: ProseEvidenceOptions): string {
    return (options.getText?.(element) ?? element.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getWordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

function isParagraphLikeElement(element: Element, text: string): boolean {
    const tag = element.tagName.toLowerCase();
    if (SEMANTIC_PARAGRAPH_TAGS.has(tag)) return true;
    if (/^h[1-6]$/.test(tag)) return true;
    if (tag !== 'div') return false;
    if (text.length === 0) return false;
    return isInlineOnlyElement(element);
}

function hasReadableTextBlockDescendant(element: Element, options: ProseEvidenceOptions): boolean {
    return Array.from(element.querySelectorAll(TEXT_BLOCK_DESCENDANT_SELECTOR))
        .some(child => child !== element && getElementText(child, options).length >= PROSE_TEXT_MIN_SHORT);
}
