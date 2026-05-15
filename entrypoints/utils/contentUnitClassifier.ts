export type ContentUnitKind =
    | 'title'
    | 'subtitle'
    | 'content-card'
    | 'forum-topic'
    | 'forum-excerpt'
    | 'metadata'
    | 'ui'
    | 'noise';

export type ContentUnitAction = 'allow' | 'skip' | 'neutral';

export interface ContentUnitDecision {
    action: ContentUnitAction;
    kind?: ContentUnitKind;
    confidence: number;
    reasons: string[];
}

interface UnitMetrics {
    text: string;
    textLength: number;
    linkDensity: number;
    linkCount: number;
    buttonCount: number;
    childTextBlockCount: number;
    hasReadableSentence: boolean;
}

const READABLE_CONTAINER_PATTERN = /\b(article|content|story|post|body|entry|main|prose|markdown|readme|docs?|document)\b/i;
const TITLE_PATTERN = /\b(title|headline|heading|subject)\b/i;
const SUBTITLE_PATTERN = /\b(subtitle|sub-title|dek|standfirst|lead|summary|description|teaser|subhead|sub-head)\b/i;
const CARD_PATTERN = /\b(card|note|insight|callout|stage|step|flow|pipeline|panel|box|definition|warning|tip)\b/i;
const INTRO_CARD_PATTERN = /\b(welcome|intro|introduction|notice|announcement|message|alert|banner)\b/i;
const FORUM_TOPIC_PATTERN = /\b(topic|thread|discussion|post-title|raw-topic-link)\b/i;
const UI_PATTERN = /\b(nav|menu|toolbar|button|control|tab|tabs|dropdown|sidebar|side-bar|rail|login|sign|search|filter|sort|breadcrumb)\b/i;
const NOISE_PATTERN = /\b(share|social|subscribe|newsletter|sponsor|sponsored|advertis|promo|related|recommend|popular|trending|author-card)\b/i;
const META_PATTERN = /\b(meta|metadata|filename|file-name|information|informations|attachment|lightbox|caption-title|badge|tag|tags|category|categories|replies|views|activity|avatar|time|date|age|score|count|stats?)\b/i;
const STAT_TEXT_PATTERN = /^(replies|views|activity|latest|hot|categories|docs|tags|topics|users?|likes?|votes?|share|reply|more|sign up|log in)$/i;
const FILE_META_TEXT_PATTERN = /\b(\d+\s*[x×]\s*\d+|\d+(?:\.\d+)?\s*(kb|mb|gb)|no\s+llm|filename|download)\b/i;

export function classifyContentUnit(element: Element): ContentUnitDecision {
    const metrics = getUnitMetrics(element);
    if (metrics.textLength === 0) return neutral('empty');

    if (isStructuralUi(element)) return skip('ui', 0.98, 'structural-ui');
    if (isMetadataElement(element, metrics)) return skip('metadata', 0.92, 'metadata-signal');
    if (isNoiseElement(element, metrics)) return skip('noise', 0.9, 'noise-signal');

    const forumTopicScore = scoreForumTopic(element, metrics);
    if (forumTopicScore >= 6) {
        return allow('forum-topic', Math.min(0.96, forumTopicScore / 10), 'forum-topic-score');
    }

    const forumExcerptScore = scoreForumExcerpt(element, metrics);
    if (forumExcerptScore >= 6) {
        return allow('forum-excerpt', Math.min(0.94, forumExcerptScore / 10), 'forum-excerpt-score');
    }

    const titleScore = scoreTitle(element, metrics);
    if (titleScore >= 6) {
        return allow('title', Math.min(0.98, titleScore / 10), 'title-score');
    }

    const subtitleScore = scoreSubtitle(element, metrics);
    if (subtitleScore >= 6) {
        return allow('subtitle', Math.min(0.95, subtitleScore / 10), 'subtitle-score');
    }

    const cardScore = scoreContentCard(element, metrics);
    if (cardScore >= 7) {
        return allow('content-card', Math.min(0.94, cardScore / 11), 'content-card-score');
    }

    return neutral('no-strong-signal');
}

