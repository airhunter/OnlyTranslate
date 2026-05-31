import type { GrabAllNodeOptions } from '@/entrypoints/main/dom';
import { siteProfiles } from '@/entrypoints/main/siteProfiles';
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier';
import { getMainDomain } from '@/entrypoints/utils/domain';
import { collectTranslationTargets } from './collect';
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';
import { decideTranslationTarget, isOpenExpandableReadingContainer, isVisibleForTranslation } from './decision';
import {
    getCachedContentUnitDecision,
    invalidateScanCache,
    isLikelyReadingCandidate,
    isObviousUiSubtree,
    resetScanBudget
} from './scanContext';
import type { TranslationTargetContext } from './types';

const SUPPLEMENTAL_READING_CONFIDENCE = 0.72;

export function collectDynamicTranslationNodes(
    root: Element,
    contentRoot: Element,
    scope: string,
    grabOptions: GrabAllNodeOptions = {}
): Element[] {
    invalidateScanCache(grabOptions.scanContext, root);
    if (isManagedTranslationNode(root)) return [];
    if (isObviousUiSubtree(grabOptions.scanContext, root)) return [];

    const scanRoot = getDynamicTranslationScanRoot(root, contentRoot, scope, grabOptions);
    if (!scanRoot || !isInTranslationScope(scanRoot, contentRoot, scope, grabOptions)) return [];

    const dynamicGrabOptions: GrabAllNodeOptions = {
        ...grabOptions,
        scanBudget: 'dynamic'
    };
    const context: TranslationTargetContext = {
        mode: dynamicGrabOptions.siteCompatMode ?? (scope === 'full' ? 'full' : 'smart'),
        scope,
        contentRoot,
        grabOptions: dynamicGrabOptions
    };

    resetScanBudget(dynamicGrabOptions.scanContext, 'dynamic');

    if (isOpenExpandableReadingContainer(scanRoot) && isVisibleForTranslation(scanRoot, context) && !scanRoot.hasAttribute(TRANSLATED_ATTR)) {
        const decision = decideTranslationTarget({
            node: scanRoot,
            source: 'content-unit',
            reasons: ['open-expandable-reading-container']
        }, context);

        return decision.policy === 'allow' ? [decision.target] : [];
    }

    return collectTranslationTargets(scanRoot, context, { includeSupplemental: false })
        .map(decision => decision.target)
        .filter(node => !node.hasAttribute(TRANSLATED_ATTR) && !isManagedTranslationNode(node) && isVisibleForTranslation(node, context));
}

export function isManagedTranslationNode(node: Node): boolean {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`));
}

export function isInTranslationScope(
    root: Element,
    contentRoot: Element,
    scope: string,
    grabOptions: GrabAllNodeOptions = {}
): boolean {
    if (scope === 'full' || contentRoot.contains(root)) return true;

    const context: TranslationTargetContext = {
        mode: grabOptions.siteCompatMode ?? (scope === 'full' ? 'full' : 'smart'),
        scope,
        contentRoot,
        grabOptions
    };

    let current: Element | null = root;
    while (current && current !== document.body) {
        if (isOpenExpandableReadingContainer(current) && isVisibleForTranslation(current)) {
            return true;
        }

        if (isProfileTranslationScope(current, context)) {
            return true;
        }

        const decision = getCachedContentUnitDecision(grabOptions.scanContext, current, classifyContentUnit);
        if (decision.action === 'allow' && decision.confidence >= SUPPLEMENTAL_READING_CONFIDENCE) {
            return true;
        }
        current = current.parentElement;
    }

    return false;
}

function isProfileTranslationScope(element: Element, context: TranslationTargetContext): boolean {
    const profile = getCurrentSiteProfile();
    if (!profile) return false;

    const skip = profile.skipTarget?.(element, context);
    if (skip && skip.policy === 'hard-skip' && skip.role !== 'layout') return false;

    if (profile.allowTarget?.(element, context)) return true;

    const expanded = profile.expandTarget?.(element, context);
    return Array.isArray(expanded) && expanded.some(node => node === element || element.contains(node));
}

export function getDynamicTranslationScanRoot(
    root: Element,
    contentRoot: Element,
    scope: string,
    grabOptions: GrabAllNodeOptions = {}
): Element | null {
    if (isManagedTranslationNode(root)) return null;
    if (isObviousUiSubtree(grabOptions.scanContext, root)) return null;

    const context: TranslationTargetContext = {
        mode: grabOptions.siteCompatMode ?? (scope === 'full' ? 'full' : 'smart'),
        scope,
        contentRoot,
        grabOptions
    };
    const profileSkip = getCurrentSiteProfile()?.skipTarget?.(root, context);
    if (profileSkip && profileSkip.policy === 'hard-skip' && profileSkip.role !== 'layout') return null;

    if (scope !== 'full' && !contentRoot.contains(root)) {
        return isInTranslationScope(root, contentRoot, scope, grabOptions) ? root : null;
    }

    if (isLikelyReadingCandidate(root)) return root;

    const closest = root.closest('article, main, section, [role="article"], [role="main"], [class*="content"], [class*="article"], [class*="post"], [class*="story"]');
    if (closest && closest instanceof Element && contentRoot.contains(closest) && !isObviousUiSubtree(grabOptions.scanContext, closest)) {
        return closest;
    }

    return root;
}

function getCurrentSiteProfile() {
    const domain = getMainDomain(location.href);
    return siteProfiles.find(profile => profile.domains.includes(domain));
}
