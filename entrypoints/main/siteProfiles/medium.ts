import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const mediumProfile: SiteProfile = {
    id: 'medium',
    domains: ['medium.com'],
    select: (node) => {
        if (shouldSkipMediumElement(node)) return { skip: true };

        const articleTitle = findMatchingElement(node, 'h1');
        if (articleTitle) return articleTitle;

        const articleSubtitle = findMatchingElement(node, 'h2');
        if (articleSubtitle) return articleSubtitle;

        const articleParagraph = findMatchingElement(node, 'p');
        if (articleParagraph) return articleParagraph;

        const articleListItem = findMatchingElement(node, 'li');
        if (articleListItem) return articleListItem;

        const blockquote = findMatchingElement(node, 'blockquote');
        if (blockquote) return blockquote;

        const articleBody = findMatchingElement(node, 'article section');
        if (articleBody) return articleBody;

        const authorBio = findMatchingElement(node, 'p.pw-author-note');
        if (authorBio) return authorBio;

        const comment = findMatchingElement(node, 'div.pw-responses-thread p');
        if (comment) return comment;

        return false;
    }
};

function shouldSkipMediumElement(node: Element): boolean {
    const skipSelectors = [
        'nav',
        'div.metabar',
        'div.js-metabar',
        'div.js-sidebarContainer',
        'div.js-sidebar',
        'button',
        'input',
        'textarea',
        'pre',
        'code',
        'footer',
        'div.pw-multi-author-card',
        'div.pw-card-body div.pw-card-description ~ *',
        'div.pw-post-actions',
        'div.pw-responses-header',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) return true;

        let parent = node.parentElement;
        while (parent) {
            if (parent.matches?.(selector)) return true;
            parent = parent.parentElement;
        }
    }

    const skipClassKeywords = ['js-', 'btn', 'button', 'u-', 'overlay', 'postActionsBar'];
    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword)) return true;
        }
    }

    if (node.tagName?.toLowerCase() === 'pre' || node.tagName?.toLowerCase() === 'code') return true;
    if (node.tagName?.toLowerCase() === 'svg' || node.tagName?.toLowerCase() === 'img') return true;

    return false;
}
