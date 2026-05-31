import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

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
    supplemental: (root) => getCookedTextTargets(root),
    expandTarget: (node) => getCookedTextTargets(node),
    allowTarget: (node) => {
        if (!isCookedTextTarget(node)) return false;
        return {
            role: 'paragraph',
            source: 'site-profile',
            reason: 'ziggit-cooked-text'
        };
    },
    skipTarget: (node) => {
        if (node.matches(UI_SELECTOR) || node.closest(UI_SELECTOR)) {
            return { policy: 'hard-skip', role: 'ui', reason: 'ziggit-ui' };
        }
        if (node.matches(LAYOUT_SELECTOR)) {
            return { policy: 'hard-skip', role: 'layout', reason: 'ziggit-layout-container' };
        }
        return false;
    }
};

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
