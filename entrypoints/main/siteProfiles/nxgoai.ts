import type { SiteProfile } from './types';

const ARTICLE_ROOT_SELECTOR = '.prose';
const ARTICLE_TARGET_SELECTOR = [
    `${ARTICLE_ROOT_SELECTOR} > h1`,
    `${ARTICLE_ROOT_SELECTOR} > h2`,
    `${ARTICLE_ROOT_SELECTOR} > h3`,
    `${ARTICLE_ROOT_SELECTOR} > p`,
    `${ARTICLE_ROOT_SELECTOR} > ul > li`,
    `${ARTICLE_ROOT_SELECTOR} > ol > li`,
    `${ARTICLE_ROOT_SELECTOR} blockquote > p`
].join(', ');
const ARTICLE_WRAPPER_SELECTOR = [
    ARTICLE_ROOT_SELECTOR,
    `${ARTICLE_ROOT_SELECTOR} > ul`,
    `${ARTICLE_ROOT_SELECTOR} > ol`,
    `${ARTICLE_ROOT_SELECTOR} figure`,
    `${ARTICLE_ROOT_SELECTOR} blockquote`
].join(', ');

export const nxgoaiProfile: SiteProfile = {
    id: 'nxgoai',
    domains: ['nxgoai.com'],
    select: (node) => {
        if (isNxgoaiArticleTarget(node)) return node;
        return false;
    },
    allowTarget: (node) => {
        if (!isNxgoaiArticleTarget(node)) return false;

        return {
            target: node,
            role: inferRole(node),
            reason: 'nxgoai-article-target'
        };
    },
    skipTarget: (node) => {
        if (node.closest(`${ARTICLE_ROOT_SELECTOR} ~ div`)) {
            return {
                policy: 'hard-skip',
                role: 'ui',
                reason: 'nxgoai-after-article-module'
            };
        }

        if (!isNxgoaiArticleWrapper(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'layout',
            reason: 'nxgoai-article-wrapper'
        };
    }
};

function isNxgoaiArticleWrapper(node: Element): boolean {
    if (node.matches(ARTICLE_WRAPPER_SELECTOR)) return true;
    return !isNxgoaiArticleTarget(node) && node.querySelector(ARTICLE_ROOT_SELECTOR) !== null;
}

function isNxgoaiArticleTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_TARGET_SELECTOR)) return false;
    if (node.closest('pre, code, iframe, nav, footer, form, button, [role="navigation"]')) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;

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
