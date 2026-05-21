import { getMainDomain, selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat';
import { grabAllNode, type GrabAllNodeOptions } from '@/entrypoints/main/dom';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier';
import { findMainContent } from '@/entrypoints/utils/contentDetector';
import { decideTranslationTarget, isExpandableReadingContainer, isOpenExpandableReadingContainer, isVisibleForTranslation } from './decision';
import { collectDomTextUnits } from './unitizer';
import type { TranslationTargetCandidate, TranslationTargetContext, TranslationTargetDecision } from './types';

export interface AutoTranslationTargetResult {
    contentRoot: Element;
    nodes: Element[];
    decisions: TranslationTargetDecision[];
    grabOptions?: GrabAllNodeOptions;
}

export function resolveAutoTranslationTarget(scope: string): AutoTranslationTargetResult {
    if (scope === 'full') {
        const grabOptions: GrabAllNodeOptions = { siteCompatMode: 'full' };
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
            grabOptions
        };
    }

    const contentRoot = findMainContent();
    const grabOptions: GrabAllNodeOptions = {
        contentFilter: getContentFilterDecision,
        contentUnitClassifier: classifyContentUnit,
        siteCompatMode: 'smart'
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
            grabOptions
        };
    }

    const fallbackOptions: GrabAllNodeOptions = { siteCompatMode: 'full' };
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
            grabOptions: fallbackOptions
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
        grabOptions: fallbackOptions
    };
}

export function collectTranslationTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean } = {}
): TranslationTargetDecision[] {
    const candidates = collectTranslationCandidates(root, context, options);
    const decisions = candidates
        .map(candidate => decideTranslationTarget(candidate, context))
        .filter(decision => decision.policy === 'allow')
        .filter(decision => isVisibleForTranslation(decision.target));

    return mergeTranslationDecisions(decisions);
}

function collectTranslationCandidates(
    root: ParentNode,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean }
): TranslationTargetCandidate[] {
    const candidates: TranslationTargetCandidate[] = [];

    for (const node of grabAllNode(root, context.grabOptions)) {
        candidates.push({
            node,
            source: options.fallback ? 'fallback' : 'grab-node',
            reasons: [options.fallback ? 'grab-node-fallback' : 'grab-node']
        });
    }

    if (!options.fallback) {
        for (const node of collectSiteProfileSelectedTargets(root, context)) {
            candidates.push({
                node,
                source: 'site-profile',
                reasons: ['site-profile-select']
            });
        }
    }

    if (options.includeSupplemental) {
        for (const node of collectSupplementalReadingTargets(document.body, context)) {
            candidates.push({
                node,
                source: 'supplemental',
                reasons: ['supplemental-reading-target']
            });
        }
    }

    for (const node of collectDomUnitTargets(root)) {
        candidates.push({
            node,
            source: 'dom-unit',
            reasons: ['dom-unit-paragraph']
        });
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

function collectSupplementalReadingTargets(root: ParentNode, context: TranslationTargetContext): Element[] {
    const siteTargets = collectSiteSupplementalReadingTargets(root, context);
    const genericTargets = collectHighConfidenceReadingUnits(root)
        .filter(unit => !siteTargets.some(target => unit !== target && unit.contains(target)));

    return [
        ...genericTargets,
        ...siteTargets
    ]
        .flatMap(expandSupplementalReadingUnit)
        .filter(unit => isVisibleForTranslation(unit));
}

function collectSiteSupplementalReadingTargets(root: ParentNode, context: TranslationTargetContext): Element[] {
    const domain = getMainDomain(location.href);
    const collect = supplementalCompatFn[domain];
    return collect ? collect(root, { mode: context.mode }) : [];
}

function expandSupplementalReadingUnit(unit: Element): Element[] {
    const githubMarkdownListItems = getGitHubMarkdownListItems(unit);
    if (githubMarkdownListItems.length > 0) return githubMarkdownListItems;

    if (isExpandableReadingContainer(unit) && !isOpenExpandableReadingContainer(unit)) return [];
    if (looksLikeSupplementalWrapper(unit)) {
        const childUnits = collectHighConfidenceReadingUnits(unit).filter(child => child !== unit);
        if (childUnits.length > 0) return childUnits.flatMap(expandSupplementalReadingUnit);
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

function collectDomUnitTargets(root: ParentNode): Element[] {
    const githubMarkdownRoots = getMainDomain(location.href) === 'github.com'
        ? Array.from(document.querySelectorAll<Element>('.markdown-body'))
        : [];

    if (githubMarkdownRoots.length > 0) {
        return githubMarkdownRoots.flatMap(markdownRoot => collectDomTextUnits(markdownRoot));
    }

    return [];
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

function mergeTranslationDecisions(decisions: TranslationTargetDecision[]): TranslationTargetDecision[] {
    const unique = Array.from(new Map(decisions.map(decision => [decision.target, decision])).values());
    return unique.filter(decision => {
        if (unique.some(other => decision !== other && isGitHubMarkdownListContainer(decision.target) && isGitHubMarkdownListItemOf(other.target, decision.target))) {
            return false;
        }

        return !unique.some(other => {
            if (decision === other || !other.target.contains(decision.target)) return false;
            return !(isGitHubMarkdownListContainer(other.target) && isGitHubMarkdownListItemOf(decision.target, other.target));
        });
    });
}

function getGitHubMarkdownListItems(unit: Element, includeDescendantLists = true): Element[] {
    if (getMainDomain(location.href) !== 'github.com') return [];
    if (!unit.closest('.markdown-body')) return [];
    if (unit.closest('pre, code, table.highlight, table.diff-table')) return [];

    const lists = unit.matches('ul, ol')
        ? [unit]
        : includeDescendantLists
            ? Array.from(unit.querySelectorAll<Element>('ul, ol'))
            : [];

    return lists.flatMap(list => Array.from(list.children))
        .filter(child => child.tagName.toLowerCase() === 'li')
        .filter(item => (item.textContent?.replace(/\s+/g, ' ').trim().length ?? 0) >= 20);
}

function isGitHubMarkdownListContainer(element: Element): boolean {
    return getMainDomain(location.href) === 'github.com'
        && element.matches('ul, ol')
        && Boolean(element.closest('.markdown-body'));
}

function isGitHubMarkdownListItemOf(item: Element, list: Element): boolean {
    return item.tagName.toLowerCase() === 'li'
        && item.parentElement === list
        && Boolean(item.closest('.markdown-body'));
}

function chooseStrongerSource(
    left: TranslationTargetCandidate['source'],
    right: TranslationTargetCandidate['source']
): TranslationTargetCandidate['source'] {
    const order: TranslationTargetCandidate['source'][] = ['site-profile', 'supplemental', 'content-unit', 'dom-unit', 'grab-node', 'fallback'];
    return order.indexOf(right) < order.indexOf(left) ? right : left;
}
