import { selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat';
import { siteProfiles } from '@/entrypoints/main/siteProfiles';
import { cleanupDirectTextTargets, grabAllNode, type GrabAllNodeOptions } from '@/entrypoints/main/dom';
import { getMainDomain } from '@/entrypoints/utils/domain';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier';
import { findMainContent } from '@/entrypoints/utils/contentDetector';
import { getStructuralHint } from '@/entrypoints/utils/proseSignals';
import { decideTranslationTarget, isExpandableReadingContainer, isOpenExpandableReadingContainer, isVisibleForTranslation } from './decision';
import {
    cloneScanStats,
    createScanContext,
    getCachedContentFilterDecision,
    getCachedNormalizedText,
    getCachedProseEvidence,
    hasEnoughProfileTargets,
    type TranslationTargetStats
} from './scanContext';
import type { TranslationTargetCandidate, TranslationTargetContext, TranslationTargetDecision } from './types';

const LEADING_READING_SIBLING_LABEL_PATTERN = /\b(abstract|summary|plain language|introduction|overview|background|key points?|highlights?|standfirst|lead)\b/i;
const LEADING_READING_SIBLING_NEGATIVE_PATTERN = /\b(references?|bibliography|rights?|permissions?|about this article|share|social|comments?|related|recommend|recommended|advert|advertisement|advertising|promo|sponsor|sponsored|subscribe|newsletter|author|byline|citation|metrics?|footer|nav|toolbar)\b/i;
const LEADING_READING_TARGET_SELECTOR = 'h1, h2, h3, h4, p, li, blockquote, figcaption';
const MAX_RECOVERED_LEADING_SIBLINGS = 4;
const MAX_RECOVERED_LEADING_TEXT = 5000;

export interface AutoTranslationTargetResult {
    contentRoot: Element;
    nodes: Element[];
    decisions: TranslationTargetDecision[];
    grabOptions?: GrabAllNodeOptions;
    stats?: TranslationTargetStats;
}

export function resolveAutoTranslationTarget(scope: string): AutoTranslationTargetResult {
    const scanContext = createScanContext();

    if (scope === 'full') {
        const grabOptions: GrabAllNodeOptions = { siteCompatMode: 'full', scanContext };
        const context: TranslationTargetContext = {
            mode: 'full',
            scope,
            contentRoot: document.body,
            grabOptions
        };
        const decisions = collectTranslationTargets(document.body, context, { includeSupplemental: false });
        return {
            contentRoot: document.body,
            nodes: decisions.map(decision => decision.target),
            decisions,
            grabOptions,
            stats: cloneScanStats(scanContext)
        };
    }

    const contentRoot = findMainContent(scanContext);
    const grabOptions: GrabAllNodeOptions = {
        contentFilter: getContentFilterDecision,
        contentUnitClassifier: classifyContentUnit,
        siteCompatMode: 'smart',
        scanContext
    };
    const context: TranslationTargetContext = {
        mode: 'smart',
        scope,
        contentRoot,
        grabOptions
    };

    const decisions = collectTranslationTargets(contentRoot, context, { includeSupplemental: true });
    if (decisions.length > 0) {
        return {
            contentRoot,
            nodes: decisions.map(decision => decision.target),
            decisions,
            grabOptions,
            stats: cloneScanStats(scanContext)
        };
    }

    const fallbackOptions: GrabAllNodeOptions = { siteCompatMode: 'full', scanContext };
    const fallbackContext: TranslationTargetContext = {
        mode: 'full',
        scope,
        contentRoot,
        grabOptions: fallbackOptions
    };
    const fallbackDecisions = collectTranslationTargets(contentRoot, fallbackContext, {
        includeSupplemental: false,
        fallback: true
    });
    if (fallbackDecisions.length > 0) {
        return {
            contentRoot,
            nodes: fallbackDecisions.map(decision => decision.target),
            decisions: fallbackDecisions,
            grabOptions: fallbackOptions,
            stats: cloneScanStats(scanContext)
        };
    }

    const bodyContext: TranslationTargetContext = {
        mode: 'full',
        scope,
        contentRoot: document.body,
        grabOptions: fallbackOptions
    };
    const bodyDecisions = collectTranslationTargets(document.body, bodyContext, {
        includeSupplemental: false,
        fallback: true
    });

    return {
        contentRoot: document.body,
        nodes: bodyDecisions.map(decision => decision.target),
        decisions: bodyDecisions,
        grabOptions: fallbackOptions,
        stats: cloneScanStats(scanContext)
    };
}

export function collectTranslationTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean } = {}
): TranslationTargetDecision[] {
    const directTextRunWrappers = new Set<Element>();
    const trackedContext = withDirectTextRunWrapperCollector(context, directTextRunWrappers);
    let mergedDecisions: TranslationTargetDecision[] = [];

    try {
        const candidates = collectTranslationCandidates(root, trackedContext, options);
        const decisions = candidates
            .map(candidate => decideTranslationTarget(candidate, trackedContext))
            .filter(decision => decision.policy === 'allow')
            .filter(decision => isVisibleForTranslation(decision.target, trackedContext));

        mergedDecisions = mergeTranslationDecisions(decisions, trackedContext);
        return mergedDecisions;
    } finally {
        cleanupDirectTextTargets(
            directTextRunWrappers,
            mergedDecisions.flatMap(decision => [decision.node, decision.target])
        );
    }
}

