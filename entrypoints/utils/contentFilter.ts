import {
    getProseEvidence,
    getStructuralHint,
    type ProseEvidence
} from '@/entrypoints/utils/proseSignals';

const NOISE_TAGS = new Set(['nav', 'aside', 'footer', 'form', 'dialog']);
const NOISE_ROLES = new Set(['navigation', 'complementary', 'contentinfo', 'dialog']);

const SHARE_PATTERN = /\b(share|social|facebook|linkedin|twitter|x-platform|x platform|x\.com|medium|youtube|instagram|threads|mastodon|bluesky)\b/i;
const SOCIAL_LINK_PATTERN = /\b(facebook\.com|linkedin\.com|twitter\.com|x\.com|medium\.com|youtube\.com|youtu\.be|instagram\.com|threads\.net|mastodon\.social|bsky\.app)\b/i;
const TAG_PATTERN = /\b(tag|tags|topic|topics|category|categories|taxonomy|pill|chip)\b/i;
const PROMO_PATTERN = /\b(subscribe|newsletter|promo|promotion|sponsor|sponsored|ad|ads|advert|advertisement|advertising|write for|submit|author program|payment program|membership|sign up|join|contribute)\b/i;
const RELATED_PATTERN = /\b(related|recommend|recommended|more from|read next)\b/i;
const WEAK_RELATED_PATTERN = /\b(popular|trending)\b/i;
const AUTHOR_PATTERN = /\b(written by|see all from|byline|author-card|author card|author)\b/i;
export type ContentFilterDecision = 'keep' | 'skip-self' | 'skip-subtree';

// getBlockMetrics 对每个元素都要做多次全子树 querySelectorAll，并对每个段落级后代再算一次 prose evidence，
// 单次调用就是 O(子树) ~ O(子树²)。而 hasContentFilterSkipSelfAncestor / findDirectTextRunTarget 会为每个候选节点
// 一路回溯到根，逐个祖先触发 getContentFilterDecision，等于把整棵树的 block metrics 反复重算。
// 在 docs.devin.ai/changelog 这类长文档（数千节点）上这会退化成超线性，直接把主线程冻死数分钟。
// 这些信号都是元素结构的纯函数，在一次扫描内 DOM 基本稳定，因此按元素做记忆化即可把总开销压回线性。
const blockMetricsCache = new WeakMap<Element, BlockMetrics>();
const proseEvidenceCache = new WeakMap<Element, ProseEvidence>();
const normalizedTextCache = new WeakMap<Element, string>();

function getCachedProseEvidence(element: Element): ProseEvidence {
    const cached = proseEvidenceCache.get(element);
    if (cached) return cached;
    const evidence = getProseEvidence(element);
    proseEvidenceCache.set(element, evidence);
    return evidence;
}

// 与 scanContext.invalidateScanCache 对齐：当某个元素子树发生变化、需要重新扫描时，
// 必须同步清掉这里的按元素缓存，否则动态重扫会读到过期的 block metrics。
export function invalidateContentFilterCache(element: Element): void {
    blockMetricsCache.delete(element);
    proseEvidenceCache.delete(element);
    normalizedTextCache.delete(element);
}

interface BlockMetrics {
    text: string;
    textLength: number;
    linkDensity: number;
    linkCount: number;
    buttonCount: number;
    shortInteractiveCount: number;
    interactiveSignalText: string;
    longParagraphCount: number;
    hasCodeOrTable: boolean;
    hasSocialLinks: boolean;
    proseEvidence: ProseEvidence;
}

export function getContentFilterDecision(element: Element): ContentFilterDecision {
    const tag = element.tagName.toLowerCase();
    if (NOISE_TAGS.has(tag)) return 'skip-subtree';

    const role = element.getAttribute('role')?.toLowerCase();
    if (role && NOISE_ROLES.has(role)) return 'skip-subtree';

    const metrics = getBlockMetrics(element);
    if (metrics.textLength === 0) return 'keep';

    const structuralHint = getElementStructuralSignalText(element);
    const hint = structuralHint;

    if (isShareBlock(element, hint, metrics)) return 'skip-self';
    if (isTagCluster(element, hint, metrics)) return 'skip-self';
    if (isAuthorOrBylineBlock(hint, metrics)) return 'skip-self';
    if (isPromoOrCtaBlock(element, hint, metrics)) return 'skip-self';
    if (isRelatedBlock(element, hint, structuralHint, metrics)) return 'skip-self';

    return 'keep';
}

export function shouldSkipContentBlock(element: Element): boolean {
    return getContentFilterDecision(element) !== 'keep';
}

