import type { SiteProfile } from './types';

const POST_CONTENT_SELECTOR = '.post-content';
const ARTICLE_HEADING_SELECTOR = 'main h1, main h2, article h1, article h2';
const POST_CONTENT_TARGET_SELECTOR = [
    '.post-content > h2',
    '.post-content > h3',
    '.post-content > h4',
    '.post-content > p',
    '.post-content li'
].join(', ');

export const decryptProfile: SiteProfile = {
    id: 'decrypt',
    domains: ['decrypt.co'],
    select: (node, context) => {
        if (isDecryptReadingRail(node)) return { skip: true };

        const target = getDecryptArticleTarget(node);
        return target ?? false;
    },
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        return [
            ...Array.from(root.querySelectorAll<Element>(ARTICLE_HEADING_SELECTOR)),
            ...Array.from(root.querySelectorAll<Element>(POST_CONTENT_TARGET_SELECTOR))
        ]
            .filter(isReadableDecryptArticleTarget)
            .filter((node, index, list) => list.indexOf(node) === index);
    },
    allowTarget: (node, context) => {
        const target = getDecryptArticleTarget(node);
        if (!target) return false;

        return {
            target,
            role: inferDecryptRole(target),
            reason: 'decrypt-article-target'
        };
    },
    skipTarget: (node) => {
        if (!shouldSkipDecryptTarget(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'decrypt-reading-rail-or-wrapper'
        };
    }
};

function getDecryptArticleTarget(node: Element): Element | null {
    const target = findClosestDecryptTarget(node);
    if (!target || !isReadableDecryptArticleTarget(target)) return null;
    return target;
}

function findClosestDecryptTarget(node: Element): Element | null {
    if (node.closest('nav, footer, form, button, [role="navigation"], [role="toolbar"]')) return null;
    if (isDecryptReadingRail(node)) return null;

    if (isDecryptPrimaryHeadingTarget(node)) return node;

    const postTarget = node.closest(POST_CONTENT_TARGET_SELECTOR);
    if (postTarget) return postTarget;

    return null;
}

function isReadableDecryptArticleTarget(node: Element): boolean {
    if (isDecryptReadingRail(node)) return false;
    if (isVisuallyHidden(node)) return false;
    if (!node.closest('main, article')) return false;

    const tag = node.tagName.toLowerCase();
    if (!['h1', 'h2', 'h3', 'h4', 'p', 'li'].includes(tag)) return false;
    if (!isDecryptPrimaryHeadingTarget(node) && !node.closest(POST_CONTENT_SELECTOR)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (/^(news|reviews|artificial intelligence|advertisement|coin prices)$/i.test(text)) return false;

    return true;
}

function isDecryptPrimaryHeadingTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_HEADING_SELECTOR)) return false;
    if (node.closest(POST_CONTENT_SELECTOR)) return true;

    const shell = node.closest('article, main');
    const postContent = shell?.querySelector(POST_CONTENT_SELECTOR);
    if (!postContent) return true;

    return Boolean(node.compareDocumentPosition(postContent) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function shouldSkipDecryptTarget(node: Element): boolean {
    if (isVisuallyHidden(node)) return true;
    if (isDecryptReadingRail(node)) return true;
    if (node.matches(POST_CONTENT_SELECTOR)) return true;
    if (isDecryptBriefWrapper(node)) return true;

    return false;
}

function isDecryptBriefWrapper(node: Element): boolean {
    if (node.tagName.toLowerCase() !== 'div') return false;
    if (!node.closest(POST_CONTENT_SELECTOR)) return false;

    const children = Array.from(node.children);
    const hasBriefHeading = children.some(child => /^h[1-6]$/i.test(child.tagName) && getNormalizedText(child) === 'In brief');
    return hasBriefHeading && node.querySelector('ul > li') !== null;
}

function isDecryptReadingRail(node: Element): boolean {
    const rail = findAncestor(node, (element) => {
        const className = getClassName(element);
        return className.includes('sticky')
            && className.includes('top-24')
            && className.includes('max-w-[12.75rem]');
    });
    if (!rail) return false;

    const label = Array.from(rail.querySelectorAll('p, h2, h3, h4, span, div'))
        .find(element => getNormalizedText(element) === 'Reading');
    return label !== undefined;
}

function findAncestor(node: Element, predicate: (element: Element) => boolean): Element | null {
    let current: Element | null = node;
    while (current) {
        if (predicate(current)) return current;
        current = current.parentElement;
    }

    return null;
}

function inferDecryptRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    return 'paragraph';
}

function getClassName(node: Element): string {
    return typeof node.className === 'string' ? node.className : '';
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function isVisuallyHidden(node: Element): boolean {
    return Boolean(node.closest('.sr-only, [aria-hidden="true"], [hidden]'));
}
