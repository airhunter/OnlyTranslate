import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const stackOverflowProfile: SiteProfile = {
    id: 'stackoverflow',
    domains: ['stackoverflow.com'],
    select: (node) => {
        if (shouldSkipStackOverflowElement(node)) return { skip: true };

        const questionTitle = findMatchingElement(node, 'h1.question-hyperlink');
        if (questionTitle) return questionTitle;

        const excerpt = findMatchingElement(node, 'div.excerpt');
        if (excerpt) return excerpt;

        const status = findMatchingElement(node, 'div.question-status');
        if (status) return status;

        const userProfile = findMatchingElement(node, 'div.profile-about');
        if (userProfile) return userProfile;

        const errorMessage = findMatchingElement(node, 'div.s-notice');
        if (errorMessage) return errorMessage;

        return false;
    }
};

function shouldSkipStackOverflowElement(node: Element): boolean {
    const skipSelectors = [
        'nav.s-topbar',
        'div.s-topbar',
        'div.s-sidebarwidget',
        'form',
        'input',
        'textarea',
        'button',
        'pre.s-code-block',
        'code',
        'div.js-voting-container',
        'div.js-post-menu',
        'div.post-taglist',
        'div.module.community-bulletin',
        'div.-flair',
        'div.s-stats',
        'div.s-badge',
        'footer',
        'div.site-footer',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) return true;

        let parent = node.parentElement;
        while (parent) {
            if (parent.matches?.(selector)) return true;
            parent = parent.parentElement;
        }
    }

    const skipClassKeywords = ['js-', 'icon', 'btn', 'badge', 'vote', 'tag', 's-btn', 'vote-count'];
    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword)) return true;
        }
    }

    if (node.tagName?.toLowerCase() === 'pre' || node.tagName?.toLowerCase() === 'code') return true;
    if (node.tagName?.toLowerCase() === 'svg') return true;

    return false;
}
