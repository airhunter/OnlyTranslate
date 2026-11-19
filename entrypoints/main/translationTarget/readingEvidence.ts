import { withPageTranslateOverride } from '@/entrypoints/utils/pageTranslateOptOut';
import { getTranslatableTextWithProtectedInline } from '@/entrypoints/main/dom';
import { getContentFilterDecision, hasPromotionalCallToAction, NEWSLETTER_INVITATION_PATTERN } from '@/entrypoints/utils/contentFilter';
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier';
import { getProseEvidence, type ProseEvidence } from '@/entrypoints/utils/proseSignals';
import { composedClosest, getComposedParentElement } from './composedTree';
import {
    getCachedContentFilterDecision, getCachedContentUnitDecision, getCachedProseEvidence,
    getCachedVisibility, isElementVisible, markScannedElement, tryUseScanBudget, createScanContext,
    type ScanBudgetKind, type ScanContext
} from './scanContext';

const PROTECTED = 'script, style, noscript, template, iframe, pre, input, textarea, select, [hidden], [aria-hidden="true"], .notranslate, [translate="no"]';
const INTERFACE = 'nav, footer, form, dialog, button, [role="button"], [role="navigation"], [role="contentinfo"], [role="dialog"], [role="menu"], [role="menubar"], [role="toolbar"], [role="tablist"]';
const METADATA_REGION = /\b(author|byline|bio|rights|rightslink|permissions|references|bibliography|citation|metrics|copyright|footer|attribution|metabox|metadata)\b/i;
const AUXILIARY_MODULE = /\b(ad|ads|advertisement|advertising|billboard|related|recommended|recommendations|share|social)\b/i;
const CONTROL_REGION = /\b(cookie|consent|toolbar|form)\b/i;
const METADATA_COPY = /(?:^copyright\s|\bauthor has\s+[\d.,kmb]+\s+(?:answers|posts|views)\b)/i;
const RECOMMENDATION_LABEL = /^(?:related(?: articles| reading)?|recommended(?: reading)?|suggested profiles|relevant people|read next|more from)\s*:?$/i;
export const COMMENT_LABEL = /^(?:(?:reader|user)\s+)?(?:comments?|replies|discussion)(?:\s*\(\d+\))?\s*:?$/i;

export function isRecommendationBlock(node: Element): boolean {
    const region = composedClosest(node, 'aside, [role="complementary"]') ?? getComposedParentElement(node);
    if (!region || region.matches('main, article, body, html')) return false;
    return Array.from(region.querySelectorAll(':scope > :is(label, [data-field="label"], strong, h1, h2, h3, h4, h5, h6), :scope > span > label'))
        .some(label => RECOMMENDATION_LABEL.test(label.textContent?.trim() ?? ''));
}

function isEditable(node: Element): boolean {
    const owner = composedClosest(node, '[contenteditable]');
    return Boolean(owner && owner.getAttribute('contenteditable')?.toLowerCase() !== 'false');
}

