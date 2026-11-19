import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';
import { isElementSelfHidden } from '@/entrypoints/utils/domVisibility';

const TOPIC_TITLE = '#topic-title h1[data-topic-id] > a.fancy-title[href]';
const STICKY_HEADING = 'header.d-header h1.header-title';

const COOKED_TEXT_SELECTOR = [
    '.cooked > p',
    '.cooked > blockquote',
    '.cooked > ul > li',
    '.cooked > ol > li'
].join(', ');

const LAYOUT_SELECTOR = [
    'article.boxed.onscreen-post',
    '.topic-post',
    '.post__body',
    '.post__regular',
    '.post__contents',
    '.cooked'
].join(', ');

const UI_SELECTOR = [
    '.sr-only',
    '.topic-avatar',
    '.post-avatar',
    '.topic-meta-data',
    '.names',
    '.post-infos',
    '.post__menu-area',
    '.post-menu-area',
    '.post-controls',
    '.post__actions',
    '.post-actions',
    '.topic-map',
    '.topic-map__contents',
    '.topic-map__stats',
    '.topic-map__users-list',
    '.small-user-list',
    '.cooked-selection-barrier'
].join(', ');

export const ziggitProfile: SiteProfile = {
    id: 'ziggit',
    domains: ['ziggit.dev'],
    smartMutationAttributes: ['data-topic-id', 'href'],
    supplemental: (root, context) => {
        const titles = context.mode === 'smart' ? [...root.querySelectorAll(TOPIC_TITLE)].filter(isTopicTitle) : [];
        return [...getCookedTextTargets(root), ...titles];
    },
    expandTarget: (node, context) => {
        const targets = getCookedTextTargets(node);
        const title = context.scope === 'smart' ? getDynamicTopicTitle(node) : null;
        return title ? [...targets, title] : targets;
    },
    ariaHiddenAncestor: (node) => {
        // Style mutations can be reported on the heading or nested markup.
        const title = node.matches('#topic-title h1[data-topic-id]')
            ? node.querySelector(':scope > a.fancy-title[href]')
            : node.closest('a.fancy-title[href]');
        return title && isTopicTitle(title) ? title.parentElement : null;
    },
    allowTarget: (node, context) => {
        if (context.scope === 'smart' && isTopicTitle(node)) {
            return { role: 'title', reason: 'ziggit-topic-title' };
        }
        if (!isCookedTextTarget(node)) return false;
        return {
            role: 'paragraph',
            source: 'site-profile',
            reason: 'ziggit-cooked-text'
        };
    },
    skipTarget: (node, context) => {
        if (context.scope === 'smart' && isStickyTopicTitle(node)) {
            return { policy: 'hard-skip', role: 'ui', reason: 'ziggit-sticky-topic-title' };
        }
        const excluded = context.scope === 'full' ? '.sr-only, .cooked-selection-barrier' : UI_SELECTOR;
        if (node.matches(excluded) || node.closest(excluded)) {
            return { policy: 'hard-skip', role: 'ui', reason: 'ziggit-ui' };
        }
        if (node.matches(LAYOUT_SELECTOR)) {
            return { policy: 'hard-skip', role: 'layout', reason: 'ziggit-layout-container' };
        }
        return false;
    }
};

function topicId(url: URL): string | undefined {
    const segments = url.pathname.replace(/\/$/, '').split('/').slice(1);
    if (segments.shift() !== 't') return undefined;
    if (segments.length > 1 && !/^\d+$/.test(segments[0])) segments.shift();
    return segments.length && segments.length <= 2 && segments.every(segment => /^\d+$/.test(segment))
        ? segments[0] : undefined;
}

function matchesCurrentTopic(link: Element, id: string | null): boolean {
    if (location.hostname !== 'ziggit.dev' || !id || !link.getAttribute('href')) return false;
    try {
        const page = new URL(location.href);
        const target = new URL(link.getAttribute('href')!, page);
        return target.origin === page.origin && topicId(page) === id && topicId(target) === id;
    } catch {
        return false;
    }
}

function isTopicTitle(node: Element): boolean {
    if (!node.matches(TOPIC_TITLE) || !node.textContent?.trim()
        || node.closest('.notranslate, [translate="no"]')
        || !matchesCurrentTopic(node, node.parentElement?.getAttribute('data-topic-id') ?? null)) return false;

    // The exception is only for the parent heading. The text extractor would
    // otherwise include hidden text nested inside the title link.
    return Array.from(node.querySelectorAll('*')).every(child => !child.textContent?.trim()
        || (!child.matches('.sr-only, .notranslate, [translate="no"]') && !isElementSelfHidden(child)));
}

function isStickyTopicTitle(node: Element): boolean {
    const link = node.closest(STICKY_HEADING)?.querySelector('a.topic-link[data-topic-id][href]');
    return Boolean(link && matchesCurrentTopic(link, link.getAttribute('data-topic-id')));
}

function getDynamicTopicTitle(node: Element): Element | null {
    if (isTopicTitle(node)) return node;
    const region = node.closest('#topic-title')
        ?? (node.matches('.regular.ember-view') ? node.querySelector(':scope > #topic-title') : null);
    const title = region?.querySelector(TOPIC_TITLE);
    return title && (node.contains(title) || title.contains(node)) && isTopicTitle(title) ? title : null;
}

function getCookedTextTargets(root: ParentNode): Element[] {
    const candidates = [
        ...(root instanceof Element && root.matches(COOKED_TEXT_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<Element>(COOKED_TEXT_SELECTOR))
    ];

    return candidates.filter(isCookedTextTarget);
}

function isCookedTextTarget(node: Element): boolean {
    if (!node.matches(COOKED_TEXT_SELECTOR)) return false;
    if (node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`)) return false;
    if (node.closest(UI_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 12 && /[A-Za-z]/.test(text);
}