function withDirectTextRunWrapperCollector(
    context: TranslationTargetContext,
    directTextRunWrapperCollector: Set<Element>
): TranslationTargetContext {
    return {
        ...context,
        grabOptions: {
            ...context.grabOptions,
            directTextRunWrapperCollector
        }
    };
}

function collectTranslationCandidates(
    root: ParentNode,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean }
): TranslationTargetCandidate[] {
    const candidates: TranslationTargetCandidate[] = [];
    const siteProfileSelectedTargets = options.fallback
        ? []
        : collectSiteProfileSelectedTargets(root, context);

    for (const node of grabAllNode(root, context.grabOptions)) {
        candidates.push({
            node,
            source: options.fallback ? 'fallback' : 'grab-node',
            reasons: [options.fallback ? 'grab-node-fallback' : 'grab-node']
        });
    }

    for (const node of siteProfileSelectedTargets) {
        candidates.push({
            node,
            source: 'site-profile',
            reasons: ['site-profile-select']
        });
    }

    if (options.includeSupplemental) {
        for (const node of collectSupplementalReadingTargets(document.body, context, siteProfileSelectedTargets)) {
            candidates.push({
                node,
                source: 'supplemental',
                reasons: ['supplemental-reading-target']
            });
        }
    }

    for (const candidate of collectProfileExpandedTargets(root, candidates, context)) {
        candidates.push(candidate);
    }

    return dedupeCandidates(candidates);
}

function collectSiteProfileSelectedTargets(root: ParentNode, context: TranslationTargetContext): Element[] {
    const domain = getMainDomain(location.href);
    const select = selectCompatFn[domain];
    if (!select) return [];

    const elements = root instanceof Element
        ? [root, ...Array.from(root.querySelectorAll<Element>('*'))]
        : Array.from(root.querySelectorAll<Element>('*'));
    const result: Element[] = [];

    for (const element of elements) {
        const selected = select(element, { mode: context.mode });
        if (selected instanceof Element) result.push(selected);
    }

    return Array.from(new Set(result));
}

function collectSupplementalReadingTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    profileSelectedTargets: Element[]
): Element[] {
    const siteTargets = collectSiteSupplementalReadingTargets(root, context);
    const profileTargets = Array.from(new Set([...profileSelectedTargets, ...siteTargets]));
    const genericTargets = shouldUseProfileFastPath(profileTargets, context)
        ? []
        : collectGenericSupplementalReadingTargets(root, context, siteTargets);
    const preservedSiteTargets = getCurrentSiteProfile()?.preserveSupplementalTargets
        ? new Set(siteTargets)
        : undefined;

    return [
        ...genericTargets,
        ...siteTargets
    ]
        .flatMap(unit => preservedSiteTargets?.has(unit)
            ? [unit]
            : expandSupplementalReadingUnit(unit, context))
        .filter(unit => isVisibleForTranslation(unit, context));
}

function collectGenericSupplementalReadingTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    siteTargets: Element[]
): Element[] {
    return [
        ...collectContentRootSiblingReadingTargets(context),
        ...collectHighConfidenceReadingUnits(root, {
            scanContext: context.grabOptions?.scanContext,
            scanBudget: 'supplemental',
            candidateOnly: true,
            pruneUiSubtrees: true
        })
    ]
        .filter(unit => getCachedContentFilterDecision(context.grabOptions?.scanContext, unit, getContentFilterDecision) !== 'skip-self')
        .filter(unit => !siteTargets.some(target => unit !== target && unit.contains(target)));
}

function collectContentRootSiblingReadingTargets(context: TranslationTargetContext): Element[] {
    if (context.mode !== 'smart') return [];
    if (context.contentRoot === document.body) return [];

    const units = collectLeadingReadingSiblingUnits(context);
    const targets = units.flatMap(unit => collectLeadingReadingSiblingTargets(unit, context));

    return Array.from(new Set(targets));
}

function collectLeadingReadingSiblingUnits(context: TranslationTargetContext): Element[] {
    const scanContext = context.grabOptions?.scanContext;
    const contentRootTextLength = getCachedNormalizedText(scanContext, context.contentRoot).length;
    const maxRecoveredTextLength = Math.min(
        MAX_RECOVERED_LEADING_TEXT,
        Math.max(2000, contentRootTextLength * 0.8)
    );
    const units: Element[] = [];
    let recoveredTextLength = 0;

    for (const anchor of getContentRootSiblingAnchors(context.contentRoot)) {
        for (const sibling of getPreviousElementSiblings(anchor)) {
            if (units.length >= MAX_RECOVERED_LEADING_SIBLINGS) return units;
            if (units.some(unit => unit === sibling || unit.contains(sibling) || sibling.contains(unit))) continue;
            if (!isRecoverableLeadingReadingSibling(sibling, context)) continue;

            const textLength = getCachedNormalizedText(scanContext, sibling).length;
            if (units.length > 0 && recoveredTextLength + textLength > maxRecoveredTextLength) continue;

            units.push(sibling);
            recoveredTextLength += textLength;
        }
    }

    return units;
}

function getContentRootSiblingAnchors(contentRoot: Element): Element[] {
    const anchors: Element[] = [];
    let current: Element | null = contentRoot;
    let depth = 0;

    while (current && current !== document.body && depth < 3) {
        anchors.push(current);
        current = current.parentElement;
        depth += 1;
    }

    return anchors;
}

function getPreviousElementSiblings(anchor: Element): Element[] {
    const siblings: Element[] = [];
    let current = anchor.previousElementSibling;

    while (current) {
        siblings.push(current);
        current = current.previousElementSibling;
    }

    return siblings.reverse();
}

function isRecoverableLeadingReadingSibling(unit: Element, context: TranslationTargetContext): boolean {
    const tag = unit.tagName.toLowerCase();
    if (['nav', 'aside', 'footer', 'form', 'dialog'].includes(tag)) return false;
    if (unit.contains(context.contentRoot) || context.contentRoot.contains(unit)) return false;

    const scanContext = context.grabOptions?.scanContext;
    const decision = getCachedContentFilterDecision(scanContext, unit, getContentFilterDecision);
    if (decision !== 'keep') return false;

    const signalText = getLeadingReadingSiblingSignalText(unit);
    if (LEADING_READING_SIBLING_NEGATIVE_PATTERN.test(signalText)) return false;
    if (!LEADING_READING_SIBLING_LABEL_PATTERN.test(signalText)) return false;

    const evidence = getCachedProseEvidence(scanContext, unit);
    if (evidence.textLength < 80) return false;
    if (evidence.linkDensity > 0.35 || evidence.interactiveDensity > 0.35) return false;
    if (evidence.strength === 'none' && !evidence.hasParagraphDescendant) return false;

    return collectLeadingReadingSiblingTargets(unit, context).length > 0;
}

