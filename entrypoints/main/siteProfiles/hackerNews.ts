import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const hackerNewsProfile: SiteProfile = {
    id: 'hacker-news',
    domains: ['news.ycombinator.com'],
    select: (node) => {
        if (shouldSkipHNElement(node)) return { skip: true };

        const storyTitle = findMatchingElement(node, 'td.title a.titlelink');
        if (storyTitle) return storyTitle;

        const comment = findMatchingElement(node, 'div.comment span.commtext');
        if (comment) return comment;

        const storyText = findMatchingElement(node, 'div.toptext');
        if (storyText) return storyText;

        const userAbout = findMatchingElement(node, 'td.default');
        if (userAbout) return userAbout;

        return false;
    }
};

function shouldSkipHNElement(node: Element): boolean {
    const skipSelectors = [
        'td.hnnavbar',
        'span.pagetop',
        'td.subtext',
        'span.hnuser',
        'span.age',
        'form',
        'input',
        'textarea',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) return true;

        let parent = node.parentElement;
        while (parent) {
            if (parent.matches?.(selector)) return true;
            parent = parent.parentElement;
        }
    }

    const skipTexts = ['reply', 'flag', 'favorite', 'hide', 'past', 'web', 'comments', 'ask', 'show', 'jobs', 'submit'];
    if (node.textContent && skipTexts.includes(node.textContent.trim().toLowerCase())) {
        return true;
    }

    return false;
}
