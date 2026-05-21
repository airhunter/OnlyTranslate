import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const mediumProfile: SiteProfile = {
    id: 'medium',
    domains: ['medium.com', 'towardsdatascience.com'],
    select: (node) => {
        if (shouldSkipMediumElement(node)) return { skip: true };

        const articleTitle = findMatchingElement(node, 'h1');
        if (articleTitle) return articleTitle;

        const articleSubtitle = findMatchingElement(node, 'h2');
        if (articleSubtitle) return articleSubtitle;

        const articleParagraph = findMatchingElement(node, 'p');
        if (articleParagraph) return articleParagraph;

        const articleListItem = findMatchingElement(node, 'li');
        if (articleListItem) return articleListItem;

        const blockquote = findMatchingElement(node, 'blockquote');
        if (blockquote) return blockquote;

        const articleBody = findMatchingElement(node, 'article section');
        if (articleBody) return articleBody;

        const authorBio = findMatchingElement(node, 'p.pw-author-note');
        if (authorBio) return authorBio;

        const comment = findMatchingElement(node, 'div.pw-responses-thread p');
        if (comment) return comment;

        return false;
    },
    supplemental: (root) => collectMediumSupplementalTargets(root),
    allowTarget: (node) => {
        const relatedRoot = findContainingRelatedArticleRoot(node);
        if (!relatedRoot || !isRelatedArticleTextTarget(node, relatedRoot)) return false;

        return {
            target: node,
            role: node.matches('h1, h2, h3, h4, [class*="title"], [class*="headline"]') ? 'title' : 'summary',
            reason: 'medium-related-article-content'
        };
    },
    skipTarget: (node) => {
        if (!shouldHardSkipMediumTarget(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'metadata',
            reason: 'medium-metadata-or-social'
        };
    }
};

const RELATED_ARTICLES_PATTERN = /\b(related articles?|recommended articles?|read next|more from)\b/i;
const RELATED_ROOT_SELECTOR = 'section, aside, div';
const RELATED_TEXT_SELECTOR = [
    'h2',
    'h3',
    'h4',
    'p',
    '[class*="title"]',
    '[class*="headline"]',
    '[class*="description"]',
    '[class*="subtitle"]',
    '[class*="excerpt"]',
    '[data-testid*="title"]',
    '[data-testid*="description"]'
].join(', ');

function collectMediumSupplementalTargets(root: ParentNode): Element[] {
    return removeNestedTargets(findRelatedArticleRoots(root).flatMap(collectRelatedArticleTextTargets));
}

function findRelatedArticleRoots(root: ParentNode): Element[] {
    const roots = new Set<Element>();

    for (const element of root.querySelectorAll<Element>(RELATED_ROOT_SELECTOR)) {
        if (isRelatedArticleRoot(element)) roots.add(element);
    }

    for (const heading of root.querySelectorAll<Element>('h2, h3, [role="heading"]')) {
        if (!RELATED_ARTICLES_PATTERN.test(getNormalizedText(heading))) continue;

        const relatedRoot = findNearestRelatedArticleRoot(heading);
        if (relatedRoot) roots.add(relatedRoot);
    }

    return Array.from(roots).filter(root => !Array.from(roots).some(other => root !== other && other.contains(root)));
}

function isRelatedArticleRoot(element: Element): boolean {
    if (element.closest('article, nav, footer, form, dialog')) return false;
    if (!RELATED_ARTICLES_PATTERN.test(`${getElementHint(element)} ${getDirectHeadingText(element)}`)) return false;

    const text = getNormalizedText(element);
    if (text.length > 6000) return false;

    return element.querySelectorAll('a').length > 0
        && element.querySelectorAll(RELATED_TEXT_SELECTOR).length >= 2;
}

function findNearestRelatedArticleRoot(heading: Element): Element | null {
    let current = heading.parentElement;
    let depth = 0;

    while (current && current !== document.body && depth < 5) {
        if (isRelatedArticleRoot(current)) return current;
        current = current.parentElement;
        depth += 1;
    }

    return null;
}

function findContainingRelatedArticleRoot(element: Element): Element | null {
    let current: Element | null = element;

    while (current && current !== document.body) {
        if (current.matches(RELATED_ROOT_SELECTOR) && isRelatedArticleRoot(current)) return current;
        current = current.parentElement;
    }

    return null;
}

function collectRelatedArticleTextTargets(root: Element): Element[] {
    return Array.from(root.querySelectorAll<Element>(RELATED_TEXT_SELECTOR))
        .filter(element => isRelatedArticleTextTarget(element, root));
}

function isRelatedArticleTextTarget(element: Element, root: Element): boolean {
    const text = getNormalizedText(element);
    if (text.length < 12 || text.length > 360) return false;
    if (RELATED_ARTICLES_PATTERN.test(text)) return false;
    if (/^(\d+\s*min read|read more|continue reading|by\s+.+|published\s+.+)$/i.test(text)) return false;
    if (element.closest('nav, footer, form, dialog, button, [role="button"]')) return false;
    if (element.closest('[class*="share"], [class*="social"], [class*="author"], [class*="newsletter"], [class*="subscribe"]')) return false;
    if (!element.closest('a, article, li, [class*="card"], [class*="post"], [class*="article"]')) return false;

    const nearestArticleSurface = element.closest('a, article, li, [class*="card"], [class*="post"], [class*="article"]');
    return Boolean(nearestArticleSurface && root.contains(nearestArticleSurface));
}

function removeNestedTargets(nodes: Element[]): Element[] {
    const uniqueNodes = Array.from(new Set(nodes));
    return uniqueNodes.filter(node => !uniqueNodes.some(other => node !== other && other.contains(node)));
}

function shouldSkipMediumElement(node: Element): boolean {
    const skipSelectors = [
        'nav',
        'div.metabar',
        'div.js-metabar',
        'div.js-sidebarContainer',
        'div.js-sidebar',
        'button',
        'input',
        'textarea',
        'pre',
        'code',
        'footer',
        'div.pw-multi-author-card',
        'div.pw-card-body div.pw-card-description ~ *',
        'div.pw-post-actions',
        'div.pw-responses-header',
    ];

    for (const selector of skipSelectors) {
        if (node.matches?.(selector)) return true;

        let parent = node.parentElement;
        while (parent) {
            if (parent.matches?.(selector)) return true;
            parent = parent.parentElement;
        }
    }

    const skipClassKeywords = ['js-', 'btn', 'button', 'u-', 'overlay', 'postActionsBar'];
    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword)) return true;
        }
    }

    if (node.tagName?.toLowerCase() === 'pre' || node.tagName?.toLowerCase() === 'code') return true;
    if (node.tagName?.toLowerCase() === 'svg' || node.tagName?.toLowerCase() === 'img') return true;

    return false;
}

