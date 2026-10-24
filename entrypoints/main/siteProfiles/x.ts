import type { SiteProfile } from './types';
import { classifySocialInlineLink } from './socialInlineLinks';

// Keep the legacy tweet marker and the public post/reply structure observed on X.
// dir/lang alone also occur on authors, metadata and profile cards.
const TEXT_SELECTOR = 'article [data-testid="tweetText"], article div[dir="auto"].whitespace-pre-wrap';
const UI_SELECTOR = 'nav, [role="navigation"], header, footer, aside, [data-testid="sidebarColumn"], [data-testid="User-Name"], [data-testid="UserName"], [data-testid="UserDescription"], button, [role="button"], time, [translate="no"], [contenteditable="true"]';

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

export const xProfile: SiteProfile = {
    id: 'x',
    domains: ['x.com'],
    targetStrategy: 'profile-first',
    inlineLink: node => getTextTarget(node) ? classifySocialInlineLink(node) : false,
    select: node => getTextTarget(node) ?? { skip: true },
    supplemental: root => collectTextTargets(root),
    preserveSupplementalTargets: true,
    allowTarget: node => {
        const target = getTextTarget(node);
        return target ? { target, role: 'paragraph', reason: 'x-post-text' } : false;
    },
    expandTarget: node => {
        const targets = collectTextTargets(node);
        return targets.length > 0 ? targets : false;
    },
    skipTarget: node => {
        if (getTextTarget(node)) return false;
        // Both scopes translate posts/replies only. Ancestors remain traversable
        // for newly loaded posts, without becoming generic UI fallback targets.
        return {
            policy: 'hard-skip',
            role: node.querySelector(TEXT_SELECTOR) ? 'layout' : 'ui',
            reason: 'x-post-chrome'
        };
    }
};
