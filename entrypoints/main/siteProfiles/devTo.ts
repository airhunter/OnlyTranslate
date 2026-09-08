import type { SiteProfile } from './types';

const ARTICLE_TITLE_SELECTOR = [
    'article#article-show-container',
    '> header#main-title.crayons-article__header',
    '.crayons-article__header__meta > h1'
].join(' ');

export const devToProfile: SiteProfile = {
    id: 'dev-to',
    domains: ['dev.to'],
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(ARTICLE_TITLE_SELECTOR))
            .filter(isDevToArticleTitle);
    },
    allowTarget: (node) => {
        if (!isDevToArticleTitle(node)) return false;

        return {
            target: node,
            role: 'title',
            reason: 'dev-to-article-title'
        };
    }
};

function isDevToArticleTitle(node: Element): boolean {
    if (!node.matches(ARTICLE_TITLE_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 8 && text.length <= 240;
}
