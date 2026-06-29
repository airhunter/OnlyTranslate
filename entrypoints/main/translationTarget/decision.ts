import { getTranslatableText, isStrongReadableLeaf } from '@/entrypoints/main/dom';
import { siteProfiles } from '@/entrypoints/main/siteProfiles';
import { getContentFilterDecision, shouldKeepReadableDescendantsInSkipSelf } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier';
import { getMainDomain } from '@/entrypoints/utils/domain';
import {
    getStructuralHint,
    hasSentencePunctuation,
    PROSE_TEXT_MIN_SHORT
} from '@/entrypoints/utils/proseSignals';
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
import {
    getCachedContentFilterDecision,
    getCachedContentUnitDecision,
    getCachedNormalizedText,
    getCachedVisibility
} from './scanContext';
import type {
    TranslationTargetCandidate,
    TranslationTargetContext,
    TranslationTargetDecision,
    TranslationTargetOverride,
    TranslationTargetRole,
    TranslationTargetSkip
} from './types';

const HARD_SKIP_SELECTOR = [
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'input',
    'textarea',
    'select',
    'pre',
    'code',
    'table.highlight',
    'table.diff-table',
    '.notranslate',
    '[translate="no"]',
    `.${BILINGUAL_CONTENT_CLASS}`,
    `[${TRANSLATED_ATTR}="true"]`
].join(', ');

const HARD_SKIP_ROLES = new Set([
    'navigation',
    'menu',
    'menubar',
    'toolbar',
    'tablist',
    'tab',
    'dialog'
]);

export function decideTranslationTarget(
    candidate: TranslationTargetCandidate,
    context: TranslationTargetContext
): TranslationTargetDecision {
    const node = candidate.node;
    const profile = getCurrentSiteProfile();

    const profileSkip = profile?.skipTarget?.(node, context);
    if (profileSkip && profileSkip.policy === 'hard-skip') {
        return skipDecision(node, profileSkip, candidate, context);
    }

    const hardSkipReason = getGenericHardSkipReason(node, context);
    if (hardSkipReason) {
        return {
            node,
            target: node,
            policy: 'hard-skip',
            role: 'ui',
            source: candidate.source,
            reasons: [...(candidate.reasons ?? []), hardSkipReason]
        };
    }

    const filterSkip = context.mode === 'smart' ? getContentFilterSkip(node, context) : undefined;
    if (filterSkip?.policy === 'hard-skip') {
        return skipDecision(node, filterSkip, candidate, context);
    }

    const profileAllow = profile?.allowTarget?.(node, context);
    if (profileAllow) {
        return allowDecision(node, profileAllow, candidate, context);
    }

    const contentUnitDecision = getCachedContentUnitDecision(context.grabOptions?.scanContext, node, classifyContentUnit);
    if (contentUnitDecision.action === 'skip' && contentUnitDecision.confidence >= 0.85) {
        return {
            node,
            target: node,
            policy: 'hard-skip',
            role: mapContentUnitRole(contentUnitDecision.kind),
            source: 'content-unit',
            reasons: [...(candidate.reasons ?? []), ...contentUnitDecision.reasons]
        };
    }
    if (contentUnitDecision.action === 'allow' && contentUnitDecision.confidence >= 0.7) {
        return {
            node,
            target: node,
            policy: 'allow',
            role: mapContentUnitRole(contentUnitDecision.kind),
            source: 'content-unit',
            reasons: [...(candidate.reasons ?? []), ...contentUnitDecision.reasons]
        };
    }
    if (candidate.source === 'site-profile') {
        return {
            node,
            target: node,
            policy: 'allow',
            role: inferDefaultRole(node),
            source: 'site-profile',
            reasons: [...(candidate.reasons ?? []), 'legacy-site-profile-selected']
        };
    }

    if (profileSkip) {
        return skipDecision(node, profileSkip, candidate, context);
    }

    if (filterSkip) {
        return skipDecision(node, filterSkip, candidate, context);
    }

    return {
        node,
        target: node,
        policy: 'allow',
        role: inferDefaultRole(node),
        source: candidate.source,
        reasons: [...(candidate.reasons ?? []), 'candidate-accepted']
    };
}

export function getBilingualAppendTarget(node: HTMLElement, context: TranslationTargetContext): HTMLElement {
    const profile = getCurrentSiteProfile();
    const profileAppendTarget = profile?.appendTarget?.(node, context);
    if (profileAppendTarget) return profileAppendTarget;

    if (!isOpenExpandableReadingContainer(node)) return node;

    const candidates = Array.from(node.querySelectorAll<HTMLElement>(
        ':scope > *, :scope [class*="detail"], :scope [class*="content"], :scope [class*="body"], :scope p'
    ));
    const target = candidates
        .filter(candidate => isVisibleForTranslation(candidate, context))
        .find(candidate => {
            const text = getCachedNormalizedText(context.grabOptions?.scanContext, candidate);
            return text.length >= PROSE_TEXT_MIN_SHORT && hasSentencePunctuation(text);
        });

    return target ?? node;
}

