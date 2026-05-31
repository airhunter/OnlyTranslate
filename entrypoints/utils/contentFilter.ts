const NOISE_TAGS = new Set(['nav', 'aside', 'footer', 'form', 'dialog']);
const NOISE_ROLES = new Set(['navigation', 'complementary', 'contentinfo', 'dialog']);

const SHARE_PATTERN = /\b(share|social|facebook|linkedin|twitter|x-platform|x platform|x\.com|medium|youtube|instagram|threads|mastodon|bluesky)\b/i;
const SOCIAL_LINK_PATTERN = /\b(facebook\.com|linkedin\.com|twitter\.com|x\.com|medium\.com|youtube\.com|youtu\.be|instagram\.com|threads\.net|mastodon\.social|bsky\.app)\b/i;
const TAG_PATTERN = /\b(tag|tags|topic|topics|category|categories|taxonomy|pill|chip)\b/i;
const PROMO_PATTERN = /\b(subscribe|newsletter|promo|promotion|sponsor|sponsored|advertis|write for|submit|author program|payment program|membership|sign up|join|contribute)\b/i;
const RELATED_PATTERN = /\b(related|recommend|recommended|more from|read next)\b/i;
const WEAK_RELATED_PATTERN = /\b(popular|trending)\b/i;
const AUTHOR_PATTERN = /\b(written by|see all from|byline|author-card|author card|author)\b/i;

export type ContentFilterDecision = 'keep' | 'skip-self' | 'skip-subtree';

interface BlockMetrics {
    text: string;
    textLength: number;
    linkDensity: number;
    linkCount: number;
    buttonCount: number;
    shortInteractiveCount: number;
    longParagraphCount: number;
    hasCodeOrTable: boolean;
    hasSocialLinks: boolean;
}

export function getContentFilterDecision(element: Element): ContentFilterDecision {
    const tag = element.tagName.toLowerCase();
    if (NOISE_TAGS.has(tag)) return 'skip-subtree';

    const role = element.getAttribute('role')?.toLowerCase();
    if (role && NOISE_ROLES.has(role)) return 'skip-subtree';

    const metrics = getBlockMetrics(element);
    if (metrics.textLength === 0) return 'keep';

    const structuralHint = getElementStructuralSignalText(element);
    const hint = getElementSignalText(element, metrics.text);

    if (isShareBlock(hint, metrics)) return 'skip-self';
    if (isTagCluster(hint, metrics)) return 'skip-self';
    if (isAuthorOrBylineBlock(hint, metrics)) return 'skip-self';
    if (isPromoOrCtaBlock(hint, metrics)) return 'skip-self';
    if (isRelatedBlock(element, hint, structuralHint, metrics)) return 'skip-self';

    return 'keep';
}

export function shouldSkipContentBlock(element: Element): boolean {
    return getContentFilterDecision(element) !== 'keep';
}

function isShareBlock(hint: string, metrics: BlockMetrics): boolean {
    if (!SHARE_PATTERN.test(hint) && !metrics.hasSocialLinks) return false;
    return metrics.longParagraphCount === 0
        && (metrics.hasSocialLinks || metrics.linkCount > 0 || metrics.buttonCount > 0 || metrics.shortInteractiveCount > 0);
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
    const hasReadableArticleShape = metrics.longParagraphCount >= 2 && metrics.linkDensity < 0.45;

    if (hasReadableArticleShape) return false;

    return hasAction || metrics.longParagraphCount < 2;
}

function isAuthorOrBylineBlock(hint: string, metrics: BlockMetrics): boolean {
    if (!AUTHOR_PATTERN.test(hint)) return false;
    if (metrics.longParagraphCount > 0 || metrics.hasCodeOrTable) return false;

    return metrics.textLength <= 260
        || metrics.linkCount > 0
        || metrics.buttonCount > 0
        || metrics.shortInteractiveCount > 0;
}

function isRelatedBlock(element: Element, hint: string, structuralHint: string, metrics: BlockMetrics): boolean {
    const hasStrongRelatedSignal = RELATED_PATTERN.test(hint);
    const hasWeakRelatedSignal = WEAK_RELATED_PATTERN.test(hint);
    if (!hasStrongRelatedSignal && !hasWeakRelatedSignal) return false;
    if (
        hasWeakRelatedSignal
        && !hasStrongRelatedSignal
        && !WEAK_RELATED_PATTERN.test(structuralHint)
        && isReadableParagraphLeaf(element, metrics)
    ) {
        return false;
    }
    if (metrics.longParagraphCount >= 2 && metrics.linkDensity < 0.45) return false;

    return metrics.linkCount > 0 || metrics.shortInteractiveCount > 0;
}

function isReadableParagraphLeaf(element: Element, metrics: BlockMetrics): boolean {
    return element.matches('p, blockquote, figcaption')
        && metrics.textLength >= 80
        && metrics.linkDensity < 0.45;
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

    const paragraphLikeBlocks = [
        ...(element.matches('p, blockquote, figcaption') ? [element] : []),
        ...Array.from(element.querySelectorAll('p, blockquote, figcaption'))
    ];
    const longParagraphCount = paragraphLikeBlocks
        .filter((item) => getNormalizedText(item).length >= 80).length;

    return {
        text,
        textLength,
        linkDensity: textLength > 0 ? linkTextLength / textLength : 0,
        linkCount: links.length,
        buttonCount: buttons.length,
        shortInteractiveCount,
        longParagraphCount,
        hasCodeOrTable: element.querySelector('pre, code, table') !== null,
        hasSocialLinks: links.some(link => SOCIAL_LINK_PATTERN.test(link.getAttribute('href') ?? ''))
    };
}

function getElementSignalText(element: Element, text: string): string {
    return `${getElementStructuralSignalText(element)} ${text}`;
}

function getElementStructuralSignalText(element: Element): string {
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

    return `${attrs.join(' ')} ${hrefs}`;
}

function getNormalizedText(element: Element): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