function getLeadingReadingSiblingSignalText(unit: Element): string {
    const headingText = Array.from(unit.querySelectorAll('h1, h2, h3'))
        .slice(0, 3)
        .map(heading => heading.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .join(' ');

    return [
        getStructuralHint(unit),
        unit.getAttribute('data-title') ?? '',
        unit.getAttribute('aria-label') ?? '',
        headingText
    ].join(' ');
}

function collectLeadingReadingSiblingTargets(unit: Element, context: TranslationTargetContext): Element[] {
    return getLeadingReadingTargetCandidates(unit)
        .filter(target => isRecoverableLeadingReadingTarget(target, unit, context));
}

function getLeadingReadingTargetCandidates(unit: Element): Element[] {
    const targets = Array.from(unit.querySelectorAll<Element>(LEADING_READING_TARGET_SELECTOR));
    if (unit.matches(LEADING_READING_TARGET_SELECTOR)) targets.unshift(unit);
    return targets;
}

function isRecoverableLeadingReadingTarget(target: Element, unit: Element, context: TranslationTargetContext): boolean {
    if (target !== unit && target.closest('nav, aside, footer, form, dialog, [aria-hidden="true"], .notranslate, [translate="no"]')) return false;

    const scanContext = context.grabOptions?.scanContext;
    const decision = getCachedContentFilterDecision(scanContext, target, getContentFilterDecision);
    if (decision === 'skip-subtree') return false;

    const text = getCachedNormalizedText(scanContext, target);
    if (text.length < 3) return false;
    if (LEADING_READING_SIBLING_NEGATIVE_PATTERN.test(`${getStructuralHint(target)} ${text}`)) return false;

    const tag = target.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) return text.length <= 240;

    const evidence = getCachedProseEvidence(scanContext, target);
    return evidence.strength !== 'none'
        && evidence.linkDensity <= 0.35
        && evidence.interactiveDensity <= 0.35;
}

function shouldUseProfileFastPath(profileTargets: Element[], context: TranslationTargetContext): boolean {
    const profile = getCurrentSiteProfile();
    if (context.mode !== 'smart' || profile?.targetStrategy !== 'profile-first') return false;
    if (!hasEnoughProfileTargets(profileTargets, context.grabOptions?.scanContext)) return false;

    const scanContext = context.grabOptions?.scanContext;
    if (scanContext) scanContext.stats.profileFastPathUsed = true;
    return true;
}

function collectSiteSupplementalReadingTargets(root: ParentNode, context: TranslationTargetContext): Element[] {
    const domain = getMainDomain(location.href);
    const collect = supplementalCompatFn[domain];
    return collect ? collect(root, { mode: context.mode }) : [];
}

function getCurrentSiteProfile() {
    const domain = getMainDomain(location.href);
    return siteProfiles.find(profile => profile.domains.includes(domain));
}

function expandSupplementalReadingUnit(unit: Element, context: TranslationTargetContext): Element[] {
    if (isExpandableReadingContainer(unit) && !isOpenExpandableReadingContainer(unit)) return [];
    if (looksLikeSupplementalWrapper(unit) || looksLikeMultiBlockReadingWrapper(unit, context)) {
        const directTextChildren = getDirectReadableTextChildren(unit, context);
        if (directTextChildren.length >= 2) return directTextChildren.flatMap(child => expandSupplementalReadingUnit(child, context));

        const childUnits = collectHighConfidenceReadingUnits(unit, {
            scanContext: context.grabOptions?.scanContext,
            candidateOnly: true,
            pruneUiSubtrees: true,
            includeRoot: false
        }).filter(child => child !== unit);
        if (childUnits.length > 0) return childUnits.flatMap(child => expandSupplementalReadingUnit(child, context));
    }

    return [unit];
}

