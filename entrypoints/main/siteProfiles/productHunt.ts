import type { SiteProfile } from './types';

const PRODUCT_PATH_PATTERN = /^\/products\/[^/]+(?:\/|$)/;
const PRODUCT_HEADER_SELECTOR = 'main [data-test="header"]';
const CURRENT_LAUNCH_SELECTOR = 'main [data-test="launch"]';
const COMMENT_ROOT_SELECTOR = '[data-test^="comment-"]';
const COMMENT_BODY_SELECTOR = '.prose.prose-format';
const PROMOTION_LABEL_PATTERN = /^(promoted|sponsored|advertisement)$/i;

export const productHuntProfile: SiteProfile = {
    id: 'product-hunt',
    domains: ['producthunt.com'],
    targetStrategy: 'profile-first',
    collectFastPathTargets: (root, context) => {
        if (context.mode !== 'smart' || !isProductPage(root)) return false;

        const document = getOwnerDocument(root);
        return collectProductReadingTargets(document);
    },
    select: (node, context) => {
        if (context.mode !== 'smart' || !isProductPage(node)) return false;
        if (findPromotedArticle(node)) return { skip: true };

        return getProductReadingTarget(node) ?? false;
    },
    allowTarget: (node, context) => {
        if (context.mode !== 'smart' || !isProductPage(node)) return false;

        const target = getProductReadingTarget(node);
        if (!target) return false;

        return {
            target,
            role: /^h[1-6]$/i.test(target.tagName) ? 'title' : 'paragraph',
            reason: 'product-hunt-product-reading-target'
        };
    },
    skipTarget: (node, context) => {
        if (context.mode !== 'smart' || !isProductPage(node)) return false;
        if (!findPromotedArticle(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'metadata',
            reason: 'product-hunt-promoted-card'
        };
    }
};

function collectProductReadingTargets(document: Document): Element[] {
    const header = document.querySelector(PRODUCT_HEADER_SELECTOR);
    const headerTargets = header
        ? Array.from(header.querySelectorAll<Element>('h1, h2, span'))
            .filter(isProductHeaderTarget)
        : [];
    const currentLaunchTargets = collectCurrentLaunchTargets(document);
    const commentTargets = Array.from(document.querySelectorAll<Element>(
        `${COMMENT_ROOT_SELECTOR} ${COMMENT_BODY_SELECTOR}`
    )).filter(isReadableCommentBody);

    return Array.from(new Set([...headerTargets, ...currentLaunchTargets, ...commentTargets]));
}

function getProductReadingTarget(node: Element): Element | null {
    const commentBody = node.matches(COMMENT_BODY_SELECTOR)
        ? node
        : node.closest(COMMENT_BODY_SELECTOR);
    if (commentBody && commentBody.closest(COMMENT_ROOT_SELECTOR) && isReadableCommentBody(commentBody)) {
        return commentBody;
    }

    if (node.matches(COMMENT_ROOT_SELECTOR)) {
        const nestedCommentBody = node.querySelector(COMMENT_BODY_SELECTOR);
        if (nestedCommentBody && isReadableCommentBody(nestedCommentBody)) return nestedCommentBody;
    }

    const headerTarget = node.matches('h1, h2, span')
        ? node
        : node.closest('h1, h2, span');
    if (headerTarget && isProductHeaderTarget(headerTarget)) return headerTarget;

    return getCurrentLaunchTarget(node);
}

function collectCurrentLaunchTargets(document: Document): Element[] {
    const launch = document.querySelector(CURRENT_LAUNCH_SELECTOR);
    if (!launch) return [];

    const intro = Array.from(launch.children)
        .find(child => child.matches('section') && child.querySelector('h2'));
    const introTargets = intro
        ? Array.from(intro.querySelectorAll<Element>('h2, span'))
            .filter(target => isCurrentLaunchIntroTarget(target, intro))
        : [];
    const description = Array.from(launch.children)
        .find(child => isCurrentLaunchDescription(child));

    return description ? [...introTargets, description] : introTargets;
}

function getCurrentLaunchTarget(node: Element): Element | null {
    const launch = node.closest(CURRENT_LAUNCH_SELECTOR);
    if (!launch) return null;

    const directChild = getDirectChildWithin(node, launch);
    if (!directChild) return null;
    if (isCurrentLaunchDescription(directChild)) return directChild;
    if (!directChild.matches('section') || !directChild.querySelector('h2')) return null;

    const target = node.matches('h2, span') ? node : node.closest('h2, span');
    return target && isCurrentLaunchIntroTarget(target, directChild) ? target : null;
}

function isCurrentLaunchIntroTarget(node: Element, intro: Element): boolean {
    if (!intro.contains(node)) return false;
    if (node.closest('button, nav, [role="button"], [role="navigation"]')) return false;

    const text = getNormalizedText(node);
    if (text.length < 3 || text.length > 240) return false;
    return node.tagName.toLowerCase() === 'h2'
        || (node.tagName.toLowerCase() === 'span' && /[A-Za-z]/.test(text));
}

function isCurrentLaunchDescription(node: Element): boolean {
    if (!node.matches('.prose:not(.prose-format)')) return false;
    if (node.parentElement?.matches(CURRENT_LAUNCH_SELECTOR) !== true) return false;

    const text = getNormalizedText(node);
    return text.length >= 80 && /[A-Za-z]/.test(text);
}

function isProductHeaderTarget(node: Element): boolean {
    if (!node.closest(PRODUCT_HEADER_SELECTOR)) return false;
    if (node.closest('button, nav, [role="button"], [role="navigation"]')) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;
    if (/^h[12]$/i.test(node.tagName)) return text.length <= 240;

    return node.tagName.toLowerCase() === 'span'
        && text.length >= 80
        && /[.!?]/.test(text);
}

function isReadableCommentBody(node: Element): boolean {
    if (!node.matches(COMMENT_BODY_SELECTOR) || !node.closest(COMMENT_ROOT_SELECTOR)) return false;
    if (node.closest('button, nav, [role="button"], [role="navigation"]')) return false;

    const text = getNormalizedText(node);
    return text.length >= 3 && /[A-Za-z]/.test(text);
}

function findPromotedArticle(node: Element): Element | null {
    const article = node.matches('article') ? node : node.closest('article');
    if (!article) return null;

    const hasPromotionLabel = Array.from(article.querySelectorAll('span, div'))
        .some(element => PROMOTION_LABEL_PATTERN.test(getDirectText(element)));
    return hasPromotionLabel ? article : null;
}

function isProductPage(root: ParentNode): boolean {
    const document = getOwnerDocument(root);
    return PRODUCT_PATH_PATTERN.test(window.location.pathname)
        && document.querySelector(PRODUCT_HEADER_SELECTOR) !== null;
}

function getOwnerDocument(root: ParentNode): Document {
    return root instanceof Document ? root : root.ownerDocument ?? document;
}

function getDirectChildWithin(node: Element, ancestor: Element): Element | null {
    let current: Element | null = node;
    while (current?.parentElement && current.parentElement !== ancestor) {
        current = current.parentElement;
    }
    return current?.parentElement === ancestor ? current : null;
}

function getDirectText(node: Element): string {
    return Array.from(node.childNodes)
        .filter(child => child.nodeType === Node.TEXT_NODE)
        .map(child => child.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
