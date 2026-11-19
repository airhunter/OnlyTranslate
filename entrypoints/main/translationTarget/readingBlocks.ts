import { withPageTranslateOverride } from '@/entrypoints/utils/pageTranslateOptOut';
import { INLINE_TEXT_TAGS, PROSE_TEXT_MIN } from '@/entrypoints/utils/proseSignals';
import { getTranslatableText } from '@/entrypoints/main/dom';
import { composedClosest, getComposedParentElement } from './composedTree';
import { BILINGUAL_CONTENT_CLASS } from './constants';
import { createScanContext, getCachedProseEvidence, getCachedVisibility, isElementVisible, markScannedElement, tryUseScanBudget, type ScanBudgetKind, type ScanContext } from './scanContext';
import { COMMENT_LABEL, getReadingFlowCarrier, unwrapReadingFlowBranch, getReadingProseEvidence, getReadingPurposeExclusion, getReadingPurposeDecision } from './readingEvidence';
export { isRecommendationBlock } from './readingEvidence';

const COMMENT_BODY = '[itemprop="commentText"], [data-comment-body], .comment-body, .comment-content';
const READING_REGION = `aside, [role="complementary"], [role="note"], header, ${COMMENT_BODY}`;
const TEXT_BLOCK = 'p, li, blockquote, figcaption, dd, div, section, article';
const BLOCK_CHILDREN = 'p, li, blockquote, figcaption, dd, div, section, article, ul, ol, table, h1, h2, h3, h4, h5, h6, [role="heading"]';
const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"], strong, b';
const GROUP_BOUNDARY = 'article, main, section, aside, [role="article"], [role="main"], [role="note"], [role="complementary"]';
const HARD_BOUNDARY = 'nav, footer, form, dialog, a, button, [role="button"], [role="navigation"], [role="contentinfo"], [role="dialog"], [hidden], [aria-hidden="true"], .notranslate, [translate="no"]';

export function isReadingBlockLeaf(node: Element): boolean {
    if (!node.matches(`${TEXT_BLOCK}, span`) || node.querySelector(BLOCK_CHILDREN)) return false;
    // Formatting spans inside a paragraph are not independent reading blocks.
    return !node.matches('span') || !composedClosest(node.parentElement ?? node, 'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, [role="heading"], strong, b');
}

export function isCommentReadingRegion(node: Element): boolean {
    return Boolean(composedClosest(node, COMMENT_BODY));
}

export function getReadingBlockRegion(node: Element, context?: ScanContext): Element | null {
    if (composedClosest(node, withPageTranslateOverride(HARD_BOUNDARY, node, context?.allowedPageTranslateRoot))) return null;
    return composedClosest(node, READING_REGION) ?? getComposedParentElement(node) ?? node;
}

export function getReadingBlockTargets(node: Element, scanContext?: ScanContext, _contentRoot?: Element, budget: ScanBudgetKind = 'supplemental'): Element[] {
    const region = getReadingBlockRegion(node, scanContext);
    if (!region || !isReadingBlockLeaf(node)) return [];
    const context = scanContext ?? createScanContext();
    if (getReadingPurposeExclusion(node, context, false, budget)) return [];
    const usage = getCachedProseEvidence(context, node);
    if (usage.textLength < 3 || usage.textLength > 3072 || usage.buttonCount || usage.interactiveDensity >= 0.45) return [];
    const evidence = getReadingProseEvidence(node, context, budget);
    if (!evidence) return [];
    const comment = composedClosest(node, COMMENT_BODY);
    if (comment) {
        if (getReadingPurposeExclusion(comment, context, false, budget)) return [];
        return getReadingProseEvidence(comment, context, budget)?.strength === 'strong' ? [node] : [];
    }
    const heading = findReadingHeading(node, context, budget);
    const title = heading && !(composedClosest(node, 'aside, [role="complementary"]')
        && heading.matches('h1, [role="heading"][aria-level="1"]')) && isReadingLabel(heading, context) ? heading : null;
    const contextualRegion = composedClosest(node, READING_REGION);
    if (evidence.strength === 'strong') {
        if (contextualRegion?.matches('aside, header, [role="complementary"]')
            && evidence.textLength < PROSE_TEXT_MIN && !title && !composedClosest(node, 'article, [role="article"], [role="note"]')) return [];
        return title ? [node, title] : [node];
    }
    if (evidence.strength === 'weak' && title) return [node, title];

    // Context comes from independently readable siblings, not a fixed list length,
    // wording, punctuation or a previously selected weak block.
    const preceding = evidence.strength === 'weak' ? nextReadingSibling(node, -1, context, budget) : null;
    for (const neighbour of [preceding, nextReadingSibling(node, 1, context, budget)]) {
        if (neighbour && hasIndependentReadingSupport(neighbour, context, budget)) return [node];
    }
    return [];
}