export function collectHighConfidenceReadingUnits(root: ParentNode = document.body): Element[] {
    const elements = root instanceof Element
        ? [root, ...Array.from(root.querySelectorAll<Element>('*'))]
        : Array.from(root.querySelectorAll<Element>('*'));

    const result: Element[] = [];

    for (const element of elements) {
        if (result.some(parent => parent.contains(element))) continue;

        const decision = classifyContentUnit(element);
        if (decision.action === 'skip') continue;
        if (decision.action !== 'allow' || decision.confidence < 0.72) continue;

        result.push(element);
    }

    return result;
}

function scoreTitle(element: Element, metrics: UnitMetrics): number {
    if (!looksLikeTitleText(metrics.text)) return 0;

    const tag = element.tagName.toLowerCase();
    const hint = getElementHint(element);
    let score = 0;

    if (/^h[12]$/.test(tag)) score += 4;
    if (tag === 'h3') score += 2;
    if (element.getAttribute('role') === 'heading') {
        const level = Number(element.getAttribute('aria-level') ?? '0');
        if (level === 1 || level === 2) score += 4;
        else if (level === 3) score += 2;
    }
    if (TITLE_PATTERN.test(hint)) score += 2;
    if (isInReadableContainer(element)) score += 1.5;
    if (hasNearbyReadableText(element)) score += 2;
    if (isEarlyInContainer(element)) score += 1;

    score -= getUiPenalty(element, metrics);
    score -= metrics.linkDensity > 0.4 ? 2 : 0;

    return score;
}

function scoreSubtitle(element: Element, metrics: UnitMetrics): number {
    if (metrics.textLength < 24 || metrics.textLength > 320) return 0;
    if (!metrics.hasReadableSentence) return 0;

    const hint = getElementHint(element);
    let score = 0;

    if (SUBTITLE_PATTERN.test(hint)) score += 4;
    if (isInReadableContainer(element)) score += 1.5;
    if (hasNearbyPrimaryTitle(element)) score += 2;
    if (hasPreviousPrimaryTitleSibling(element)) score += 3;
    if (metrics.linkDensity <= 0.25) score += 1;

    score -= getUiPenalty(element, metrics);
    score -= NOISE_PATTERN.test(hint) ? 4 : 0;

    return score;
}

