import type { SiteProfile } from './types';
import { classifySocialInlineLink } from './socialInlineLinks';

const POST_SELECTOR = '[data-pressable-container="true"]';
// Observed on the feed and post replies: each paragraph owns a source span;
// native Translate controls and thread counters are siblings of that span.
// lang is optional; x1a6qonq is the observed body wrapper when it is absent.
const BODY_SELECTOR = `${POST_SELECTOR} :is(div[lang], div.x1a6qonq) > div > span[dir="auto"]`;
const TEXT_SELECTOR = `${BODY_SELECTOR} > span`;
const UI_SELECTOR = 'nav, [role="navigation"], button, [role="button"], time, [translate="no"], [contenteditable="true"]';

function getTextTarget(node: Element, mode: string): Element | null {
    if (node.closest(UI_SELECTOR)) return null;
    const body = node.closest(BODY_SELECTOR);
    // Observed Threads short links are siblings of the inner source span.
    // Smart mode owns the complete line; Full Page keeps its existing targets.
    const target = mode === 'smart' && body?.querySelector(':scope > a[href]')
        ? body : node.closest(TEXT_SELECTOR);
    if (!target || target.closest(UI_SELECTOR)) return null;
    return target.textContent?.trim() ? target : null;
}

function collectTextTargets(root: ParentNode, mode: string): Element[] {
    const targets = [
        ...(root instanceof Element ? [getTextTarget(root, mode)] : []),
        ...Array.from(root.querySelectorAll(TEXT_SELECTOR))
    ];
    return Array.from(new Set(targets.map(node => node && getTextTarget(node, mode)).filter((node): node is Element => Boolean(node))));
}

export const threadsProfile: SiteProfile = {
    id: 'threads',
    domains: ['threads.com'],
    targetStrategy: 'profile-first',
    inlineLink: node => getTextTarget(node, 'smart') ? classifySocialInlineLink(node) : false,
    select: (node, context) => getTextTarget(node, context.mode) ?? { skip: true },
    supplemental: (root, context) => collectTextTargets(root, context.mode),
    preserveSupplementalTargets: true,
    allowTarget: (node, context) => {
        const target = getTextTarget(node, context.scope);
        return target ? { target, role: 'paragraph', reason: 'threads-post-text' } : false;
    },
    expandTarget: (node, context) => {
        const targets = collectTextTargets(node, context.scope);
        return targets.length > 0 ? targets : false;
    },
    skipTarget: (node, context) => {
        if (getTextTarget(node, context.scope)) return false;
        // Threads is a feed: only recognized post/reply text is reading content.
        // Keep ancestors traversable for dynamic scans, never translate their UI.
        return {
            policy: 'hard-skip',
            role: node.querySelector(TEXT_SELECTOR) ? 'layout' : 'ui',
            reason: 'threads-post-chrome'
        };
    }
};
