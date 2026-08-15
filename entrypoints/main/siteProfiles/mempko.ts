import type { SiteProfile } from './types';

const ARTICLE_HEADER_SELECTOR = 'article.post > header.article-header.gh-canvas';
const ARTICLE_HEADER_TARGET_SELECTOR = [
    `${ARTICLE_HEADER_SELECTOR} > h1.article-title`,
    `${ARTICLE_HEADER_SELECTOR} > p.article-excerpt`
].join(', ');
const ARTICLE_HEADER_META_SELECTOR = [
    `${ARTICLE_HEADER_SELECTOR} > .article-tag`,
    `${ARTICLE_HEADER_SELECTOR} > .article-byline`,
    `${ARTICLE_HEADER_SELECTOR} > figure.article-image`
].join(', ');

export const mempkoProfile: SiteProfile = {
    id: 'mempko',
    domains: ['mempko.com'],
    select: (node) => {
        if (isMempkoArticleHeaderTarget(node)) return node;
        return false;
    },
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(ARTICLE_HEADER_TARGET_SELECTOR))
            .filter(isMempkoArticleHeaderTarget);
    },
    allowTarget: (node) => {
        if (!isMempkoArticleHeaderTarget(node)) return false;

        return {
            target: node,
            role: node.tagName.toLowerCase() === 'h1' ? 'title' : 'summary',
            reason: 'mempko-article-header-target'
        };
    },
    skipTarget: (node) => {
        if (node.matches(ARTICLE_HEADER_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'layout',
                reason: 'mempko-article-header-wrapper'
            };
        }

        if (node.matches(ARTICLE_HEADER_META_SELECTOR) || node.closest(ARTICLE_HEADER_META_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'metadata',
                reason: 'mempko-article-header-meta'
            };
        }

        return false;
    }
};

function isMempkoArticleHeaderTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_HEADER_TARGET_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && text.length <= 640;
}