function isShareBlock(element: Element, hint: string, metrics: BlockMetrics): boolean {
    if (isReadableParagraphLeaf(element, metrics)) return false;
    const hasShareSignal = SHARE_PATTERN.test(hint)
        || SHARE_PATTERN.test(metrics.interactiveSignalText)
        || metrics.hasSocialLinks;
    if (!hasShareSignal) return false;
    // 真正的分享条是紧凑的交互控件；若容器内含有可读段落/列表正文，则它是内容区而非分享控件。
    // 否则像 docs.devin.ai/changelog 这种短文档：整页内容区因为夹带一个社交链接 + 大量版本徽章/下载按钮、
    // 且无长段落（longParagraphCount=0），会被整体误判为分享块 skip-self，导致正文被大面积漏翻。
    if (hasReadableParagraphDescendant(element)) return false;
    if (
        metrics.proseEvidence.strength === 'strong'
        && !SHARE_PATTERN.test(metrics.interactiveSignalText)
        && !metrics.hasSocialLinks
    ) {
        return false;
    }
    if (metrics.buttonCount > 0 && metrics.shortInteractiveCount > 0 && metrics.longParagraphCount <= 1) return true;
    return metrics.longParagraphCount === 0
        && (metrics.hasSocialLinks || metrics.linkCount > 0 || metrics.buttonCount > 0 || metrics.shortInteractiveCount > 0);
}

function hasReadableParagraphDescendant(element: Element): boolean {
    return Array.from(element.querySelectorAll('p, blockquote, li, figcaption'))
        .some(item => isReadableParagraphLeaf(item, getBlockMetrics(item)));
}

function isTagCluster(element: Element, hint: string, metrics: BlockMetrics): boolean {
    if (isNestedListItem(element)) return false;
    if (metrics.longParagraphCount > 0 || metrics.hasCodeOrTable) return false;
    if (metrics.linkCount < 3 && metrics.shortInteractiveCount < 3) return false;

    const hasTagHint = TAG_PATTERN.test(hint);
    const looksLikePills = metrics.shortInteractiveCount >= 3
        && metrics.textLength <= 220
        && metrics.linkDensity >= 0.45;

    return hasTagHint || looksLikePills;
}

function isNestedListItem(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if ((tag === 'ul' || tag === 'ol') && element.parentElement?.tagName.toLowerCase() === 'li') return true;
    if (tag !== 'li') return false;

    return Array.from(element.children).some(child => {
        const childTag = child.tagName.toLowerCase();
        return childTag === 'ul' || childTag === 'ol';
    });
}

function isPromoOrCtaBlock(element: Element, hint: string, metrics: BlockMetrics): boolean {
    if (!PROMO_PATTERN.test(hint)) return false;
    if (metrics.hasCodeOrTable) return false;
    if (isReadableParagraphLeaf(element, metrics)) return false;

    const hasAction = metrics.linkCount > 0 || metrics.buttonCount > 0;
    const hasReadableArticleShape = metrics.longParagraphCount >= 2 && metrics.linkDensity < 0.45;

    if (!hasAction) return false;
    if (hasReadableArticleShape) return false;

    return true;
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
    return metrics.proseEvidence.strength === 'strong'
        && metrics.proseEvidence.isParagraphLike;
}

function getBlockMetrics(element: Element): BlockMetrics {
    const cached = blockMetricsCache.get(element);
    if (cached) return cached;

    const metrics = computeBlockMetrics(element);
    blockMetricsCache.set(element, metrics);
    return metrics;
}

function computeBlockMetrics(element: Element): BlockMetrics {
    const text = getNormalizedText(element);
    const proseEvidence = getCachedProseEvidence(element);
    const textLength = text.length;
    const links = Array.from(element.querySelectorAll('a'));
    const buttons = Array.from(element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    const interactive = [...links, ...buttons];

    const linkTextLength = links.reduce((sum, link) => sum + getNormalizedText(link).length, 0);
    const shortInteractiveCount = interactive.filter((item) => {
        const itemText = getNormalizedText(item);
        return itemText.length > 0 && itemText.length <= 32;
    }).length;
    const interactiveSignalText = interactive
        .map(item => getNormalizedText(item))
        .join(' ');

    const paragraphLikeBlocks = [
        ...(proseEvidence.strength === 'strong' && proseEvidence.isParagraphLike ? [element] : []),
        ...Array.from(element.querySelectorAll('p, blockquote, figcaption, div'))
            .filter(item => {
                const evidence = getCachedProseEvidence(item);
                return evidence.strength === 'strong' && evidence.isParagraphLike;
            })
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
        interactiveSignalText,
        longParagraphCount,
        hasCodeOrTable: element.querySelector('pre, code, table') !== null,
        hasSocialLinks: links.some(link => SOCIAL_LINK_PATTERN.test(link.getAttribute('href') ?? '')),
        proseEvidence
    };
}

function getElementStructuralSignalText(element: Element): string {
    return getStructuralHint(element);
}

function getNormalizedText(element: Element): string {
    const cached = normalizedTextCache.get(element);
    if (cached !== undefined) return cached;
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    normalizedTextCache.set(element, text);
    return text;
}
