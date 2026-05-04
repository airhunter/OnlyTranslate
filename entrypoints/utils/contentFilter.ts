const NOISE_TAGS = new Set(['nav', 'aside', 'footer', 'form', 'dialog']);
const NOISE_ROLES = new Set(['navigation', 'complementary', 'contentinfo', 'dialog']);

const SHARE_PATTERN = /\b(share|social|facebook|linkedin|twitter|x-platform|x platform|x\.com)\b/i;
const TAG_PATTERN = /\b(tag|tags|topic|topics|category|categories|taxonomy|pill|chip)\b/i;
const PROMO_PATTERN = /\b(subscribe|newsletter|promo|promotion|sponsor|sponsored|advertis|write for|submit|author program|payment program|membership|sign up|join|contribute)\b/i;
const RELATED_PATTERN = /\b(related|recommend|recommended|more from|read next|popular|trending)\b/i;

interface BlockMetrics {
    text: string;
    textLength: number;
    linkDensity: number;
    linkCount: number;
    buttonCount: number;
    shortInteractiveCount: number;
    longParagraphCount: number;
    hasCodeOrTable: boolean;
}

export function shouldSkipContentBlock(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (NOISE_TAGS.has(tag)) return true;

    const role = element.getAttribute('role')?.toLowerCase();
    if (role && NOISE_ROLES.has(role)) return true;

    const metrics = getBlockMetrics(element);
    if (metrics.textLength === 0) return false;

    const hint = getElementSignalText(element, metrics.text);

    if (isShareBlock(hint, metrics)) return true;
    if (isTagCluster(hint, metrics)) return true;
    if (isPromoOrCtaBlock(hint, metrics)) return true;
    if (isRelatedBlock(hint, metrics)) return true;

    return false;
}

function isShareBlock(hint: string, metrics: BlockMetrics): boolean {
    if (!SHARE_PATTERN.test(hint)) return false;
    return metrics.longParagraphCount === 0
        && (metrics.linkCount > 0 || metrics.buttonCount > 0 || metrics.shortInteractiveCount > 0);
}

function isTagCluster(hint: string, metrics: BlockMetrics): boolean {
    if (metrics.longParagraphCount > 0 || metrics.hasCodeOrTable) return false;
    if (metrics.linkCount < 3 && metrics.shortInteractiveCount < 3) return false;

    const hasTagHint = TAG_PATTERN.test(hint);
    const looksLikePills = metrics.shortInteractiveCount >= 3
        && metrics.textLength <= 220
        && metrics.linkDensity >= 0.45;

    return hasTagHint || looksLikePills;
}

function isPromoOrCtaBlock(hint: string, metrics: BlockMetrics): boolean {
    if (!PROMO_PATTERN.test(hint)) return false;
    if (metrics.hasCodeOrTable) return false;

    const hasAction = metrics.linkCount > 0 || metrics.buttonCount > 0;
    const hasReadableArticleShape = metrics.longParagraphCount >= 2 && metrics.linkDensity < 0.25;

    return hasAction || !hasReadableArticleShape;
}

function isRelatedBlock(hint: string, metrics: BlockMetrics): boolean {
    if (!RELATED_PATTERN.test(hint)) return false;
    if (metrics.longParagraphCount >= 2 && metrics.linkDensity < 0.25) return false;

    return metrics.linkCount > 0 || metrics.shortInteractiveCount > 0;
}

function getBlockMetrics(element: Element): BlockMetrics {
    const text = getNormalizedText(element);
    const textLength = text.length;
    const links = Array.from(element.querySelectorAll('a'));
    const buttons = Array.from(element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    const interactive = [...links, ...buttons];

    const linkTextLength = links.reduce((sum, link) => sum + getNormalizedText(link).length, 0);
    const shortInteractiveCount = interactive.filter((item) => {
        const itemText = getNormalizedText(item);
        return itemText.length > 0 && itemText.length <= 32;
    }).length;

    const longParagraphCount = Array.from(
        element.querySelectorAll('p, blockquote, figcaption')
    ).filter((item) => getNormalizedText(item).length >= 80).length;

    return {
        text,
        textLength,
        linkDensity: textLength > 0 ? linkTextLength / textLength : 0,
        linkCount: links.length,
        buttonCount: buttons.length,
        shortInteractiveCount,
        longParagraphCount,
        hasCodeOrTable: element.querySelector('pre, code, table') !== null
    };
}

function getElementSignalText(element: Element, text: string): string {
    const attrs = [
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('role') ?? '',
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('title') ?? ''
    ];

    const hrefs = Array.from(element.querySelectorAll('a'))
        .map((link) => link.getAttribute('href') ?? '')
        .join(' ');

    return `${attrs.join(' ')} ${text} ${hrefs}`;
}

function getNormalizedText(element: Element): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
