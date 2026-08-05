import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

const THREAD_GIST_TEXT_SELECTOR = [
    '.thread-gist__title',
    '.thread-gist__text',
    '.thread-gist__subtitle',
    '.thread-gist__comment'
].join(', ');

const COMMENT_TEXT_SELECTOR = [
    '.user-comment > p',
    '.user-comment > blockquote',
    '.user-comment > ul > li',
    '.user-comment > ol > li'
].join(', ');

const DISCUSSION_TEXT_SELECTOR = [
    THREAD_GIST_TEXT_SELECTOR,
    COMMENT_TEXT_SELECTOR
].join(', ');

const DISCUSSION_ROOT_SELECTOR = [
    '.thread-gist',
    '#comments-feed-list',
    '.comments-feed-list'
].join(', ');

const DISCUSSION_LAYOUT_SELECTOR = [
    '.thread-gist',
    '.thread-gist__content',
    '.thread-gist__summary',
    '.thread-gist__header',
    '.thread-gist__top-comment',
    '.thread-gist__subheader',
    '.thread-gist__card',
    '#w-comment-feed',
    '#comments-feed-list',
    '.comments-feed-list',
    '.comments-feed-item',
    '.user-comment'
].join(', ');

const DISCUSSION_UI_SELECTOR = [
    '.thread-gist__card-header',
    '.thread-gist__meta',
    '.w-thread-author-usercards',
    '.user-date',
    '.w-user-comment-footer-option',
    '.comment-footer-option',
    'form',
    'input',
    'textarea',
    '[contenteditable="true"]',
    'button'
].join(', ');

export const xdaDevelopersProfile: SiteProfile = {
    id: 'xda-developers',
    domains: ['xda-developers.com'],
    select: (node) => {
        if (isXdaDiscussionUi(node)) return { skip: true };
        return isXdaDiscussionTextTarget(node) ? node : false;
    },
    supplemental: (root) => getXdaDiscussionTextTargets(root),
    expandTarget: (node) => getXdaDiscussionTextTargets(node),
    allowTarget: (node) => {
        if (!isXdaDiscussionTextTarget(node)) return false;

        return {
            role: node.matches('h1, h2, h3, h4, h5, h6') ? 'title' : 'paragraph',
            source: 'site-profile',
            reason: 'xda-discussion-text'
        };
    },
    skipTarget: (node) => {
        if (isXdaDiscussionUi(node)) {
            return { policy: 'hard-skip', role: 'ui', reason: 'xda-discussion-ui' };
        }
        if (node.matches(DISCUSSION_LAYOUT_SELECTOR)) {
            return { policy: 'hard-skip', role: 'layout', reason: 'xda-discussion-layout' };
        }
        return false;
    }
};

function getXdaDiscussionTextTargets(root: ParentNode): Element[] {
    const candidates = [
        ...(root instanceof Element && root.matches(DISCUSSION_TEXT_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<Element>(DISCUSSION_TEXT_SELECTOR))
    ];

    return Array.from(new Set(candidates)).filter(isXdaDiscussionTextTarget);
}

function isXdaDiscussionTextTarget(node: Element): boolean {
    if (!node.matches(DISCUSSION_TEXT_SELECTOR)) return false;
    if (!node.closest(DISCUSSION_ROOT_SELECTOR)) return false;
    if (node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`)) return false;
    if (isXdaDiscussionUi(node)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && /[A-Za-z]/.test(text);
}

function isXdaDiscussionUi(node: Element): boolean {
    return node.matches(DISCUSSION_UI_SELECTOR) || node.closest(DISCUSSION_UI_SELECTOR) !== null;
}