export function isVisibleForTranslation(element: Element, context?: TranslationTargetContext): boolean {
    return getCachedVisibility(context?.grabOptions?.scanContext, element, computeVisibleForTranslation);
}

function computeVisibleForTranslation(element: Element): boolean {
    let current: Element | null = element;

    while (current) {
        if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') return false;

        try {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        } catch (_) {}

        current = current.parentElement;
    }

    return true;
}

export function isExpandableReadingContainer(element: Element): boolean {
    return element.hasAttribute('aria-expanded')
        && element.getAttribute('role')?.toLowerCase() === 'button';
}

export function isOpenExpandableReadingContainer(element: Element): boolean {
    return isExpandableReadingContainer(element) && element.getAttribute('aria-expanded') === 'true';
}

function allowDecision(
    node: Element,
    override: TranslationTargetOverride,
    candidate: TranslationTargetCandidate,
    context: TranslationTargetContext
): TranslationTargetDecision {
    const target = override.target ?? node;
    const appendTarget = target instanceof HTMLElement
        ? getBilingualAppendTarget(target, context)
        : override.appendTarget;

    return {
        node,
        target,
        appendTarget: override.appendTarget ?? appendTarget,
        policy: 'allow',
        role: override.role ?? inferDefaultRole(target),
        source: override.source ?? 'site-profile',
        reasons: [...(candidate.reasons ?? []), override.reason]
    };
}

function skipDecision(
    node: Element,
    skip: TranslationTargetSkip,
    candidate: TranslationTargetCandidate,
    _context: TranslationTargetContext
): TranslationTargetDecision {
    return {
        node,
        target: node,
        policy: skip.policy,
        role: skip.role ?? 'ui',
        source: candidate.source,
        reasons: [...(candidate.reasons ?? []), skip.reason]
    };
}

function getContentFilterSkip(element: Element, context: TranslationTargetContext): TranslationTargetSkip | undefined {
    let current: Element | null = element;

    while (current) {
        const decision = getCachedContentFilterDecision(context.grabOptions?.scanContext, current, getContentFilterDecision);
        if (decision === 'skip-subtree') {
            const tag = current.tagName.toLowerCase();
            const role = current.getAttribute('role')?.toLowerCase();
            if (tag === 'aside' || role === 'complementary') {
                return { policy: 'soft-skip', role: 'metadata', reason: `content-filter:${tag}:soft-subtree` };
            }
            return { policy: 'hard-skip', role: 'ui', reason: `content-filter:${current.tagName.toLowerCase()}:skip-subtree` };
        }
        if (decision === 'skip-self') {
            if (
                isStrongReadableLeaf(element, context.grabOptions?.scanContext)
                && shouldKeepReadableDescendantsInSkipSelf(current)
            ) {
                current = current.parentElement;
                continue;
            }
            return { policy: 'soft-skip', role: 'metadata', reason: `content-filter:${current.tagName.toLowerCase()}:skip-self` };
        }
        current = current.parentElement;
    }

    return undefined;
}

function getGenericHardSkipReason(element: Element, context: TranslationTargetContext): string | undefined {
    if (element.matches(HARD_SKIP_SELECTOR) || element.closest(HARD_SKIP_SELECTOR)) return 'generic-hard-skip-selector';
    if (!isVisibleForTranslation(element, context)) return 'not-visible';
    if (element instanceof HTMLElement && element.isContentEditable) return 'contenteditable';

    const role = element.getAttribute('role')?.toLowerCase();
    if (role && HARD_SKIP_ROLES.has(role)) return `hard-skip-role:${role}`;
    if (role === 'button' && !isExpandableReadingContainer(element)) return 'hard-skip-role:button';

    const text = getCachedNormalizedText(context.grabOptions?.scanContext, element) || getTranslatableText(element).replace(/\s+/g, ' ').trim();
    if (text.length < 3) return 'too-short';
    if (text.length > 3072 || element.outerHTML.length > 4096) return 'too-long';

    return undefined;
}

function getCurrentSiteProfile() {
    const domain = getMainDomain(location.href);
    return siteProfiles.find(profile => profile.domains.includes(domain));
}

function inferDefaultRole(element: Element): TranslationTargetRole {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    if (tag === 'figcaption') return 'summary';
    if (['p', 'li', 'blockquote'].includes(tag)) return 'paragraph';
    if (element.hasAttribute('aria-expanded') || /\b(card|headline|title|summary|description)\b/i.test(getStructuralHint(element))) {
        return 'card';
    }
    return 'paragraph';
}

function mapContentUnitRole(kind?: string): TranslationTargetRole {
    if (kind === 'title' || kind === 'forum-topic') return 'title';
    if (kind === 'subtitle' || kind === 'forum-excerpt') return 'summary';
    if (kind === 'content-card') return 'card';
    if (kind === 'metadata') return 'metadata';
    if (kind === 'ui' || kind === 'noise') return 'ui';
    return 'paragraph';
}