function looksLikeSupplementalWrapper(unit: Element): boolean {
    const tag = unit.tagName.toLowerCase();
    if (tag === 'aside') return true;
    if (['main', 'article', 'section', 'div'].includes(tag) && !unit.id) {
        return unit.querySelector('[class*="card"], [class*="stage"], [class*="pipeline"], [role="button"][aria-expanded]') !== null;
    }

    return false;
}

function looksLikeMultiBlockReadingWrapper(unit: Element, context?: TranslationTargetContext): boolean {
    const tag = unit.tagName.toLowerCase();
    if (!['main', 'article', 'section', 'div'].includes(tag)) return false;
    if (isExpandableReadingContainer(unit)) return false;

    const readableDescendants = unit.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, figcaption');
    if (readableDescendants.length < 2) return false;
    if (getDirectReadableTextChildren(unit, context).length >= 2) return true;

    return Array.from(unit.children).some(child => {
        const childTag = child.tagName.toLowerCase();
        return ['article', 'section', 'div'].includes(childTag)
            && child.querySelector('h1, h2, h3, h4, p, li, blockquote, figcaption') !== null;
    });
}

function getDirectReadableTextChildren(unit: Element, context?: TranslationTargetContext): Element[] {
    return Array.from(unit.children).filter(child => {
        const tag = child.tagName.toLowerCase();
        if (!['p', 'blockquote', 'figcaption'].includes(tag)) return false;

        return getCachedProseEvidence(context?.grabOptions?.scanContext, child).strength !== 'none';
    });
}

function collectProfileExpandedTargets(
    root: ParentNode,
    candidates: TranslationTargetCandidate[],
    context: TranslationTargetContext
): TranslationTargetCandidate[] {
    const profile = getCurrentSiteProfile();
    if (!profile?.expandTarget) return [];

    const expansionSources = new Set<Element>();
    if (root instanceof Element) expansionSources.add(root);
    for (const candidate of candidates) expansionSources.add(candidate.node);

    const expanded: TranslationTargetCandidate[] = [];
    for (const source of expansionSources) {
        const nodes = profile.expandTarget(source, context);
        if (!nodes) continue;

        for (const node of nodes) {
            expanded.push({
                node,
                source: 'dom-unit',
                reasons: ['site-profile-expand-target']
            });
        }
    }

    return expanded;
}

function dedupeCandidates(candidates: TranslationTargetCandidate[]): TranslationTargetCandidate[] {
    const map = new Map<Element, TranslationTargetCandidate>();

    for (const candidate of candidates) {
        const existing = map.get(candidate.node);
        if (!existing) {
            map.set(candidate.node, candidate);
            continue;
        }

        map.set(candidate.node, {
            node: candidate.node,
            source: chooseStrongerSource(existing.source, candidate.source),
            reasons: [...(existing.reasons ?? []), ...(candidate.reasons ?? [])]
        });
    }

    return Array.from(map.values());
}

function mergeTranslationDecisions(
    decisions: TranslationTargetDecision[],
    context: TranslationTargetContext
): TranslationTargetDecision[] {
    const unique = Array.from(new Map(decisions.map(decision => [decision.target, decision])).values());
    return unique.filter(decision => {
        if (unique.some(other =>
            decision !== other
            && decision.target.contains(other.target)
            && shouldKeepNestedTarget(decision.target, other.target, context)
        )) {
            return false;
        }

        return !unique.some(other => {
            if (decision === other || !other.target.contains(decision.target)) return false;
            return !shouldKeepNestedTarget(other.target, decision.target, context);
        });
    });
}

function shouldKeepNestedTarget(parent: Element, child: Element, context: TranslationTargetContext): boolean {
    return getCurrentSiteProfile()?.shouldKeepNestedTarget?.(parent, child, context) ?? false;
}

function chooseStrongerSource(
    left: TranslationTargetCandidate['source'],
    right: TranslationTargetCandidate['source']
): TranslationTargetCandidate['source'] {
    const order: TranslationTargetCandidate['source'][] = ['site-profile', 'supplemental', 'content-unit', 'dom-unit', 'grab-node', 'fallback'];
    return order.indexOf(right) < order.indexOf(left) ? right : left;
}