function nextReadingSibling(node: Element, direction: -1 | 1, context: ScanContext, budget: ScanBudgetKind): Element | null {
    const carrier = getReadingFlowCarrier(node, context, budget);
    if (!carrier) return null;
    let sibling = direction < 0 ? carrier.previousElementSibling : carrier.nextElementSibling;
    while (sibling) {
        if (!useContextBudget(context, budget)) return null;
        if (sibling.matches(`${GROUP_BOUNDARY}, ${HARD_BOUNDARY}`)) return null;
        const branch = unwrapReadingFlowBranch(sibling, context, budget);
        if (!branch || branch.matches(`${GROUP_BOUNDARY}, ${HARD_BOUNDARY}`)) return null;
        if (branch.textContent?.trim()) return branch;
        if (branch.childElementCount || branch.id || branch.classList.length) return null;
        sibling = direction < 0 ? sibling.previousElementSibling : sibling.nextElementSibling;
    }
    return null;
}

function hasIndependentReadingSupport(node: Element, context: ScanContext, budget: ScanBudgetKind): boolean {
    const branch = unwrapReadingFlowBranch(node, context, budget);
    if (!branch || branch.matches(HEADING) || !getReadingBlockRegion(branch, context)) return false;
    const purpose = getReadingPurposeDecision(branch, context, false, budget);
    if (purpose.policy === 'skip-subtree') return false;
    if (isReadingBlockLeaf(branch)) {
        return purpose.policy === 'keep' && getReadingProseEvidence(branch, context, budget)?.strength === 'strong';
    }
    // Lists and quotations have an explicit reading relationship. Other boxes
    // cannot lend aggregated descendant text across an unexplained module.
    if (!branch.matches('ul, ol, li, blockquote')) return false;
    for (const child of branch.children) {
        if (!useContextBudget(context, budget)) return false;
        if (hasIndependentReadingSupport(child, context, budget)) return true;
    }
    return false;
}

function useContextBudget(context: ScanContext, budget: ScanBudgetKind): boolean {
    if (!tryUseScanBudget(context, budget)) { context.stats.budgetDeferredReadingSubtrees++; return false; }
    markScannedElement(context);
    return true;
}

function findReadingHeading(node: Element, context: ScanContext, budget: ScanBudgetKind): Element | null {
    for (let current: Element | null = node; current && !current.matches('body, html'); current = getComposedParentElement(current)) {
        const parent = getComposedParentElement(current);
        if (!parent || !useContextBudget(context, budget)) return null;
        let section = context.readingSections.get(parent);
        if (!section) {
            section = { next: parent.firstElementChild, heading: null, byChild: new WeakMap() };
            context.readingSections.set(parent, section);
        }
        while (!section.byChild.has(current) && section.next) {
            if (!useContextBudget(context, budget)) return null;
            const child: Element = section.next;
            section.byChild.set(child, section.heading);
            section.next = child.nextElementSibling;
            if (child.matches(HEADING)) section.heading = child;
            else if (child.matches('header')) section.heading = child.querySelector(HEADING);
            else if (child.matches(GROUP_BOUNDARY)) section.heading = null;
        }
        const heading = section.byChild.get(current);
        if (heading) return heading;
        if (current.matches(GROUP_BOUNDARY)) break;
    }
    return null;
}

function isReadingLabel(title: Element, context: ScanContext): boolean {
    const text = getReadingLabelText(title);
    return text.length > 0 && text.length <= 240 && !COMMENT_LABEL.test(text)
        && getCachedVisibility(context, title, isElementVisible)
        && Array.from(title.children).every(child => child.matches('code') || INLINE_TEXT_TAGS.has(child.localName))
        && !title.querySelector('a, button, input')
        && !getReadingPurposeExclusion(title, context, true);
}

function getReadingLabelText(title: Element): string {
    let source = title;
    if (title.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)) {
        source = title.cloneNode(true) as Element;
        source.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}`).forEach(node => node.remove());
    }
    return getTranslatableText(source).replace(/\s+/g, ' ').trim();
}
