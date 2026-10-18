import type { SiteProfile } from './types';

const POST_SELECTOR = '[data-pressable-container="true"]';
// Observed on the feed and post replies: each paragraph owns a source span;
// native Translate controls and thread counters are siblings of that span.
// lang is optional; x1a6qonq is the observed body wrapper when it is absent.
const TEXT_SELECTOR = `${POST_SELECTOR} :is(div[lang], div.x1a6qonq) > div > span[dir="auto"] > span`;
const UI_SELECTOR = 'nav, [role="navigation"], button, [role="button"], time, [translate="no"], [contenteditable="true"]';

function getTextTarget(node: Element): Element | null {
    const target = node.closest(TEXT_SELECTOR);
    if (!target || target.closest(UI_SELECTOR)) return null;
    return target.textContent?.trim() ? target : null;
}

function collectTextTargets(root: ParentNode): Element[] {
    const targets = [
        ...(root instanceof Element ? [getTextTarget(root)] : []),
        ...Array.from(root.querySelectorAll(TEXT_SELECTOR))
    ];
    return Array.from(new Set(targets.filter((node): node is Element => Boolean(node && getTextTarget(node) === node))));
}

export const threadsProfile: SiteProfile = {
    id: 'threads',
    domains: ['threads.com'],
    targetStrategy: 'profile-first',
    select: node => getTextTarget(node) ?? { skip: true },
    supplemental: root => collectTextTargets(root),
    preserveSupplementalTargets: true,
    allowTarget: node => {
        const target = getTextTarget(node);
        return target ? { target, role: 'paragraph', reason: 'threads-post-text' } : false;
    },
    expandTarget: node => {
        const targets = collectTextTargets(node);
        return targets.length > 0 ? targets : false;
    },
    skipTarget: node => {
        if (getTextTarget(node)) return false;
        // Threads is a feed: only recognized post/reply text is reading content.
        // Keep ancestors traversable for dynamic scans, never translate their UI.
        return {
            policy: 'hard-skip',
            role: node.querySelector(TEXT_SELECTOR) ? 'layout' : 'ui',
            reason: 'threads-post-chrome'
        };
    }
};
