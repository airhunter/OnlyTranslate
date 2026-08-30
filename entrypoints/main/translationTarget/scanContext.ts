import { invalidateContentFilterCache, type ContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import type { ContentUnitDecision } from '@/entrypoints/utils/contentUnitClassifier';
import {
    getProseEvidence,
    getStructuralHint,
    type ProseEvidence
} from '@/entrypoints/utils/proseSignals';
import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from './constants';

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
    visibleNormalizedText: WeakMap<Element, string>;
    contentFilter: WeakMap<Element, ContentFilterDecision>;
    contentUnit: WeakMap<Element, ContentUnitDecision>;
    proseEvidence: WeakMap<Element, ProseEvidence>;
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
        visibleNormalizedText: new WeakMap(),
        contentFilter: new WeakMap(),
        contentUnit: new WeakMap(),
        proseEvidence: new WeakMap(),
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

// 单次失效最多遍历的后代数量。对超大子树（例如 body 顶层容器变更）只清理根节点本身，避免 querySelectorAll('*')
// 全量遍历 DOM 拖垮主线程；其余后代会在自身发生变更时再被失效。
const MAX_INVALIDATION_DESCENDANTS = 2000;

function deleteScanCacheEntry(context: ScanContext, element: Element): void {
    context.normalizedText.delete(element);
    context.visibleNormalizedText.delete(element);
    context.contentFilter.delete(element);
    context.contentUnit.delete(element);
    context.proseEvidence.delete(element);
    context.visibility.delete(element);
    context.uiSubtree.delete(element);
    // contentFilter 模块内的按元素记忆化与 scanContext 缓存生命周期一致，需一并失效。
    invalidateContentFilterCache(element);
}

export function invalidateScanCache(context: ScanContext | undefined, root: Element): void {
    if (!context) return;

    deleteScanCacheEntry(context, root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let processed = 0;
    while (walker.nextNode()) {
        deleteScanCacheEntry(context, walker.currentNode as Element);
        if (++processed >= MAX_INVALIDATION_DESCENDANTS) break;
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

export function getCachedVisibleNormalizedText(context: ScanContext | undefined, element: Element): string {
    const cached = context?.visibleNormalizedText.get(element);
    if (cached !== undefined) return cached;

    const text = collectVisibleText(context, element).replace(/\s+/g, ' ').trim();
    context?.visibleNormalizedText.set(element, text);
    return text;
}

export function isElementVisible(element: Element): boolean {
    let current: Element | null = element;

    while (current) {
        if (isElementSelfHidden(current)) return false;
        current = current.parentElement;
    }

    return true;
}

function collectVisibleText(context: ScanContext | undefined, element: Element): string {
    if (!getCachedVisibility(context, element, isElementVisible)) return '';

    const parts: string[] = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (node instanceof Element) {
                    if (isNonRenderedTextElement(node) || isElementSelfHidden(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }

                if (node instanceof Text && node.textContent?.trim()) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    let current: Node | null;
    while (current = walker.nextNode()) {
        parts.push(current.textContent ?? '');
    }

    return parts.join(' ');
}

function isNonRenderedTextElement(element: Element): boolean {
    return ['script', 'style', 'noscript', 'template', 'iframe'].includes(element.tagName.toLowerCase());
}

function isElementSelfHidden(element: Element): boolean {
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true;

    try {
        const style = window.getComputedStyle(element);
        return style.display === 'none'
            || style.visibility === 'hidden'
            || style.visibility === 'collapse';
    } catch (_) {
        return false;
    }
}

export function getCachedProseEvidence(context: ScanContext | undefined, element: Element): ProseEvidence {
    const cached = context?.proseEvidence.get(element);
    if (cached) return cached;

    const evidence = getProseEvidence(element, {
        getText: node => getCachedNormalizedText(context, node)
    });
    context?.proseEvidence.set(element, evidence);
    return evidence;
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
    return POSITIVE_HINT_PATTERN.test(getStructuralHint(element));
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
    if (element.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"], .notranslate, [translate="no"], [hidden], [aria-hidden="true"]`)) return true;

    const hint = getStructuralHint(element);
    if (!NOISE_HINT_PATTERN.test(hint)) return false;
    if (POSITIVE_HINT_PATTERN.test(hint)) return false;

    const evidence = getCachedProseEvidence(context, element);
    if (evidence.strength === 'strong') return false;
    if (evidence.textLength > 600 && evidence.hasSentence && evidence.interactiveDensity < 0.45) return false;

    return true;
}
