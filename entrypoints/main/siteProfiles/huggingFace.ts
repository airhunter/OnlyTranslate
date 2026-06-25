import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

// Hugging Face blog articles currently wrap markdown-rendered content in
// `.blog-content`; if that shell changes, revisit this profile before relying
// on the generic smart scan fallback.
const BLOG_CONTENT_SELECTOR = '.blog-content';
const ARTICLE_TARGET_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption';
const ARTICLE_WRAPPER_SELECTOR = [
    BLOG_CONTENT_SELECTOR,
    `${BLOG_CONTENT_SELECTOR} > div`,
    `${BLOG_CONTENT_SELECTOR} > section`
].join(', ');

export const huggingFaceProfile: SiteProfile = {
    id: 'hugging-face',
    domains: ['huggingface.co'],
    targetStrategy: 'profile-first',
    select: (node) => {
        if (shouldSkipHuggingFaceBlogNode(node)) return { skip: true };

        const target = getHuggingFaceBlogTarget(node);
        return target ?? false;
    },
    allowTarget: (node) => {
        const target = getHuggingFaceBlogTarget(node);
        if (!target) return false;

        return {
            target,
            role: inferHuggingFaceRole(target),
            reason: 'hugging-face-blog-article-target'
        };
    },
    skipTarget: (node) => {
        if (shouldSkipHuggingFaceBlogNode(node)) {
            return {
                policy: 'hard-skip',
                role: 'metadata',
                reason: 'hugging-face-blog-metadata'
            };
        }

        if (!isHuggingFaceBlogWrapper(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'layout',
            reason: 'hugging-face-blog-wrapper'
        };
    },
    afterBilingualAppend: (node, translationNode) => {
        if (!isHuggingFaceBlogHeading(node)) return;

        node.style.display = 'block';
        translationNode.style.display = 'block';
        translationNode.style.width = '100%';
    }
};

function getHuggingFaceBlogTarget(node: Element): Element | null {
    const target = node.closest(ARTICLE_TARGET_SELECTOR);
    if (!target || !isReadableHuggingFaceBlogTarget(target)) return null;
    return target;
}

function isReadableHuggingFaceBlogTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_TARGET_SELECTOR)) return false;
    if (!node.closest(BLOG_CONTENT_SELECTOR)) return false;
    if (isManagedTranslationElement(node)) return false;
    if (shouldSkipHuggingFaceBlogNode(node)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;

    return /[A-Za-z]/.test(text);
}

function shouldSkipHuggingFaceBlogNode(node: Element): boolean {
    if (isHuggingFaceUpvoteControl(node)) return true;
    if (!node.closest(BLOG_CONTENT_SELECTOR)) return false;
    if (findHuggingFaceBlogIndexLinkMetaContainer(node)) return true;
    if (node.closest('.not-prose')) return true;
    if (node.closest('nav, footer, form, button, [role="navigation"], [role="toolbar"]')) return true;

    return false;
}

function isHuggingFaceUpvoteControl(node: Element): boolean {
    return Boolean(node.closest('[data-target="UpvoteControl"]'));
}

function findHuggingFaceBlogIndexLinkMetaContainer(node: Element): Element | null {
    let current: Element | null = node;

    while (current && current !== document.body) {
        if (current.matches(BLOG_CONTENT_SELECTOR)) return null;
        if (
            current.tagName.toLowerCase() === 'div'
            && current.closest(BLOG_CONTENT_SELECTOR)
            && current.querySelector(':scope a[href="/blog"], :scope a[href="/blog/"]')
            && !current.querySelector(ARTICLE_TARGET_SELECTOR)
        ) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
}

function isHuggingFaceBlogWrapper(node: Element): boolean {
    if (!node.matches(ARTICLE_WRAPPER_SELECTOR)) return false;
    if (!node.closest(BLOG_CONTENT_SELECTOR) && !node.matches(BLOG_CONTENT_SELECTOR)) return false;
    if (isReadableHuggingFaceBlogTarget(node)) return false;

    return node.querySelector(ARTICLE_TARGET_SELECTOR) !== null
        || shouldSkipHuggingFaceBlogNode(node);
}

function isHuggingFaceBlogHeading(node: Element): boolean {
    return /^h[1-6]$/i.test(node.tagName)
        && node.closest(BLOG_CONTENT_SELECTOR) !== null;
}

function inferHuggingFaceRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    if (tag === 'figcaption') return 'summary';
    return 'paragraph';
}

function isManagedTranslationElement(node: Element): boolean {
    return Boolean(node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`));
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
