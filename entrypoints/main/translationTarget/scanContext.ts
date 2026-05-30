import type { ContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import type { ContentUnitDecision } from '@/entrypoints/utils/contentUnitClassifier';

export type ScanBudgetKind = 'supplemental' | 'dynamic';

export interface TranslationTargetStats {
    scannedElements: number;
    classifiedElements: number;
    skippedSubtrees: number;
    budgetExceeded: boolean;
    profileFastPathUsed: boolean;
}

export interface ScanContext {
    stats: TranslationTargetStats;
    budgets: Record<ScanBudgetKind, number>;
    budgetUsage: Record<ScanBudgetKind, number>;
    normalizedText: WeakMap<Element, string>;
    contentFilter: WeakMap<Element, ContentFilterDecision>;
    contentUnit: WeakMap<Element, ContentUnitDecision>;
    visibility: WeakMap<Element, boolean>;
    uiSubtree: WeakMap<Element, boolean>;
}

export interface ScanContextOptions {
    supplementalBudget?: number;
    dynamicBudget?: number;
}

const DEFAULT_SUPPLEMENTAL_BUDGET = 2500;
const DEFAULT_DYNAMIC_BUDGET = 800;

const OBVIOUS_UI_SELECTOR = [
    'nav',
    'footer',
    'form',
    'dialog',
    'button',
    '[role="navigation"]',
    '[role="toolbar"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="tablist"]',
    '[role="tab"]'
].join(', ');

const NOISE_HINT_PATTERN = /\b(ad|ads|advert|advertisement|advertising|banner|cookie|login|modal|nav|newsletter|promo|recommend|recommended|related|share|sidebar|sponsor|sponsored|subscribe|toolbar|trending|widget)\b/i;
const POSITIVE_HINT_PATTERN = /\b(article|body|content|entry|live|main|markdown|post|prose|story)\b/i;
const READING_CANDIDATE_SELECTOR = [
    'article',
    'main',
    'section',
    '[role="article"]',
    '[role="main"]',
    'h1',
    'h2',
    'h3',
    'h4',
    'p',
    'li',
    'blockquote',
    'figcaption',
    'a.raw-topic-link',
    'a[class*="raw-topic-link"]',
    'a[class*="topic-title"]',
    'a[class*="thread-title"]',
    'a[class*="discussion-title"]',
    'a[class*="post-title"]'
].join(', ');

export function createScanContext(options: ScanContextOptions = {}): ScanContext {
    return {
        stats: {
            scannedElements: 0,
            classifiedElements: 0,
            skippedSubtrees: 0,
            budgetExceeded: false,
            profileFastPathUsed: false
        },
        budgets: {
            supplemental: options.supplementalBudget ?? DEFAULT_SUPPLEMENTAL_BUDGET,
            dynamic: options.dynamicBudget ?? DEFAULT_DYNAMIC_BUDGET
        },
        budgetUsage: {
            supplemental: 0,
            dynamic: 0
        },
        normalizedText: new WeakMap(),
        contentFilter: new WeakMap(),
        contentUnit: new WeakMap(),
        visibility: new WeakMap(),
        uiSubtree: new WeakMap()
    };
}

export function cloneScanStats(context?: ScanContext): TranslationTargetStats | undefined {
    if (!context) return undefined;
    return { ...context.stats };
}

export function markScannedElement(context?: ScanContext): void {
    if (!context) return;
    context.stats.scannedElements += 1;
}

export function markSkippedSubtree(context?: ScanContext): void {
    if (!context) return;
    context.stats.skippedSubtrees += 1;
}

export function resetScanBudget(context: ScanContext | undefined, budget: ScanBudgetKind): void {
    if (!context) return;
    context.budgetUsage[budget] = 0;
}

export function invalidateScanCache(context: ScanContext | undefined, root: Element): void {
    if (!context) return;

    const elements = [root, ...Array.from(root.querySelectorAll<Element>('*'))];
    for (const element of elements) {
        context.normalizedText.delete(element);
        context.contentFilter.delete(element);
        context.contentUnit.delete(element);
        context.visibility.delete(element);
        context.uiSubtree.delete(element);
    }
}

export function tryUseScanBudget(context: ScanContext | undefined, budget?: ScanBudgetKind): boolean {
    if (!context || !budget) return true;
    if (context.budgetUsage[budget] >= context.budgets[budget]) {
        context.stats.budgetExceeded = true;
        return false;
    }
    context.budgetUsage[budget] += 1;
    return true;
}

export function getCachedNormalizedText(context: ScanContext | undefined, element: Element): string {
    const cached = context?.normalizedText.get(element);
    if (cached !== undefined) return cached;

    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    context?.normalizedText.set(element, text);
    return text;
}

export function getCachedContentFilterDecision(
    context: ScanContext | undefined,
    element: Element,
    compute: (element: Element) => ContentFilterDecision
): ContentFilterDecision {
    const cached = context?.contentFilter.get(element);
    if (cached) return cached;

    const decision = compute(element);
    context?.contentFilter.set(element, decision);
    return decision;
}

export function getCachedContentUnitDecision(
    context: ScanContext | undefined,
    element: Element,
    compute: (element: Element) => ContentUnitDecision
): ContentUnitDecision {
    const cached = context?.contentUnit.get(element);
    if (cached) return cached;

    const decision = compute(element);
    if (context) {
        context.stats.classifiedElements += 1;
        context.contentUnit.set(element, decision);
    }
    return decision;
}

export function getCachedVisibility(
    context: ScanContext | undefined,
    element: Element,
    compute: (element: Element) => boolean
): boolean {
    const cached = context?.visibility.get(element);
    if (cached !== undefined) return cached;

    const visible = compute(element);
    context?.visibility.set(element, visible);
    return visible;
}

export function isObviousUiSubtree(context: ScanContext | undefined, element: Element): boolean {
    const cached = context?.uiSubtree.get(element);
    if (cached !== undefined) return cached;

    const result = computeObviousUiSubtree(context, element);
    context?.uiSubtree.set(element, result);
    return result;
}

export function isLikelyReadingCandidate(element: Element): boolean {
    if (element.matches(READING_CANDIDATE_SELECTOR)) return true;
    return POSITIVE_HINT_PATTERN.test(getElementHint(element));
}

export function hasEnoughProfileTargets(targets: Element[], context?: ScanContext): boolean {
    if (targets.length < 2) return false;

    const textLength = targets
        .reduce((total, target) => total + getCachedNormalizedText(context, target).length, 0);
    return textLength >= 80;
}

function computeObviousUiSubtree(context: ScanContext | undefined, element: Element): boolean {
    if (element.matches(OBVIOUS_UI_SELECTOR)) return true;
    if (element.closest('nav, footer, form, dialog, [role="navigation"], [role="toolbar"], [role="menu"], [role="menubar"], [role="tablist"]')) return true;
    if (element.closest('.only-translate-bilingual-content, [data-fr-translated="true"], .notranslate, [translate="no"], [hidden], [aria-hidden="true"]')) return true;

    const hint = getElementHint(element);
    if (!NOISE_HINT_PATTERN.test(hint)) return false;
    if (POSITIVE_HINT_PATTERN.test(hint)) return false;

    const text = getCachedNormalizedText(context, element);
    if (text.length > 600 && /[.!?\u3002\uff01\uff1f]/.test(text)) return false;

    return true;
}

function getElementHint(element: Element): string {
    return [
        element.tagName.toLowerCase(),
        element.id,
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute('role') ?? '',
        element.getAttribute('aria-label') ?? '',
        element.getAttribute('title') ?? '',
        element.getAttribute('data-component-name') ?? '',
        element.getAttribute('data-testid') ?? '',
        element.getAttribute('data-test-id') ?? ''
    ].join(' ');
}
