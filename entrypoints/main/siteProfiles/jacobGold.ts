import type { SiteProfile } from './types';

const ARTICLE_TARGET_SELECTOR = [
    'main > h1',
    'main > p:not(.post-hn)',
    'main > content > h2',
    'main > content > p'
].join(', ');

export const jacobGoldProfile: SiteProfile = {
    id: 'jacob-gold',
    domains: ['jacob.gold'],
    targetStrategy: 'profile-first',
    select: (node) => node.matches(ARTICLE_TARGET_SELECTOR) ? node : false,
    allowTarget: (node) => {
        if (!node.matches(ARTICLE_TARGET_SELECTOR)) return false;
        return {
            role: /^h[1-6]$/i.test(node.tagName) ? 'title' : 'paragraph',
            source: 'site-profile',
            reason: 'jacob-gold-article-unit'
        };
    },
    skipTarget: (node) => {
        if (node.matches('main, main > content')) {
            return { policy: 'hard-skip', role: 'layout', reason: 'jacob-gold-layout-container' };
        }
        if (node.matches('.post-hn') || node.closest('.post-hn')) {
            return { policy: 'hard-skip', role: 'ui', reason: 'jacob-gold-discussion-link' };
        }
        return false;
    },
    shouldKeepNestedTarget: (parent, child) => {
        return parent.matches('main > content') && child.matches(ARTICLE_TARGET_SELECTOR);
    }
};