function getPurposeHint(node: Element): string {
    return [node.id, typeof node.className === 'string' ? node.className : '', node.getAttribute('itemprop') ?? '']
        .join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function isMetadataModule(node: Element): boolean {
    // Machine naming is weak evidence inside an explicitly declared reading region.
    // Scalar bylines/fields still go through the shared filter and unit classifier.
    return (METADATA_REGION.test(getPurposeHint(node)) || node.classList.contains('source'))
        && !composedClosest(node, 'article, main, [role="article"], [role="main"]');
}

// Shared purpose checks do not decide whether weak text has enough reading context.
export interface ReadingPurposeDecision { policy: 'keep' | 'skip-self' | 'skip-subtree'; reason?: string; requiresReadingContext?: boolean; allowsProfileOverride?: boolean }

export function getReadingPurposeDecision(node: Element, context?: ScanContext, contextualLabel = false, budget: ScanBudgetKind = 'supplemental'): ReadingPurposeDecision {
    if (composedClosest(node, withPageTranslateOverride(PROTECTED, node, context?.allowedPageTranslateRoot)) || isEditable(node)) return { policy: 'skip-subtree', reason: 'protected-reading-boundary' };
    for (let parent: Element | null = node; parent; parent = getComposedParentElement(parent)) {
        if (parent.matches(INTERFACE) && !parent.matches('button[aria-expanded], [role="button"][aria-expanded]')) return { policy: 'skip-subtree', reason: 'protected-reading-boundary' };
    }
    if (!getCachedVisibility(context, node, isElementVisible)) return { policy: 'skip-subtree', reason: 'not-visible' };
    const usage = getCachedProseEvidence(context, node);
    if (COMMENT_LABEL.test(usage.text) && !node.matches('h1, h2, h3, h4, h5, h6, [role="heading"]')) return { policy: 'skip-self', reason: 'reading-section-label' };
    if (METADATA_COPY.test(usage.text)) return { policy: 'skip-self', reason: 'reading-metadata-copy' };
    if (isRecommendationBlock(node)) return { policy: 'skip-subtree', reason: 'independent-recommendation' };
    const flowContext = context ?? createScanContext();
    const carrier = getReadingFlowCarrier(node, flowContext, budget);
    if (!carrier) return { policy: 'skip-self', reason: 'reading-context-budget' };
    const region = composedClosest(node, 'aside, [role="complementary"], [role="note"], [itemprop="commentText"], [data-comment-body], .comment-body, .comment-content') ?? getComposedParentElement(carrier) ?? node;
    if (hasPromotionalCallToAction(node)) return { policy: 'skip-self', reason: 'promotional-reading-context' };
    if (!region.matches('article, main, body, html') && hasPromotionalCallToAction(region)) {
        const compoundRegion = region.matches('aside, [role="complementary"], [role="note"]')
            ? false : hasCompoundReadingBranches(region, flowContext, budget);
        if (compoundRegion === undefined) return { policy: 'skip-self', reason: 'reading-context-budget' };
        if (!compoundRegion) return { policy: 'skip-self', reason: 'promotional-reading-context' };
    }
    if (node.matches('ul, ol') && node.querySelector('input, textarea, select, [role="checkbox"], [role="radio"], [role="option"]')) {
        return { policy: 'skip-subtree', reason: 'reading-choice-list' };
    }
    if (NEWSLETTER_INVITATION_PATTERN.test(usage.text)) {
        return { policy: 'skip-self', reason: 'newsletter-copy' };
    }
    let weakBoundary = false;
    for (let current: Element | null = node; current; current = getComposedParentElement(current)) {
        // Subject labels are not metadata-purpose declarations.
        const hint = getPurposeHint(current);
        if (COMMENT_LABEL.test(usage.text) && /\bcomments?\b/i.test(hint)) return { policy: 'skip-self', reason: 'reading-section-label' };
        const dedicatedRegion = current.matches('aside, [role="complementary"], [role="note"]');
        if (isMetadataModule(current)) return { policy: 'skip-subtree', reason: 'reading-metadata-region' };
        if (CONTROL_REGION.test(hint) && !current.matches('main, article, body')
            && current.querySelector('button, input, textarea, [role="button"]')) return { policy: 'skip-subtree', reason: 'reading-control-region' };
        if (AUXILIARY_MODULE.test(hint) && (dedicatedRegion || /\b(ad|ads|advertisement|advertising|billboard)\b/i.test(hint))) return { policy: 'skip-subtree', reason: 'auxiliary-reading-module' };
        const filter = getCachedContentFilterDecision(context, current, getContentFilterDecision);
        if (filter === 'skip-self') {
            const unit = getCachedContentUnitDecision(context, node, classifyContentUnit);
            if (unit.action !== 'allow' && !(contextualLabel && unit.requiresReadingContext)
                && (current !== node || getCachedProseEvidence(context, node).strength !== 'strong')) return { policy: 'skip-self', reason: 'reading-purpose-filter', allowsProfileOverride: true };
        }
        if (filter === 'skip-subtree' && !current.matches('aside, [role="complementary"]')) return { policy: 'skip-subtree', reason: 'reading-purpose-boundary' };
        if (filter === 'skip-subtree') weakBoundary = true;
        if (current.matches('main, article, body')) break;
    }
    const unit = getCachedContentUnitDecision(context, node, classifyContentUnit);
    if (unit.action === 'skip' && unit.confidence >= 0.85 && !(contextualLabel && unit.requiresReadingContext)) return { policy: 'skip-self', reason: 'reading-unit-purpose' };
    return { policy: 'keep', requiresReadingContext: weakBoundary && !contextualLabel && unit.action !== 'allow' && usage.strength !== 'strong' };
}

export function getReadingPurposeExclusion(node: Element, context?: ScanContext, contextualLabel = false, budget: ScanBudgetKind = 'supplemental'): string | undefined {
    return getReadingPurposeDecision(node, context, contextualLabel, budget).reason;
}

// A single-child layout div does not introduce a reading module. Never cross
// semantic containers/roles or erase source nodes; only resolve relationships.
function isSingleBranchWrapper(node: Element, context: ScanContext, budget: ScanBudgetKind): boolean | undefined {
    if (!node.matches('div') || node.childElementCount !== 1 || node.id || node.classList.length
        || node.matches('[role], [itemprop], [itemscope], [contenteditable], [translate], [lang], [hidden], [aria-hidden]')) return false;
    for (const child of node.childNodes) {
        if (!tryUseScanBudget(context, budget)) { context.stats.budgetDeferredReadingSubtrees++; return undefined; }
        markScannedElement(context);
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return false;
    }
    return true;
}

export function getReadingFlowCarrier(node: Element, context: ScanContext, budget: ScanBudgetKind): Element | null {
    let current = node;
    for (let parent = current.parentElement; parent; parent = current.parentElement) {
        const neutral = isSingleBranchWrapper(parent, context, budget);
        if (neutral === undefined) return null;
        if (!neutral) break;
        current = parent;
    }
    return current;
}

export function unwrapReadingFlowBranch(node: Element, context: ScanContext, budget: ScanBudgetKind): Element | null {
    let current = node;
    while (true) {
        const neutral = isSingleBranchWrapper(current, context, budget);
        if (neutral === undefined) return null;
        if (!neutral) return current;
        current = current.firstElementChild!;
    }
}

function hasCompoundReadingBranches(region: Element, context: ScanContext, budget: ScanBudgetKind): boolean | undefined {
    const cached = context.readingCompounds.get(region);
    if (cached !== undefined) return cached;
    for (const child of region.children) {
        if (!tryUseScanBudget(context, budget)) { context.stats.budgetDeferredReadingSubtrees++; return undefined; }
        markScannedElement(context);
        const branch = unwrapReadingFlowBranch(child, context, budget);
        if (!branch) return undefined;
        if (branch.matches(`${PROTECTED}, ${INTERFACE}`) || isEditable(branch)
            || !getCachedVisibility(context, branch, isElementVisible)) continue;
        if (branch.matches('main, article, section, aside, ul, ol')) { context.readingCompounds.set(region, true); return true; }
        let current = branch.firstElementChild;
        while (current) {
            if (!tryUseScanBudget(context, budget)) { context.stats.budgetDeferredReadingSubtrees++; return undefined; }
            markScannedElement(context);
            const protectedBranch = current.matches(`${PROTECTED}, ${INTERFACE}`) || isEditable(current)
                || !getCachedVisibility(context, current, isElementVisible);
            if (!protectedBranch && current.matches('p, blockquote, li')) { context.readingCompounds.set(region, true); return true; }
            if (!protectedBranch && current.firstElementChild) { current = current.firstElementChild; continue; }
            while (current !== branch && !current.nextElementSibling) current = current.parentElement!;
            current = current === branch ? null : current.nextElementSibling;
        }
    }
    context.readingCompounds.set(region, false);
    return false;
}

// Text used as prose evidence excludes protected descendants. Usage/purpose metrics
// above intentionally retain controls and links so stripping cannot erase their purpose.
export function getReadingProseEvidence(node: Element, context?: ScanContext, budget?: ScanBudgetKind): ProseEvidence | undefined {
    const cached = context?.readingEvidence.get(node);
    if (cached) return cached;
    const budgetStop = {};
    const texts = new WeakMap<Element, string>();
    const getText = (element: Element): string => {
        const cachedText = texts.get(element);
        if (cachedText !== undefined) return cachedText;
        const source = getTranslatableTextWithProtectedInline(element, child => {
            if (!tryUseScanBudget(context, budget)) throw budgetStop;
            markScannedElement(context);
            if (child.matches(`${PROTECTED}, ${INTERFACE}`) || isEditable(child)
                || !getCachedVisibility(context, child, isElementVisible)) return true;
            if (isMetadataModule(child)) return true;
            return getCachedContentFilterDecision(context, child, getContentFilterDecision) !== 'keep'
                && !child.matches('aside, [role="complementary"]');
        });
        let text = source.text;
        for (const inline of source.protectedInlines) text = text.replaceAll(inline.placeholder, '');
        texts.set(element, text);
        return text;
    };
    try {
        const evidence = getProseEvidence(node, { getText });
        context?.readingEvidence.set(node, evidence);
        return evidence;
    } catch (error) {
        if (error !== budgetStop) throw error;
        if (context) context.stats.budgetDeferredReadingSubtrees++;
        return undefined;
    }
}
