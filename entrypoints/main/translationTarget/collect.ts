import { selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat';
import { siteProfiles } from '@/entrypoints/main/siteProfiles';
import { cleanupDirectTextTargets, collectPreservedNewlineTextTargets, grabAllNode, hasExcludedTranslatableTextBoundary, type GrabAllNodeOptions } from '@/entrypoints/main/dom';
import { getMainDomain } from '@/entrypoints/utils/domain';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier';
import { findMainContent } from '@/entrypoints/utils/contentDetector';
import { getStructuralHint } from '@/entrypoints/utils/proseSignals';
import { decideTranslationTarget, isExpandableReadingContainer, isOpenExpandableReadingContainer, isVisibleForTranslation } from './decision';
import {
    cloneScanStats,
    createScanContext,
    discoverScanShadowRoots,
    getCachedContentFilterDecision,
    getCachedContentUnitDecision,
    getCachedNormalizedText,
    getCachedProseEvidence,
    hasEnoughProfileTargets,
    type TranslationTargetStats
} from './scanContext';
import type { TranslationTargetCandidate, TranslationTargetContext, TranslationTargetDecision } from './types';
import {
    composedContains,
    discoverOpenShadowRootsAsync,
    getComposedParentElement,
    isInactiveSlotFallback
} from './composedTree';
import { TRANSLATED_ATTR } from './constants';
import { collectFullPageTargets } from './fullPage';
import { collectProductReadingTargets } from './productReading';
import { getReadingBlockRegion, getReadingBlockTargets, isReadingBlockLeaf } from './readingBlocks';

const READING_HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

function isStandaloneReadingHeading(node: Element): boolean {
    return node.matches(READING_HEADING_SELECTOR) && !node.querySelector('p, li, div, section, article, blockquote, table, ul, ol');
}

export interface AutoTranslationTargetResult {
    contentRoot: Element;
    nodes: Element[];
    decisions: TranslationTargetDecision[];
    grabOptions?: GrabAllNodeOptions;
    stats?: TranslationTargetStats;
}

export interface TranslationTargetResolveOptions {
    includeOpenShadowRoots?: boolean;
    allowedPageTranslateRoot?: Element;
}

export function resolveAutoTranslationTarget(
    scope: string,
    options: TranslationTargetResolveOptions = {}
): AutoTranslationTargetResult {
    const scanContext = createScanContext(options);
    if (options.includeOpenShadowRoots !== false) {
        discoverScanShadowRoots(scanContext, document.body);
    }
    return resolveAutoTranslationTargetWithContext(scope, scanContext);
}

function resolveAutoTranslationTargetWithContext(
    scope: string,
    scanContext: ReturnType<typeof createScanContext>
): AutoTranslationTargetResult {

    if (scope === 'full') {
        const grabOptions: GrabAllNodeOptions = { siteCompatMode: 'full', scanContext };
        const context: TranslationTargetContext = {
            mode: 'full',
            scope,
            contentRoot: document.body,
            grabOptions
        };
        const decisions = collectTargetsAcrossRegisteredRoots(document.body, context, { includeSupplemental: false });
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

    const decisions = collectTargetsAcrossRegisteredRoots(contentRoot, context, { includeSupplemental: true });
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
    const fallbackDecisions = collectTargetsAcrossRegisteredRoots(contentRoot, fallbackContext, {
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
    const bodyDecisions = collectTargetsAcrossRegisteredRoots(document.body, bodyContext, {
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

async function resolveAutoTranslationTargetWithContextAsync(
    scope: string,
    scanContext: ReturnType<typeof createScanContext>,
    signal?: AbortSignal
): Promise<AutoTranslationTargetResult> {
    if (scope === 'full') {
        const grabOptions: GrabAllNodeOptions = { siteCompatMode: 'full', scanContext };
        const context: TranslationTargetContext = {
            mode: 'full', scope, contentRoot: document.body, grabOptions
        };
        const decisions = await collectTargetsAcrossRegisteredRootsAsync(
            document.body, context, { includeSupplemental: false }, signal
        );
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
        mode: 'smart', scope, contentRoot, grabOptions
    };
    const decisions = await collectTargetsAcrossRegisteredRootsAsync(
        contentRoot, context, { includeSupplemental: true }, signal
    );
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
        mode: 'full', scope, contentRoot, grabOptions: fallbackOptions
    };
    const fallbackDecisions = await collectTargetsAcrossRegisteredRootsAsync(
        contentRoot,
        fallbackContext,
        { includeSupplemental: false, fallback: true },
        signal
    );
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
        mode: 'full', scope, contentRoot: document.body, grabOptions: fallbackOptions
    };
    const bodyDecisions = await collectTargetsAcrossRegisteredRootsAsync(
        document.body,
        bodyContext,
        { includeSupplemental: false, fallback: true },
        signal
    );
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
    const observedOutsideBlocks = options.includeSupplemental ? new Set<Element>() : undefined;
    let mergedDecisions: TranslationTargetDecision[] = [];

    try {
        const candidates = collectTranslationCandidates(root, trackedContext, options, observedOutsideBlocks);
        const decisions = candidates
            .map(candidate => decideTranslationTarget(candidate, trackedContext))
            .filter(decision => decision.policy === 'allow')
            .filter(decision => isVisibleForTranslation(decision.target, trackedContext));

        mergedDecisions = mergeTranslationDecisions(decisions, trackedContext);
        const stats = context.grabOptions?.scanContext?.stats;
        if (stats && observedOutsideBlocks) {
            const targets = new Set(mergedDecisions.map(decision => decision.target));
            for (const block of observedOutsideBlocks) {
                let ancestor: Element | null = block;
                while (ancestor && !targets.has(ancestor)) ancestor = getComposedParentElement(ancestor);
                if (!ancestor || hasExcludedTranslatableTextBoundary(ancestor, block)) stats.unselectedStrongOutsideBlocks++;
            }
        }
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
    options: { includeSupplemental?: boolean; fallback?: boolean },
    observedOutsideBlocks?: Set<Element>
): TranslationTargetCandidate[] {
    const profileFastPathCandidates = collectProfileFastPathCandidates(root, context, options);
    if (profileFastPathCandidates) return profileFastPathCandidates;

    const candidates: TranslationTargetCandidate[] = [];
    const siteProfileSelectedTargets = options.fallback
        ? []
        : collectSiteProfileSelectedTargets(root, context);

    const ordinaryTargets = context.scope === 'full'
        ? collectFullPageTargets(root, context.grabOptions ?? {})
        : grabAllNode(root, context.grabOptions);
    for (const node of ordinaryTargets) {
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

    for (const node of collectProductReadingTargets(options.includeSupplemental ? document.body : root, context)) {
        candidates.push({ node, source: 'supplemental', reasons: ['semantic-product-reading-copy'] });
    }

    if (options.includeSupplemental) {
        const readingBlocks = new Map<Element, 'paragraph' | 'title'>();
        const getCoveredTargets = () => {
            const primaryDecisions = candidates
                .map(candidate => decideTranslationTarget(candidate, context))
                .filter(decision => decision.policy === 'allow');
            return new Set(mergeTranslationDecisions(primaryDecisions, context)
                .map(decision => decision.target));
        };
        for (const node of collectSupplementalReadingTargets(document.body, context, siteProfileSelectedTargets, readingBlocks, observedOutsideBlocks, getCoveredTargets)) {
            const readingRole = readingBlocks.get(node);
            candidates.push(readingRole
                ? { node, source: 'reading-block', readingRole }
                : { node, source: 'supplemental', reasons: ['supplemental-reading-target'] });
        }
    }

    for (const candidate of collectProfileExpandedTargets(root, candidates, context)) {
        candidates.push(candidate);
    }

    return dedupeCandidates(candidates);
}

function collectProfileFastPathCandidates(
    root: ParentNode,
    context: TranslationTargetContext,
    options: { fallback?: boolean }
): TranslationTargetCandidate[] | null {
    if (options.fallback || context.mode !== 'smart') return null;

    const profile = getCurrentSiteProfile();
    if (!profile?.collectFastPathTargets) return null;

    const targets = Array.from(new Set(profile.collectFastPathTargets(root, { mode: context.mode }) || []));
    if (!hasEnoughProfileTargets(targets, context.grabOptions?.scanContext)) return null;

    const scanContext = context.grabOptions?.scanContext;
    if (scanContext) scanContext.stats.profileFastPathUsed = true;

    return targets.map(node => ({
        node,
        source: 'site-profile',
        reasons: ['site-profile-fast-path']
    }));
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
        const selected = select(element, { mode: context.mode, scope: context.scope });
        if (selected instanceof Element) result.push(selected);
    }

    return Array.from(new Set(result));
}

function collectSupplementalReadingTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    profileSelectedTargets: Element[],
    readingBlocks: Map<Element, 'paragraph' | 'title'>,
    observedOutsideBlocks?: Set<Element>,
    getCoveredTargets?: () => ReadonlySet<Element>
): Element[] {
    const siteTargets = collectSiteSupplementalReadingTargets(root, context);
    const profileTargets = Array.from(new Set([...profileSelectedTargets, ...siteTargets]));
    const genericTargets = shouldUseProfileFastPath(profileTargets, context)
        ? []
        : collectGenericSupplementalReadingTargets(root, context, siteTargets, readingBlocks, observedOutsideBlocks, getCoveredTargets?.());
    const genericReadingTargets = genericTargets.filter(node => !readingBlocks.has(node) || !profileTargets.includes(node));
    for (const node of profileTargets) readingBlocks.delete(node);
    const preservedSiteTargets = getCurrentSiteProfile()?.preserveSupplementalTargets
        ? new Set(siteTargets)
        : undefined;

    return [
        ...genericReadingTargets,
        ...siteTargets
    ]
        .flatMap(unit => preservedSiteTargets?.has(unit) || readingBlocks.has(unit)
            ? [unit]
            : expandSupplementalReadingUnit(unit, context))
        .filter(unit => isVisibleForTranslation(unit, context));
}

function collectGenericSupplementalReadingTargets(
    root: ParentNode,
    context: TranslationTargetContext,
    siteTargets: Element[],
    readingBlocks: Map<Element, 'paragraph' | 'title'>,
    observedOutsideBlocks?: Set<Element>,
    coveredTargets?: ReadonlySet<Element>
): Element[] {
    const readingUnits = collectSmartReadingUnits(root, context, readingBlocks, observedOutsideBlocks, false, coveredTargets);
    return readingUnits
        .filter(unit => !siteTargets.some(target => unit !== target && unit.contains(target)));
}

function collectSmartReadingUnits(
    root: ParentNode,
    context: TranslationTargetContext,
    readingBlocks: Map<Element, 'paragraph' | 'title'>,
    observedOutsideBlocks?: Set<Element>,
    blocksOnly = false,
    coveredTargets?: ReadonlySet<Element>
): Element[] {
    const scanContext = context.grabOptions?.scanContext;
    // Reuse the existing budgeted walk. Explicit reading leaves can still be evaluated
    // when the legacy classifier has tentatively selected an enclosing container.
    const units = collectHighConfidenceReadingUnits(root, {
        scanContext,
        scanBudget: blocksOnly ? 'dynamic' : 'supplemental',
        candidateOnly: true,
        pruneUiSubtrees: true,
        coveredTargets,
        isExtraCandidate: node => isStandaloneReadingHeading(node)
            || (Boolean(getReadingBlockRegion(node, context.grabOptions?.scanContext)) && isReadingBlockLeaf(node)),
        selectReadingBlock: node => {
            if (isStandaloneReadingHeading(node)) {
                const unit = getCachedContentUnitDecision(scanContext, node, classifyContentUnit);
                if (unit.action === 'allow' && unit.confidence >= 0.72
                    && (unit.kind === 'title' || unit.kind === 'subtitle' || unit.kind === 'forum-topic')) {
                    readingBlocks.set(node, 'title');
                    return [node];
                }
            }
            if (observedOutsideBlocks && isReadingBlockLeaf(node)
                && !composedContains(context.contentRoot, node)
                && getCachedProseEvidence(scanContext, node).strength === 'strong'
                && isVisibleForTranslation(node, context)) {
                observedOutsideBlocks.add(node);
            }
            const [body, title] = getReadingBlockTargets(node, scanContext, context.contentRoot, blocksOnly ? 'dynamic' : 'supplemental');
            if (!body || !isVisibleForTranslation(body, context)) return undefined;
            // A label only belongs to the reading selection when its body passes final purpose checks.
            if (decideTranslationTarget({ node: body, source: 'reading-block', readingRole: 'paragraph' }, context).policy !== 'allow') {
                return undefined;
            }
            readingBlocks.set(body, 'paragraph');
            if (title && !readingBlocks.has(title)) readingBlocks.set(title, 'title');
            return title ? [title, body] : [body];
        }
    });
    // Finish the live candidate walk before reversible source wrappers can mutate DOM.
    return units.flatMap(unit => {
        const role = readingBlocks.get(unit);
        if (!role || !unit.querySelector('br, pre, input, textarea, select, [role="complementary"], [hidden], [aria-hidden="true"], .notranslate, [translate="no"]')) return [unit];
        readingBlocks.delete(unit);
        const targets = grabAllNode(unit, context.grabOptions);
        for (const target of targets) {
            readingBlocks.set(target, role);
            if (target !== unit) scanContext?.readingOrigins.set(target, unit);
        }
        return targets;
    });
}

export function collectDynamicReadingBlocks(root: Element, context: TranslationTargetContext): Element[] {
    const wrappers = new Set<Element>();
    const trackedContext = withDirectTextRunWrapperCollector(context, wrappers);
    const readingBlocks = new Map<Element, 'paragraph' | 'title'>();
    let decisions: TranslationTargetDecision[] = [];
    try {
        const selected = collectSmartReadingUnits(root, trackedContext, readingBlocks, undefined, true)
            .flatMap(node => {
                if (readingBlocks.has(node)) return [node];
                const targets = expandSupplementalReadingUnit(node, trackedContext);
                for (const target of targets) if (target !== node) trackedContext.grabOptions?.scanContext?.readingOrigins.set(target, node);
                return targets;
            })
            .map(node => {
                const role = readingBlocks.get(node);
                return decideTranslationTarget(role
                    ? { node, source: 'reading-block', readingRole: role }
                    : { node, source: 'content-unit' }, trackedContext);
            })
            .filter(decision => decision.policy === 'allow');
        decisions = mergeTranslationDecisions(selected, trackedContext);
        return decisions.map(decision => decision.target);
    } finally {
        cleanupDirectTextTargets(wrappers, decisions.flatMap(decision => [decision.node, decision.target]));
    }
}

export interface AsyncTranslationTargetOptions extends TranslationTargetResolveOptions {
    signal?: AbortSignal;
    beforeCollect?: (openShadowRoots: ReadonlySet<ShadowRoot>) => void;
}

export async function resolveAutoTranslationTargetAsync(
    scope: string,
    options: AsyncTranslationTargetOptions = {}
): Promise<AutoTranslationTargetResult> {
    const scanContext = createScanContext(options);
    if (options.includeOpenShadowRoots !== false) {
        await discoverOpenShadowRootsAsync(document.body, scanContext.openShadowRoots, options.signal);
        scanContext.stats.openShadowRoots = scanContext.openShadowRoots.size;
    }
    if (options.signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
    options.beforeCollect?.(scanContext.openShadowRoots);
    if (options.signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
    return resolveAutoTranslationTargetWithContextAsync(scope, scanContext, options.signal);
}

export function collectTargetsAcrossRegisteredRoots(
    root: Element,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean }
): TranslationTargetDecision[] {
    const ordinary = collectTranslationTargets(root, context, options);
    const shadowRoots = context.grabOptions?.scanContext?.openShadowRoots ?? new Set<ShadowRoot>();
    const shadow: TranslationTargetDecision[] = [];
    const boundaryCache = new WeakMap<Element, boolean>();

    for (const shadowRoot of shadowRoots) {
        shadow.push(...collectSingleShadowRootTargets(root, shadowRoot, context, options, boundaryCache));
    }

    return mergeTranslationDecisions([...ordinary, ...shadow], context);
}

async function collectTargetsAcrossRegisteredRootsAsync(
    root: Element,
    context: TranslationTargetContext,
    options: { includeSupplemental?: boolean; fallback?: boolean },
    signal?: AbortSignal
): Promise<TranslationTargetDecision[]> {
    const ordinary = collectTranslationTargets(root, context, options);
    const shadowRoots = context.grabOptions?.scanContext?.openShadowRoots ?? new Set<ShadowRoot>();
    const shadow: TranslationTargetDecision[] = [];
    const boundaryCache = new WeakMap<Element, boolean>();
    let sliceStarted = performance.now();

    for (const shadowRoot of shadowRoots) {
        if (signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
        shadow.push(...collectSingleShadowRootTargets(root, shadowRoot, context, options, boundaryCache));
        if (performance.now() - sliceStarted >= 4) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            sliceStarted = performance.now();
        }
    }

    if (signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
    return mergeTranslationDecisions([...ordinary, ...shadow], context);
}

function collectSingleShadowRootTargets(
    scanRoot: Element,
    shadowRoot: ShadowRoot,
    context: TranslationTargetContext,
    options: { fallback?: boolean },
    boundaryCache: WeakMap<Element, boolean>
): TranslationTargetDecision[] {
    if (!shadowRoot.host.isConnected || !composedContains(scanRoot, shadowRoot.host)) return [];
    if (!isVisibleForTranslation(shadowRoot.host, context)) return [];
    if (context.mode === 'smart'
        && !isAllowedSmartShadowBoundary(shadowRoot.host, context.contentRoot, boundaryCache)) return [];
    if (!hasLocalTranslatableText(shadowRoot)) return [];

    const previousSkip = context.grabOptions?.shouldSkipSubtree;
    const shadowContext: TranslationTargetContext = {
        ...context,
        grabOptions: {
            ...context.grabOptions,
            shouldSkipSubtree: element => isInactiveSlotFallback(element) || Boolean(previousSkip?.(element))
        }
    };
    return collectTranslationTargets(shadowRoot, shadowContext, {
        includeSupplemental: false,
        fallback: options.fallback
    })
        .filter(decision => isAllowedShadowDecision(decision, shadowContext, boundaryCache))
        .map(decision => ({
            ...decision,
            source: decision.source === 'fallback' ? 'fallback' : 'shadow-root',
            reasons: [...decision.reasons, 'open-shadow-root']
        }));
}

function hasLocalTranslatableText(root: ShadowRoot): boolean {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current: Node | null;
    while (current = walker.nextNode()) {
        if (!current.textContent?.trim()) continue;
        const parent = current.parentElement;
        if (!parent || parent.closest('script, style, noscript, template')) continue;
        if (isInactiveSlotFallback(parent)) continue;
        return true;
    }
    return false;
}

function isAllowedShadowDecision(
    decision: TranslationTargetDecision,
    context: TranslationTargetContext,
    boundaryCache: WeakMap<Element, boolean>
): boolean {
    const target = decision.target;
    if (isInactiveSlotFallback(target)) return false;
    if (context.mode === 'full') return true;
    if (!isAllowedSmartShadowBoundary(target, context.contentRoot, boundaryCache)) return false;

    const text = getCachedNormalizedText(context.grabOptions?.scanContext, target);
    const hint = getStructuralHint(target);
    if (/session[_-]*(time|duration)|visually[_-]*hidden|screen[_-]*reader|sr[_-]*only/i.test(hint)) return false;
    if (target.matches('time')) return false;
    if (target.matches('a') && text.length < 80) return false;
    if (/^(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm))(?:\s*[-–—].*)?$/i.test(text)) return false;

    return true;
}

function isAllowedSmartShadowBoundary(
    element: Element,
    contentRoot: Element,
    cache: WeakMap<Element, boolean>
): boolean {
    if (element === document.body) return true;
    const cached = cache.get(element);
    if (cached !== undefined) return cached;

    const hint = [
        element.tagName,
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('role') ?? '',
        element.getAttribute('aria-label') ?? ''
    ].join(' ');
    let allowed = !/\b(cookie|feedback|advert|advertisement|promo|toolbar|menu|nav|navigation)\b/i.test(hint);
    if (allowed && /visually[_-]*hidden|screen[_-]*reader|sr[_-]*only/i.test(hint)) allowed = false;
    if (allowed && /session[_-]*(time|duration)/i.test(hint)) allowed = false;
    if (allowed && (element.matches('button') || element.getAttribute('role')?.toLowerCase() === 'button')) {
        allowed = element.hasAttribute('aria-expanded');
    }
    if (allowed && element !== contentRoot) {
        const parent = getComposedParentElement(element);
        allowed = Boolean(parent && isAllowedSmartShadowBoundary(parent, contentRoot, cache));
    }
    cache.set(element, allowed);
    return allowed;
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
    const newlineTargets = collectPreservedNewlineTextTargets(unit, context.grabOptions ?? {});
    if (newlineTargets) return newlineTargets;
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
            ...(chooseStrongerSource(existing.source, candidate.source) === existing.source ? existing : candidate),
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
    const segmentedBlockquotes = collectSegmentedBlockquotes(unique);
    const shouldKeepNested = (parent: Element, child: Element): boolean => {
        if (segmentedBlockquotes.has(parent) && child.parentElement === parent) return true;
        return shouldKeepNestedTarget(parent, child, context);
    };

    return unique.filter(decision => {
        if (segmentedBlockquotes.has(decision.target)) return false;

        if (unique.some(other =>
            decision !== other
            && decision.target.contains(other.target)
            && !hasExcludedTranslatableTextBoundary(decision.target, other.target)
            && shouldKeepNested(decision.target, other.target)
        )) {
            return false;
        }

        return !unique.some(other => {
            if (decision === other || !other.target.contains(decision.target)) return false;
            if (hasExcludedTranslatableTextBoundary(other.target, decision.target)) return false;
            return !shouldKeepNested(other.target, decision.target);
        });
    });
}

function collectSegmentedBlockquotes(decisions: TranslationTargetDecision[]): Set<Element> {
    const targets = new Set(decisions.map(decision => decision.target));

    return new Set(decisions
        .map(decision => decision.target)
        .filter(target => {
            if (!target.matches('blockquote')) return false;
            if (Array.from(target.childNodes).some(node => node instanceof Text && Boolean(node.textContent?.trim()))) {
                return false;
            }

            const children = Array.from(target.children);
            return children.length >= 2
                && children.every(child => child.matches('p'))
                && children.every(child => targets.has(child) || child.getAttribute(TRANSLATED_ATTR) === 'true');
        }));
}

function shouldKeepNestedTarget(parent: Element, child: Element, context: TranslationTargetContext): boolean {
    const profile = getCurrentSiteProfile();
    if (profile?.shouldKeepNestedTarget) {
        return profile.shouldKeepNestedTarget(parent, child, context);
    }

    return shouldKeepReadingSectionTarget(parent, child, context);
}

function shouldKeepReadingSectionTarget(
    parent: Element,
    child: Element,
    context: TranslationTargetContext
): boolean {
    if (child.parentElement !== parent) return false;

    const heading = Array.from(parent.children).find(element =>
        element.matches(READING_HEADING_SELECTOR)
    );
    if (!heading) return false;
    if (child.matches(READING_HEADING_SELECTOR)) return true;
    if (!isReadingBlockLeaf(child)) return false;

    const position = heading.compareDocumentPosition(child);
    return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)
        && getReadingBlockTargets(child, context.grabOptions?.scanContext, context.contentRoot, context.grabOptions?.scanBudget ?? 'supplemental').includes(child);
}

function chooseStrongerSource(
    left: TranslationTargetCandidate['source'],
    right: TranslationTargetCandidate['source']
): TranslationTargetCandidate['source'] {
    const order: TranslationTargetCandidate['source'][] = ['site-profile', 'reading-block', 'supplemental', 'content-unit', 'dom-unit', 'grab-node', 'fallback', 'shadow-root'];
    return order.indexOf(right) < order.indexOf(left) ? right : left;
}
