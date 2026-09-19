import type { SiteProfile } from './types';

const STORY_TITLE_SELECTOR = '#inside > ol.stories > li.story .link > a';
const COMMENT_TEXT_SELECTOR = [
    '#story_comments .comment_text > p',
    '#story_comments .comment_text > blockquote',
    '#story_comments .comment_text > ul > li',
    '#story_comments .comment_text > ol > li'
].join(', ');
const READING_SELECTOR = `${STORY_TITLE_SELECTOR}, ${COMMENT_TEXT_SELECTOR}`;

export const lobstersProfile: SiteProfile = {
    id: 'lobsters',
    domains: ['lobste.rs'],
    select: node => isStoryReadingTarget(node) ? node : false,
    // 评论树可能被选为内容根，仍需从整页补齐它前面的帖子标题。
    collectFastPathTargets: () => getStoryReadingTargets(document.body),
    allowTarget: node => {
        if (!isStoryReadingTarget(node)) return false;

        return {
            role: node.matches(STORY_TITLE_SELECTOR) ? 'title' : 'paragraph',
            source: 'site-profile',
            reason: 'lobsters-story-reading-content'
        };
    }
};

function getStoryReadingTargets(root: ParentNode): Element[] {
    if (!document.getElementById('story_comments')) return [];

    const targets = [
        ...(root instanceof Element && root.matches(READING_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<Element>(READING_SELECTOR))
    ];
    return targets.filter(isStoryReadingTarget);
}

function isStoryReadingTarget(node: Element): boolean {
    if (!document.getElementById('story_comments') || !node.matches(READING_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && /[A-Za-z]/.test(text);
}
