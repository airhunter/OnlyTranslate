import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

// HN 已把标题改为 span.titleline > a、评论正文改为 div.commtext，旧类名保留兼容
const HN_TITLE_SELECTOR = 'td.title span.titleline > a, td.title a.titlelink, td.title a.storylink';
const HN_COMMENT_SELECTOR = 'div.comment > .commtext';
const HN_STORY_TEXT_SELECTOR = 'div.toptext';
const HN_READING_SELECTOR = [HN_TITLE_SELECTOR, HN_COMMENT_SELECTOR, HN_STORY_TEXT_SELECTOR].join(', ');

export const hackerNewsProfile: SiteProfile = {
    id: 'hacker-news',
    domains: ['news.ycombinator.com'],
    targetStrategy: 'profile-first',
    select: (node) => {
        if (shouldSkipHNElement(node)) return { skip: true };

        const reading = findMatchingElement(node, HN_READING_SELECTOR);
        if (reading) return reading;

        const userAbout = findMatchingElement(node, 'td.default');
        if (userAbout && !isCommentCell(userAbout)) return userAbout;

        return false;
    },
    // 帖子正文 .toptext 在评论树之外，智能模式的内容根扫不到，这里从整页补齐
    supplemental: (root) => Array.from(root.querySelectorAll<Element>(HN_READING_SELECTOR))
        .filter(node => !shouldSkipHNElement(node) && hasReadableText(node)),
    preserveSupplementalTargets: true,
    allowTarget: (node) => {
        if (!node.matches(HN_READING_SELECTOR)) return false;

        return {
            role: node.matches(HN_TITLE_SELECTOR) ? 'title' : 'paragraph',
            source: 'site-profile',
            reason: 'hacker-news-reading-content'
        };
    }
};

function isCommentCell(cell: Element): boolean {
    return cell.querySelector(`.comhead, ${HN_COMMENT_SELECTOR}`) !== null;
}

function hasReadableText(node: Element): boolean {
    return (node.textContent ?? '').trim().length > 0;
}

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
