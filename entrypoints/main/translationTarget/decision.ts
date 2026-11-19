import { withPageTranslateOverride } from '@/entrypoints/utils/pageTranslateOptOut';
import { getTranslatableText } from '@/entrypoints/main/dom';
import { siteProfiles } from '@/entrypoints/main/siteProfiles';
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier';
import { getMainDomain } from '@/entrypoints/utils/domain';
import {
    getStructuralHint,
    hasSentencePunctuation,
    isSemanticInlineTextBlock,
    PROSE_TEXT_MIN_SHORT
} from '@/entrypoints/utils/proseSignals';
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
import {
    getCachedContentUnitDecision,
    getCachedNormalizedText,
    getCachedVisibility,
    isElementVisible
} from './scanContext';
import type {
    TranslationTargetCandidate,
    TranslationTargetContext,
    TranslationTargetDecision,
    TranslationTargetOverride,
    TranslationTargetRole,
    TranslationTargetSkip
} from './types';
import { composedClosest, getComposedParentElement, isUnassignedLightDomSubtree } from './composedTree';
import { FULL_PAGE_PROTECTED_SELECTOR, hasFullPageText, isFullPageVisible } from './fullPage';
import { isProductReadingTarget } from './productReading';
import { getReadingBlockTargets, isCommentReadingRegion, isRecommendationBlock, isReadingBlockLeaf } from './readingBlocks';
import { getReadingPurposeDecision } from './readingEvidence';

