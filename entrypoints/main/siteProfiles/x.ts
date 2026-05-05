import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';
import { debugLog, isSpecialContent } from './utils';

export const xProfile: SiteProfile = {
    id: 'x',
    domains: ['x.com'],
    select: (node) => {
        if (shouldSkipTwitterElement(node)) {
            debugLog('Compat', '跳过Twitter元素:', node.textContent);
            return { skip: true };
        }

        const userDescription = findMatchingElement(node, 'div[data-testid="UserDescription"]');
        if (userDescription) return userDescription;

        const tweetText = findMatchingElement(node, 'div[data-testid="tweetText"]');
        if (tweetText) return tweetText;

        const reply = findMatchingElement(node, 'div[role="group"] div[lang]');
        if (reply) return reply;

        const timelineCell = findMatchingElement(node, 'div[data-testid="cellInnerDiv"] div[lang]');
        if (timelineCell) return timelineCell;

        const tweetContent = findMatchingElement(node, 'article div[lang]');
        if (tweetContent) return tweetContent;

        return false;
    }
};

function shouldSkipTwitterElement(node: Element): boolean {
    if (node.textContent && isSpecialContent(node.textContent)) {
        debugLog('Twitter', '特殊内容', node.textContent);
        return true;
    }

    const skipSelectors = [
        'div[data-testid="sidebarColumn"]',
        'div[aria-label="Timeline: Trending now"]',
        'aside[aria-label="Who to follow"]',
        'div[data-testid="SearchBox_Search_Input"]',
        'div[role="button"]',
        'div[data-testid="BottomBar"]',
        'div[role="group"][aria-label]',
        'div[data-testid="suggestedUserHover"]',
        'div[aria-label*="icon"]',
        'div[data-testid*="icon"]',
        'header[role="banner"]',
        'div[data-testid="characterCount"]',
        'div[data-testid="User-Name"]',
        'div[data-testid="UserName"]',
        'span[data-testid="tweetText"] span.r-bcqeeo',
        'div[data-testid="HoverCard"]',
        'div[data-testid="UserCell"]',
        'a[role="link"][href*="/status/"]',
        'div[role="button"][data-testid="follow"]',
        'div[role="button"][data-testid="unfollow"]',
        'div[dir="auto"][id^="id__"]'
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) {
            debugLog('Twitter', '选择器匹配跳过', selector, node.textContent);
            return true;
        }
    }

    const nodeTag = node.tagName?.toLowerCase();
    if (nodeTag === 'svg' || nodeTag === 'path' || nodeTag === 'g') {
        debugLog('Twitter', 'SVG元素跳过', node.textContent);
        return true;
    }

    if (node.textContent?.trim().match(/^(\d+|Like|Reply|Retweet|Share)$/)) {
        debugLog('Twitter', '操作按钮跳过', node.textContent);
        return true;
    }

    const textContent = node.textContent?.trim();
    if (textContent) {
        if (textContent.startsWith('@')) {
            debugLog('Twitter', '用户名跳过', node.textContent);
            return true;
        }
        if (textContent.startsWith('id@')) {
            debugLog('Twitter', '用户ID跳过', node.textContent);
            return true;
        }
        if (textContent.includes('关注') || textContent.includes('Follow')) {
            debugLog('Twitter', '关注按钮跳过', node.textContent);
            return true;
        }
        if (/^([A-Za-z0-9_]{1,15})$/.test(textContent)) {
            debugLog('Twitter', '用户名标签跳过', node.textContent);
            return true;
        }
    }

    if (node.classList) {
        for (const className of Array.from(node.classList)) {
            if (className.startsWith('r-') || className.startsWith('css-')) {
                const text = node.textContent?.trim();
                if (!text || text.length < 10) {
                    debugLog('Twitter', 'UI元素跳过', node.textContent);
                    return true;
                }
            }
        }
    }

    if (node.id && node.id.startsWith('id__')) {
        debugLog('Twitter', 'ID属性跳过', node.textContent);
        return true;
    }

    return false;
}
