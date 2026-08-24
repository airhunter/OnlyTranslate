import type { SiteProfile } from './types';

const BLOG_PATH_PATTERN = /^\/blog\/[^/]+\/?$/;
const BLOG_TITLE_SELECTOR = 'body > header > h1';

export const claytonRamseyProfile: SiteProfile = {
    id: 'clayton-ramsey-blog',
    domains: ['claytonwramsey.com'],
    supplemental: (root, context) => {
        if (context.mode !== 'smart' || !isClaytonBlogPost(root)) return [];

        const title = getOwnerDocument(root).querySelector<Element>(BLOG_TITLE_SELECTOR);
        return title && isReadableTitle(title) ? [title] : [];
    },
    allowTarget: (node, context) => {
        if (context.mode !== 'smart' || !node.matches(BLOG_TITLE_SELECTOR)) return false;
        if (!isClaytonBlogPost(node) || !isReadableTitle(node)) return false;

        return {
            target: node,
            role: 'title',
            reason: 'clayton-ramsey-blog-title'
        };
    }
};

function isClaytonBlogPost(root: ParentNode): boolean {
    if (!BLOG_PATH_PATTERN.test(window.location.pathname)) return false;

    const document = getOwnerDocument(root);
    const main = document.querySelector('body > main');
    if (!main) return false;

    const substantialParagraphs = Array.from(main.querySelectorAll('p, blockquote'))
        .filter(paragraph => getNormalizedText(paragraph).length >= 80);
    return substantialParagraphs.length >= 2;
}

function getOwnerDocument(root: ParentNode): Document {
    return root instanceof Document ? root : root.ownerDocument ?? document;
}

function isReadableTitle(node: Element): boolean {
    const text = getNormalizedText(node);
    return text.length >= 3 && text.length <= 240 && /[A-Za-z]/.test(text);
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
