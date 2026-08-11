import type { SiteProfile } from './types';

const ARTICLE_HEADER_SELECTOR = '.article-container .article-header';
const ARTICLE_HEADER_TARGET_SELECTOR = [
    `${ARTICLE_HEADER_SELECTOR} h1`,
    `${ARTICLE_HEADER_SELECTOR} h2`
].join(', ');

export const wsjProfile: SiteProfile = {
    id: 'wsj',
    domains: ['wsj.com'],
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(ARTICLE_HEADER_TARGET_SELECTOR))
            .filter(isWsjArticleHeaderTarget);
    },
    allowTarget: (node) => {
        if (!isWsjArticleHeaderTarget(node)) return false;

        return {
            target: node,
            role: node.tagName.toLowerCase() === 'h1' ? 'title' : 'summary',
            reason: 'wsj-article-header-target'
        };
    }
};

function isWsjArticleHeaderTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_HEADER_TARGET_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && text.length <= 320;
}