function shouldHardSkipMediumTarget(node: Element): boolean {
    const text = getNormalizedText(node);
    if (isMediumMetadataText(text)) return true;
    if (findContainingRelatedArticleRoot(node)) return false;

    const hardSkipSelectors = [
        'nav',
        'footer',
        'form',
        'button',
        '[role="button"]',
        '.author-social-links',
        '.share-this-article',
        '.post-topics',
        '.tags',
        '[class*="share"]',
        '[class*="social"]',
        '[class*="author-card"]',
        '[class*="byline"]',
        '[class*="tag"]',
        '[class*="topic"]',
        '[class*="readTime"]',
        '[class*="readingTime"]',
        '[data-testid*="author"]',
        '[data-testid*="share"]'
    ];

    if (hardSkipSelectors.some(selector => node.closest(selector))) return true;

    if (/^(medium|linkedin|twitter|x|youtube|facebook|written by|share this article)$/i.test(text)) return true;
    if (/^see all from\s+/i.test(text)) return true;

    return false;
}

function isMediumMetadataText(text: string): boolean {
    if (/^\d+\s*min read$/i.test(text)) return true;
    if (/^\w+\s+\d{1,2},\s+\d{4}(\s*(·|•)\s*\d+\s*min read)?$/i.test(text)) return true;
    if (/^(data science|pandas|productivity|python|vectorization)(,\s*(data science|pandas|productivity|python|vectorization))*$/i.test(text)) return true;

    return false;
}

function getElementHint(element: Element): string {
    return [
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('data-testid') ?? '',
        element.getAttribute('data-test-id') ?? ''
    ].join(' ');
}

function getDirectHeadingText(element: Element): string {
    return Array.from(element.children)
        .filter(child => child.matches?.('h2, h3, [role="heading"]'))
        .map(getNormalizedText)
        .join(' ');
}

function getNormalizedText(element: Element): string {
    return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