const PROTECTED_TARGET_SELECTOR = [
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
    `.${BILINGUAL_CONTENT_CLASS}`
].join(', ');
const HARD_SKIP_SELECTOR = `${PROTECTED_TARGET_SELECTOR}, [${TRANSLATED_ATTR}="true"]`;

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
    context: TranslationTargetContext,
    options: { ignoreOwnTranslationMarker?: boolean } = {}
): TranslationTargetDecision {
    const node = candidate.node;
    const profile = getCurrentSiteProfile();

    const profileSkip = profile?.skipTarget?.(node, context);
    if (profileSkip && profileSkip.policy === 'hard-skip') {
        return skipDecision(node, profileSkip, candidate, context);
    }

    const hardSkipReason = getGenericHardSkipReason(node, context, options.ignoreOwnTranslationMarker);
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

    const profileAllow = profile?.allowTarget?.(node, context);
    if (profileAllow) {
        return allowDecision(node, profileAllow, candidate, context);
    }
    if (context.scope === 'full') {
        return {
            node, target: node, policy: 'allow', role: inferDefaultRole(node), source: candidate.source,
            reasons: [...(candidate.reasons ?? []), 'full-page-visible-text'],
        };
    }

    if (context.mode === 'smart' && candidate.source !== 'site-profile') {
        if (isRecommendationBlock(node)) {
            return skipDecision(node, { policy: 'hard-skip', role: 'ui', reason: 'linked-recommendation' }, candidate, context);
        }
        if (candidate.source !== 'reading-block' && isCommentReadingRegion(node) && isReadingBlockLeaf(node)
            && !getReadingBlockTargets(node, context.grabOptions?.scanContext, context.contentRoot, context.grabOptions?.scanBudget ?? 'supplemental').length) {
            return skipDecision(node, { policy: 'hard-skip', role: 'ui', reason: 'comment-without-reading-evidence' }, candidate, context);
        }
    }

    if (context.scope === 'smart' && context.mode === 'smart' && isProductReadingTarget(node, context.grabOptions?.scanContext?.allowedPageTranslateRoot)) {
        return allowDecision(node, { role: node.matches('h1') ? 'title' : 'paragraph', reason: 'semantic-product-reading-copy' }, candidate, context);
    }
    if (context.mode === 'smart') {
        const purpose = getReadingPurposeDecision(node, context.grabOptions?.scanContext,
            candidate.source === 'reading-block' && candidate.readingRole === 'title', context.grabOptions?.scanBudget ?? 'supplemental');
        const explicitProfileSelection = candidate.source === 'site-profile' && purpose.policy === 'skip-self'
            && purpose.allowsProfileOverride;
        if (purpose.policy !== 'keep' && !explicitProfileSelection) return skipDecision(node, { policy: 'hard-skip', role: 'ui', reason: purpose.reason! }, candidate, context);
        if (purpose.requiresReadingContext && candidate.source !== 'site-profile') {
            const scanContext = context.grabOptions?.scanContext;
            const origin = scanContext?.readingOrigins.get(node);
            const source = origin && origin.contains(node) ? origin : node;
            const unit = getCachedContentUnitDecision(scanContext, source, classifyContentUnit);
            const independentlyClassified = unit.action === 'allow' && unit.confidence >= 0.72
                && getReadingPurposeDecision(source, scanContext, false, context.grabOptions?.scanBudget ?? 'supplemental').policy === 'keep';
            if (!independentlyClassified && !getReadingBlockTargets(source, scanContext, context.contentRoot, context.grabOptions?.scanBudget ?? 'supplemental').includes(source)) {
                return skipDecision(node, { policy: 'hard-skip', role: 'metadata', reason: 'reading-context-required' }, candidate, context);
            }
        }
    }

    const contentUnitDecision = getCachedContentUnitDecision(context.grabOptions?.scanContext, node, classifyContentUnit);
    const contextualLabel = candidate.source === 'reading-block' && candidate.readingRole === 'title'
        && contentUnitDecision.requiresReadingContext;
    if (context.scope !== 'full' && contentUnitDecision.action === 'skip' && contentUnitDecision.confidence >= 0.85 && !contextualLabel) {
        return {
            node,
            target: node,
            policy: 'hard-skip',
            role: mapContentUnitRole(contentUnitDecision.kind),
            source: 'content-unit',
            reasons: [...(candidate.reasons ?? []), ...contentUnitDecision.reasons]
        };
    }
    if (candidate.source === 'reading-block') {
        return allowDecision(node, {
            role: candidate.readingRole,
            source: candidate.source,
            reason: 'reading-block-evidence'
        }, candidate, context);
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
    if (isUnassignedLightDomSubtree(element)) return false;
    if (context?.scope === 'full' && !isFullPageVisible(element)) return false;
    if (context?.scope === 'smart' && element.parentElement?.getAttribute('aria-hidden') === 'true') {
        const exception = getCurrentSiteProfile()?.ariaHiddenAncestor?.(element);
        // The exception is valid only for this direct parent. Do not cache the
        // result as ordinary visibility or apply it to the parent as a target.
        if (exception && exception === element.parentElement) return isElementVisible(element, exception);
    }
    return getCachedVisibility(context?.grabOptions?.scanContext, element, isElementVisible);
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

function getGenericHardSkipReason(element: Element, context: TranslationTargetContext, ignoreOwnTranslationMarker = false): string | undefined {
    const full = context.scope === 'full';
    const root = context.grabOptions?.scanContext?.allowedPageTranslateRoot;
    if (full && composedClosest(element, withPageTranslateOverride(FULL_PAGE_PROTECTED_SELECTOR, element, root))) return 'full-page-protected-content';
    if (ignoreOwnTranslationMarker) {
        // A pending attempt owns its marker, but cannot bypass any protection
        // on the element itself or any marker on an ancestor.
        const parent = getComposedParentElement(element);
        if (composedClosest(element, withPageTranslateOverride(PROTECTED_TARGET_SELECTOR, element, root))
            || (parent && composedClosest(parent, withPageTranslateOverride(HARD_SKIP_SELECTOR, parent, root)))) {
            return 'generic-hard-skip-selector';
        }
    } else if (composedClosest(element, withPageTranslateOverride(HARD_SKIP_SELECTOR, element, root))) return 'generic-hard-skip-selector';
    if (!isVisibleForTranslation(element, context)) return 'not-visible';
    if (element instanceof HTMLElement && element.isContentEditable) return 'contenteditable';
    if (!full && isFormOnlyContainer(element)) return 'form-only-container';

    let interactiveAncestor: Element | null = element;
    while (!full && interactiveAncestor) {
        const role = interactiveAncestor.getAttribute('role')?.toLowerCase();
        if (role && HARD_SKIP_ROLES.has(role)) return `hard-skip-role:${role}`;
        if ((interactiveAncestor.matches('button') || role === 'button')
            && !isExpandableReadingContainer(interactiveAncestor)) return 'hard-skip-role:button';
        interactiveAncestor = getComposedParentElement(interactiveAncestor);
    }

    const text = getCachedNormalizedText(context.grabOptions?.scanContext, element) || getTranslatableText(element).replace(/\s+/g, ' ').trim();
    if (full ? !hasFullPageText(text) : text.length < 3) return 'too-short';
    if (text.length > 3072 || (element.outerHTML.length > 4096
        && !isSemanticInlineTextBlock(element)
        && !getCurrentSiteProfile()?.allowOversizedMarkup?.(element))) {
        return 'too-long';
    }

    return undefined;
}

function isFormOnlyContainer(element: Element): boolean {
    if (!element.querySelector('form')) return false;

    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const textNode = walker.currentNode;
        if (!textNode.textContent?.trim()) continue;
        if (!textNode.parentElement?.closest('form')) return false;
    }

    return true;
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
