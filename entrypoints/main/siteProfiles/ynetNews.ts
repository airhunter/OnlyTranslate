import type { SiteProfile, SiteProfileMode } from './types';

const ARTICLE_BODY_SELECTOR = '#ArticleBodyComponent, .ArticleBodyComponent';

const ARTICLE_TARGET_SELECTOR = [
    '#ArticleHeaderComponent h1.mainTitle',
    '#ArticleHeaderComponent .subTitleWrapper > h2',
    '.ArticleBodyComponent .text_editor_paragraph',
    '.ArticleBodyComponent .ImageCaption'
].join(', ');

const ARTICLE_METADATA_SELECTOR = [
    '.authorAndDateContainer',
    '.authors',
    '.DateDisplay',
    '.ArticleTagsComponent',
    '.SiteArticleSocialShareNew1280',
    '.SiteArticleComments',
    '.Talkbacks-widget-eng-grid1280',
    '.taboola-Div',
    '.taboola-general',
    '.no-print',
    '[id^="ads."]'
].join(', ');

const ARTICLE_LAYOUT_WRAPPER_SELECTOR = [
    '#ArticleHeaderComponent',
    ARTICLE_BODY_SELECTOR,
    '.textEditor_container',
    '.DraftEditor-root',
    '.DraftEditor-editorContainer',
    '.public-DraftEditor-content',
    '[data-contents="true"]'
].join(', ');

export const ynetNewsProfile: SiteProfile = {
    id: 'ynetnews',
    domains: ['ynetnews.com'],
    targetStrategy: 'profile-first',
    select: (node, context) => {
        if (context.mode !== 'smart') return false;

        const target = findYnetArticleTarget(node, context.mode);
        return target ?? false;
    },
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return Array.from(root.querySelectorAll<Element>(ARTICLE_TARGET_SELECTOR))
            .filter(node => isReadableYnetArticleTarget(node, context.mode))
            .filter((node, index, list) => list.indexOf(node) === index);
    },
    allowTarget: (node, context) => {
        const target = findYnetArticleTarget(node, context.mode);
        if (!target) return false;

        return {
            target,
            role: inferYnetRole(target),
            reason: 'ynetnews-article-target'
        };
    },
    skipTarget: (node) => {
        if (!shouldSkipYnetArticleTarget(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'ynetnews-metadata-or-wrapper'
        };
    }
};

function findYnetArticleTarget(node: Element, mode: SiteProfileMode): Element | null {
    const target = findClosestYnetTarget(node);
    if (!target || !isReadableYnetArticleTarget(target, mode)) return null;

    return target;
}

function findClosestYnetTarget(node: Element): Element | null {
    if (safeMatches(node, ARTICLE_TARGET_SELECTOR)) return node;

    try {
        return node.closest(ARTICLE_TARGET_SELECTOR);
    } catch (_) {
        return null;
    }
}

function isReadableYnetArticleTarget(node: Element, mode: SiteProfileMode): boolean {
    if (mode !== 'smart') return false;
    if (!hasYnetArticleBody(node.ownerDocument)) return false;
    if (isYnetMetadata(node)) return false;

    const tag = node.tagName.toLowerCase();
    if (!/^h[1-6]$/.test(tag) && !['div'].includes(tag)) return false;

    if (!isYnetHeaderTarget(node) && !node.closest(ARTICLE_BODY_SELECTOR)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3 || !/[A-Za-z]/.test(text)) return false;
    if (/^(related topics|comments|new comment|add a comment)$/i.test(text)) return false;

    return true;
}

function shouldSkipYnetArticleTarget(node: Element): boolean {
    if (isYnetMetadata(node)) return true;
    return safeMatches(node, ARTICLE_LAYOUT_WRAPPER_SELECTOR);
}

function isYnetHeaderTarget(node: Element): boolean {
    return safeMatches(node, '#ArticleHeaderComponent h1.mainTitle, #ArticleHeaderComponent .subTitleWrapper > h2');
}

function isYnetMetadata(node: Element): boolean {
    if (safeMatches(node, ARTICLE_METADATA_SELECTOR)) return true;

    try {
        return node.closest(ARTICLE_METADATA_SELECTOR) !== null;
    } catch (_) {
        return false;
    }
}

function hasYnetArticleBody(root: ParentNode): boolean {
    if (root instanceof Element && safeMatches(root, ARTICLE_BODY_SELECTOR)) return true;
    return root.querySelector?.(ARTICLE_BODY_SELECTOR) !== null;
}

function inferYnetRole(node: Element) {
    if (safeMatches(node, '#ArticleHeaderComponent h1.mainTitle')) return 'title';
    if (safeMatches(node, '#ArticleHeaderComponent .subTitleWrapper > h2, .ArticleBodyComponent .ImageCaption')) return 'summary';
    return 'paragraph';
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function safeMatches(node: Element, selector: string): boolean {
    try {
        return node.matches(selector);
    } catch (_) {
        return false;
    }
}
