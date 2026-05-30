import type { SiteProfile } from './types';

const ARTICLE_HEADER_TARGET_SELECTOR = [
    'header h1',
    'header .upper-deck__text',
    'header p'
].join(', ');
const ARTICLE_HEADER_WRAPPER_SELECTOR = 'header, header > div, header > div > div, header > div > div > div';
const ARTICLE_META_SELECTOR = 'header time, header .view-comments, header [href*="/author/"]';

export const arsTechnicaProfile: SiteProfile = {
    id: 'ars-technica',
    domains: ['arstechnica.com'],
    select: (node) => {
        if (isArsArticleHeaderTarget(node)) return node;
        return false;
    },
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(ARTICLE_HEADER_TARGET_SELECTOR))
            .filter(isArsArticleHeaderTarget);
    },
    allowTarget: (node) => {
        if (!isArsArticleHeaderTarget(node)) return false;

        return {
            target: node,
            role: inferRole(node),
            reason: 'ars-technica-article-header-target'
        };
    },
    skipTarget: (node) => {
        if (node.matches(ARTICLE_META_SELECTOR) || node.closest(ARTICLE_META_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'metadata',
                reason: 'ars-technica-article-meta'
            };
        }

        if (!isArsArticleHeaderWrapper(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'layout',
            reason: 'ars-technica-article-header-wrapper'
        };
    }
};

function isArsArticleHeaderTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_HEADER_TARGET_SELECTOR)) return false;
    if (node.closest('svg, figure, .ars-lightbox, .caption, .caption-content, .caption-credit')) return false;
    if (node.matches(ARTICLE_META_SELECTOR) || node.closest(ARTICLE_META_SELECTOR)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;
    if (/^\d/.test(text)) return false;

    return /[A-Za-z]/.test(text);
}

function isArsArticleHeaderWrapper(node: Element): boolean {
    if (!node.matches(ARTICLE_HEADER_WRAPPER_SELECTOR)) return false;
    return node.querySelector('h1') !== null;
}

function inferRole(node: Element) {
    if (node.tagName.toLowerCase() === 'h1') return 'title';
    return 'summary';
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
