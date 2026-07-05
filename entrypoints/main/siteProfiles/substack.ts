import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

const COMMENT_TEXT_SELECTOR = [
    '.comment-body p',
    '.comment-body blockquote',
    '.comment-body li',
    '[class*="comment-body"] p',
    '[class*="commentBody"] p'
].join(', ');

const RESTACK_TEXT_SELECTOR = [
    '.restacks-list p',
    '.restack-list p',
    '.restack-item p',
    '.restack-content p',
    '.restack-body p',
    '.restack-body blockquote',
    '.restack-body li',
    '[role="article"] p',
    '[data-testid*="restack"] p',
    '[data-testid*="Restack"] p',
    '[role="article"][aria-label="Note"] p',
    '[class*="restacks-list"] p',
    '[class*="restack-list"] p',
    '[class*="restack-item"] p',
    '[class*="restack-content"] p',
    '[class*="restack-body"] p',
    '[class*="restackBody"] p',
    '[class*="feedCommentBody"] p',
    '[class*="FeedProseMirror"] p',
    '[class*="restack"] [class*="body"] p',
    '[class*="restack"] [class*="Body"] p'
].join(', ');

const DISCUSSION_TEXT_SELECTOR = [
    COMMENT_TEXT_SELECTOR,
    RESTACK_TEXT_SELECTOR
].join(', ');

const DISCUSSION_ROOT_SELECTOR = [
    '.post-comments',
    '.comments-section',
    '.single-post-section.comments-section',
    '[class*="post-comments"]',
    '[class*="postComments"]',
    '[class*="comments-section"]',
    '[class*="commentsSection"]',
    '[role="article"][aria-label="Note"]'
].join(', ');

const DISCUSSION_LAYOUT_SELECTOR = [
    '.post-comments',
    '.comments-section',
    '.single-post-section.comments-section',
    '.comment-list',
    '.post-page-root-comment-list',
    '.comment-list-items',
    '.comment',
    '.comment-content',
    '[role="article"][aria-label^="Comment by"]',
    '.restacks-list',
    '.restack-list',
    '.restack-item',
    '.restack-content',
    '[role="article"][aria-label="Note"]',
    '[class*="restacks-list"]',
    '[class*="restack-list"]',
    '[class*="restack-item"]',
    '[class*="restack-content"]',
    '[class*="feedItem"]',
    '[class*="feedUnit"]',
    '[class*="feedCommentBody"]',
    '[class*="FeedProseMirror"]'
].join(', ');

const DISCUSSION_UI_SELECTOR = [
    '.comment-meta',
    '.comment-actions',
    '.restack-meta',
    '.restack-actions',
    '[class*="comment-meta"]',
    '[class*="comment-actions"]',
    '[class*="restack-meta"]',
    '[class*="restack-actions"]',
    '[class*="withShareButton"]',
    'form',
    'input',
    'textarea',
    '[contenteditable="true"]',
    'button'
].join(', ');

export const substackProfile: SiteProfile = {
    id: 'substack',
    domains: ['substack.com'],
    select: (node) => {
        if (isSubstackDiscussionUi(node)) return { skip: true };
        return isSubstackDiscussionTextTarget(node) ? node : false;
    },
    supplemental: (root) => getSubstackDiscussionTextTargets(root),
    expandTarget: (node) => getSubstackDiscussionTextTargets(node),
    allowTarget: (node) => {
        if (!isSubstackDiscussionTextTarget(node)) return false;

        return {
            role: 'paragraph',
            source: 'site-profile',
            reason: 'substack-discussion-body'
        };
    },
    skipTarget: (node) => {
        if (isSubstackDiscussionTextCandidate(node) && isUrlOnlyText(getNormalizedText(node))) {
            return { policy: 'hard-skip', role: 'metadata', reason: 'substack-url-only-text' };
        }
        if (isSubstackDiscussionUi(node)) {
            return { policy: 'hard-skip', role: 'ui', reason: 'substack-discussion-ui' };
        }
        if (node.matches(DISCUSSION_LAYOUT_SELECTOR)) {
            return { policy: 'hard-skip', role: 'layout', reason: 'substack-discussion-layout' };
        }
        return false;
    }
};

function getSubstackDiscussionTextTargets(root: ParentNode): Element[] {
    const candidates = [
        ...(root instanceof Element && root.matches(DISCUSSION_TEXT_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<Element>(DISCUSSION_TEXT_SELECTOR))
    ];

    return Array.from(new Set(candidates)).filter(isSubstackDiscussionTextTarget);
}

function isSubstackDiscussionTextTarget(node: Element): boolean {
    if (!isSubstackDiscussionTextCandidate(node)) return false;
    if (node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`)) return false;

    const text = getNormalizedText(node);
    if (isUrlOnlyText(text)) return false;
    return text.length >= 12 && /[A-Za-z]/.test(text);
}

function isSubstackDiscussionTextCandidate(node: Element): boolean {
    return node.matches(DISCUSSION_TEXT_SELECTOR)
        && node.closest(DISCUSSION_ROOT_SELECTOR) !== null
        && node.closest(DISCUSSION_LAYOUT_SELECTOR) !== null
        && node.closest(DISCUSSION_UI_SELECTOR) === null;
}

function isSubstackDiscussionUi(node: Element): boolean {
    return node.matches(DISCUSSION_UI_SELECTOR) || node.closest(DISCUSSION_UI_SELECTOR) !== null;
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function isUrlOnlyText(text: string): boolean {
    return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(text);
}
