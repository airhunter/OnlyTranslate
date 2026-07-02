import type { SiteProfile, SiteProfileMode } from './types';

const ARTICLE_BODY_SELECTOR = '.c-article-body';
const ARTICLE_TITLE_SELECTOR = '.c-article-title, h1[data-test="article-title"]';

const ARTICLE_READING_TARGET_SELECTOR = [
    ARTICLE_TITLE_SELECTOR,
    '.c-article-body .c-article-section__title',
    '.c-article-body .c-article__sub-heading',
    '.c-article-body .c-article-section__content > p',
    '.c-article-body .c-article-section__content li',
    '.c-article-body .c-article-section__content blockquote',
    '.c-article-body figcaption'
].join(', ');

const ARTICLE_METADATA_SELECTOR = [
    '.c-article-references',
    '.c-article-share-box',
    '.c-article-metrics-bar',
    '.c-article-author-list',
    '.c-article-info-details',
    '.c-article-associated-content',
    '[data-component*="share"]',
    '[data-title="References"]',
    '[data-title="Rights and permissions"]',
    '[data-title="About this article"]',
    '[id^="Bib"]',
    '#references-section',
    '#rightslink-section',
    '#article-info-section'
].join(', ');

const ARTICLE_LAYOUT_WRAPPER_SELECTOR = [
    ARTICLE_BODY_SELECTOR,
    '.main-content',
    '.c-article-section',
    '.c-article-section__content'
].join(', ');

const METADATA_LABEL_PATTERN = /^(references|rights and permissions|about this article|share this article|reprints and permissions)$/i;

export const natureProfile: SiteProfile = {
    id: 'springer-nature',
    domains: ['nature.com', 'springer.com', 'biomedcentral.com'],
    targetStrategy: 'profile-first',
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return collectSpringerNatureArticleTargets(root, context.mode);
    },
    allowTarget: (node, context) => {
        const target = findSpringerNatureArticleTarget(node, context.mode);
        if (!target) return false;

        return {
            target,
            role: inferSpringerNatureRole(target),
            reason: 'springer-nature-article-target'
        };
    },
    skipTarget: (node, context) => {
        if (!shouldSkipSpringerNatureTarget(node, context.mode)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'springer-nature-metadata-or-wrapper'
        };
    }
};

function collectSpringerNatureArticleTargets(root: ParentNode, mode: SiteProfileMode): Element[] {
    if (!hasSpringerNatureArticleBody(root)) return [];

    return Array.from(root.querySelectorAll<Element>(ARTICLE_READING_TARGET_SELECTOR))
        .filter(node => isReadableSpringerNatureArticleTarget(node, mode))
        .filter((node, index, list) => list.indexOf(node) === index);
}

function findSpringerNatureArticleTarget(node: Element, mode: SiteProfileMode): Element | null {
    const target = findMatchingSpringerNatureTarget(node);
    if (!target || !isReadableSpringerNatureArticleTarget(target, mode)) return null;

    return target;
}

function findMatchingSpringerNatureTarget(node: Element): Element | null {
    if (safeMatches(node, ARTICLE_READING_TARGET_SELECTOR)) return node;

    try {
        return node.closest(ARTICLE_READING_TARGET_SELECTOR);
    } catch (_) {
        return null;
    }
}

function isReadableSpringerNatureArticleTarget(node: Element, mode: SiteProfileMode): boolean {
    const isArticleTitle = safeMatches(node, ARTICLE_TITLE_SELECTOR);
    if (!isArticleTitle && !node.closest(ARTICLE_BODY_SELECTOR)) return false;
    if (isArticleTitle && !node.ownerDocument.querySelector(ARTICLE_BODY_SELECTOR)) return false;
    if (mode === 'smart' && isSpringerNatureMetadata(node)) return false;

    const tag = node.tagName.toLowerCase();
    if (!/^h[1-6]$/.test(tag) && !['p', 'li', 'blockquote', 'figcaption'].includes(tag)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3 || !/[A-Za-z]/.test(text)) return false;
    if (METADATA_LABEL_PATTERN.test(text)) return false;

    return true;
}

function shouldSkipSpringerNatureTarget(node: Element, mode: SiteProfileMode): boolean {
    if (!node.closest(ARTICLE_BODY_SELECTOR)) return false;
    if (mode === 'smart' && isSpringerNatureMetadata(node)) return true;
    if (safeMatches(node, ARTICLE_LAYOUT_WRAPPER_SELECTOR)) return true;

    return false;
}

function isSpringerNatureMetadata(node: Element): boolean {
    if (safeMatches(node, ARTICLE_METADATA_SELECTOR)) return true;

    try {
        if (node.closest(ARTICLE_METADATA_SELECTOR)) return true;
    } catch (_) {}

    return METADATA_LABEL_PATTERN.test(getNormalizedText(node));
}

function hasSpringerNatureArticleBody(root: ParentNode): boolean {
    if (root instanceof Element && safeMatches(root, ARTICLE_BODY_SELECTOR)) return true;
    return root.querySelector?.(ARTICLE_BODY_SELECTOR) !== null;
}

function inferSpringerNatureRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    if (tag === 'figcaption') return 'summary';
    return 'paragraph';
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function safeMatches(node: Element, selector: string): boolean {
    try {
        return node.matches(selector);
    } catch (_) {
        return false;
    }
}
