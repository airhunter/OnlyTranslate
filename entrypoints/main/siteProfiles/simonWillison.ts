import type { SiteProfile } from './types';

const ARTICLE_ROOT_SELECTOR = '.entry.entryPage [data-permalink-context]';
const ARTICLE_TARGET_SELECTOR = [
    `${ARTICLE_ROOT_SELECTOR} > h2`,
    `${ARTICLE_ROOT_SELECTOR} h3`,
    `${ARTICLE_ROOT_SELECTOR} h4`,
    `${ARTICLE_ROOT_SELECTOR} p:not(.mobile-date)`,
    `${ARTICLE_ROOT_SELECTOR} ul > li`,
    `${ARTICLE_ROOT_SELECTOR} ol > li`,
    `${ARTICLE_ROOT_SELECTOR} blockquote > p`
].join(', ');
const ARTICLE_WRAPPER_SELECTOR = [
    `${ARTICLE_ROOT_SELECTOR}`,
    `${ARTICLE_ROOT_SELECTOR} ul`,
    `${ARTICLE_ROOT_SELECTOR} ol`,
    `${ARTICLE_ROOT_SELECTOR} blockquote`
].join(', ');

export const simonWillisonProfile: SiteProfile = {
    id: 'simon-willison',
    domains: ['simonwillison.net'],
    select: (node) => {
        if (isSimonWillisonArticleTarget(node)) return node;
        return false;
    },
    allowTarget: (node) => {
        if (!isSimonWillisonArticleTarget(node)) return false;

        return {
            target: node,
            role: inferRole(node),
            reason: 'simon-willison-article-target'
        };
    },
    skipTarget: (node) => {
        if (!node.matches(ARTICLE_WRAPPER_SELECTOR)) return false;

        return {
            policy: 'hard-skip',
            role: 'layout',
            reason: 'simon-willison-article-wrapper'
        };
    }
};

function isSimonWillisonArticleTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_TARGET_SELECTOR)) return false;
    if (node.closest('pre, code, iframe, nav, footer, form, button, [role="navigation"]')) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;
    if (/^\d+(st|nd|rd|th)\s+\w+\s+\d{4}$/i.test(text)) return false;

    return /[A-Za-z]/.test(text);
}

function inferRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    return 'paragraph';
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