function scoreContentCard(element: Element, metrics: UnitMetrics): number {
    const tag = element.tagName.toLowerCase();
    if (['body', 'main', 'article', 'a', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption'].includes(tag)) return 0;
    if (metrics.textLength < 40 || metrics.textLength > 1200) return 0;
    if (metrics.buttonCount > 1) return 0;

    const hint = getElementHint(element);
    const hasHeadingChild = element.querySelector('h2, h3, h4, [role="heading"], strong, b') !== null;
    const hasReadableChild = Array.from(element.children)
        .some(child => getNormalizedText(child).length >= 24 && /[.!?。！？]/.test(getNormalizedText(child)));

    let score = 0;
    if (CARD_PATTERN.test(hint)) score += 2.5;
    if (INTRO_CARD_PATTERN.test(hint)) score += 3;
    if (hasHeadingChild) score += 2;
    if (hasReadableChild || metrics.hasReadableSentence) score += 2;
    if (metrics.childTextBlockCount >= 2) score += 1.5;
    if (isInReadableContainer(element)) score += 1;
    if (isEarlyInContainer(element) && metrics.textLength >= 80 && metrics.linkDensity <= 0.35) score += 1;
    if (metrics.linkDensity <= 0.35) score += 1;

    score -= getUiPenalty(element, metrics);
    score -= NOISE_PATTERN.test(hint) ? 4 : 0;
    score -= metrics.linkDensity > 0.55 ? 3 : 0;

    return score;
}

function scoreForumTopic(element: Element, metrics: UnitMetrics): number {
    const tag = element.tagName.toLowerCase();
    if (!['a', 'h2', 'h3', 'span', 'div'].includes(tag)) return 0;
    if (!looksLikeTitleText(metrics.text)) return 0;

    const hint = getElementHint(element);
    const row = element.closest('li, tr, article, [role="row"], .topic-list-item, .topic-row, .discussion, .thread, .post');
    const rowHint = row ? getElementHint(row) : '';
    const rowText = row ? getNormalizedText(row) : '';

    let score = 0;
    if (FORUM_TOPIC_PATTERN.test(`${hint} ${rowHint}`)) score += 3;
    if (row && /(replies|views|activity|comments|last post|latest|\d+\s*(replies|views|comments)|\d+[hmwd]\b)/i.test(rowText)) score += 2;
    if (tag === 'a' && element.getAttribute('href')) score += 1.5;
    if (metrics.linkDensity <= 1) score += 1;
    if (row && row.querySelector('.topic-excerpt, .excerpt, [class*="excerpt"]')) score += 1;

    score -= isMetadataElement(element, metrics) ? 5 : 0;
    score -= getUiPenalty(element, metrics);

    return score;
}

function scoreForumExcerpt(element: Element, metrics: UnitMetrics): number {
    if (metrics.textLength < 35 || metrics.textLength > 420) return 0;
    if (!metrics.hasReadableSentence) return 0;

    const hint = getElementHint(element);
    let score = 0;

    if (/\b(excerpt|summary|preview)\b/i.test(hint)) score += 4;
    if (element.closest('.topic-list-item, .topic-row, .discussion, .thread, li, article')) score += 1.5;
    if (metrics.linkDensity <= 0.25) score += 1;

    score -= getUiPenalty(element, metrics);
    score -= NOISE_PATTERN.test(hint) ? 3 : 0;

    return score;
}

function isStructuralUi(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (['nav', 'footer', 'form', 'dialog'].includes(tag)) return true;
    if (tag === 'aside' && !isInReadableContainer(element)) return true;

    const role = element.getAttribute('role')?.toLowerCase();
    if (role && ['navigation', 'menu', 'menubar', 'toolbar', 'tablist', 'tab', 'button', 'dialog'].includes(role)) return true;

    if (element.closest('nav, footer, form, dialog, [role="navigation"], [role="menu"], [role="toolbar"], [role="tablist"]')) return true;
    if (element.closest('[hidden], [aria-hidden="true"], .notranslate, [translate="no"]')) return true;

    const hint = getElementHint(element);
    const text = getNormalizedText(element);
    if (UI_PATTERN.test(hint) && text.length < 80) return true;

    return false;
}

function isMetadataElement(element: Element, metrics: UnitMetrics): boolean {
    const hint = getElementHint(element);
    const text = metrics.text;

    if (META_PATTERN.test(hint) && metrics.textLength <= 180) return true;
    if (STAT_TEXT_PATTERN.test(text)) return true;
    if (FILE_META_TEXT_PATTERN.test(text) && metrics.textLength <= 140) return true;
    if (/^\d+(\.\d+)?[kKmM]?$/.test(text)) return true;
    if (/^\d+\s*(replies|views|comments|likes|votes)$/i.test(text)) return true;
    if (/^\d+[smhdw]\s*(ago)?$/i.test(text)) return true;

    return false;
}

function isNoiseElement(element: Element, metrics: UnitMetrics): boolean {
    const hint = getElementHint(element);
    if (!NOISE_PATTERN.test(hint)) return false;
    if (metrics.textLength > 600 && metrics.hasReadableSentence && metrics.linkDensity < 0.25) return false;
    return true;
}

function getUiPenalty(element: Element, metrics: UnitMetrics): number {
    const hint = getElementHint(element);
    let penalty = 0;

    if (UI_PATTERN.test(hint)) penalty += 3;
    if (element.closest('button, [role="button"], nav, [role="navigation"]')) penalty += 4;
    if (metrics.buttonCount > 0 && metrics.textLength < 160) penalty += 2;
    if (metrics.linkCount >= 3 && metrics.textLength < 220) penalty += 2;

    return penalty;
}

function isInReadableContainer(element: Element): boolean {
    return Boolean(element.closest('article, main, [role="main"], [role="article"], .markdown-body, .prose, .content, .article, .post, .story, .docs, .document'));
}

function hasNearbyReadableText(element: Element): boolean {
    const parent = element.parentElement;
    if (!parent) return false;
    const nearbyElements = [
        ...Array.from(parent.querySelectorAll('p, blockquote, li, figcaption, [class*="subtitle"], [class*="dek"], [class*="lead"], [class*="summary"], [class*="description"]')),
        ...Array.from(parent.children)
    ];

    return nearbyElements
        .filter(node => node !== element)
        .some(node => getNormalizedText(node).length >= 60);
}

function hasNearbyPrimaryTitle(element: Element): boolean {
    const parent = element.parentElement;
    if (!parent) return false;
    const previousSiblings = getPreviousElementSiblings(element, 3);
    if (previousSiblings.some(sibling => matchesPrimaryTitle(sibling))) return true;
    return parent.querySelector('h1, h2, [role="heading"][aria-level="1"], [role="heading"][aria-level="2"]') !== null;
}

function hasPreviousPrimaryTitleSibling(element: Element): boolean {
    return getPreviousElementSiblings(element, 2).some(sibling => matchesPrimaryTitle(sibling));
}

function matchesPrimaryTitle(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2') return true;
    if (element.getAttribute('role') === 'heading') {
        const level = Number(element.getAttribute('aria-level') ?? '0');
        return level === 1 || level === 2;
    }
    return false;
}

function getPreviousElementSiblings(element: Element, limit: number): Element[] {
    const siblings: Element[] = [];
    let current = element.previousElementSibling;

    while (current && siblings.length < limit) {
        siblings.push(current);
        current = current.previousElementSibling;
    }

    return siblings;
}

function isEarlyInContainer(element: Element): boolean {
    const parent = element.parentElement;
    if (!parent) return false;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    return index >= 0 && index <= Math.max(2, Math.floor(siblings.length * 0.2));
}

function looksLikeTitleText(text: string): boolean {
    if (text.length < 8 || text.length > 240) return false;
    if (STAT_TEXT_PATTERN.test(text)) return false;
    if (/^[\d\s.,:%+-]+$/.test(text)) return false;
    return /[A-Za-z]/.test(text);
}

function getUnitMetrics(element: Element): UnitMetrics {
    const text = getNormalizedText(element);
    const links = Array.from(element.querySelectorAll('a'));
    const buttons = Array.from(element.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
    const linkTextLength = links.reduce((sum, link) => sum + getNormalizedText(link).length, 0);
    const childTextBlockCount = Array.from(element.children)
        .filter(child => getNormalizedText(child).length >= 8)
        .length;

    return {
        text,
        textLength: text.length,
        linkDensity: text.length > 0 ? linkTextLength / text.length : 0,
        linkCount: links.length,
        buttonCount: buttons.length,
        childTextBlockCount,
        hasReadableSentence: /[.!?。！？]/.test(text) || text.split(/\s+/).length >= 8
    };
}

function getElementHint(element: Element): string {
    const attrs = [
        element.tagName.toLowerCase(),
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('role') ?? '',
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('title') ?? '',
        element.getAttribute('slot') ?? '',
        element.getAttribute('itemprop') ?? '',
        element.getAttribute('data-testid') ?? '',
        element.getAttribute('data-test-id') ?? ''
    ];

    return attrs.join(' ');
}

function getNormalizedText(element: Element): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function allow(kind: ContentUnitKind, confidence: number, reason: string): ContentUnitDecision {
    return { action: 'allow', kind, confidence, reasons: [reason] };
}

function skip(kind: ContentUnitKind, confidence: number, reason: string): ContentUnitDecision {
    return { action: 'skip', kind, confidence, reasons: [reason] };
}

function neutral(reason: string): ContentUnitDecision {
    return { action: 'neutral', confidence: 0, reasons: [reason] };
}
