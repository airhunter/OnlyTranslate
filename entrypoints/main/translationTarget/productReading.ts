import { DIRECT_TEXT_TARGET_ATTR, grabAllNode, inlineSet, wrapDirectTextRun } from '@/entrypoints/main/dom';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';
import { isElementVisible } from './scanContext';
import { BILINGUAL_CONTENT_CLASS, TRANSLATED_ATTR } from './constants';
import type { TranslationTargetContext } from './types';

const COPY_SELECTOR = '[itemprop~="description"], h1[itemprop~="name"]';
const PROTECTED_SELECTOR = 'input, textarea, select, button, label, fieldset, output, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="dialog"], [hidden], [aria-hidden="true"], [translate="no"], .notranslate, [itemprop~="offers"], [itemprop~="review"], [itemprop~="aggregateRating"]';
const MANAGED_SELECTOR = `[${DIRECT_TEXT_TARGET_ATTR}], .${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`;

// Recover explicit Product microdata only. A form's length or prose density is
// not enough evidence to turn its labels and controls into reading content.
export function getProductReadingRegion(node: Element): Element | null {
    const form = node.closest('form');
    if (!form || node.closest(PROTECTED_SELECTOR)) return null;
    if (form.querySelector('input[type="password"], [autocomplete*="cc-"], [autocomplete~="shipping"], [autocomplete~="billing"]')) return null;
    const region = node.closest(COPY_SELECTOR);
    if (!region) return null;
    const owner = region.parentElement?.closest('[itemscope]');
    if (!owner?.getAttribute('itemtype')?.split(/\s+/).some(type => /^https?:\/\/schema\.org\/Product\/?$/.test(type))) return null;
    if (region.hasAttribute('itemscope')) return null;
    if (node.closest('[itemscope]') !== owner) return null;
    // Do not exempt navigation, recommendations, modals or metadata just
    // because a descendant carries product microdata. Only ignore form itself.
    for (let current: Element | null = node; current; current = current.parentElement) {
        if (current.matches(PROTECTED_SELECTOR)) return null;
        if (current.tagName !== 'FORM' && getContentFilterDecision(current) !== 'keep') return null;
    }
    return region;
}

export function isProductReadingTarget(node: Element): boolean {
    return getProductReadingRegion(node) !== null && !node.querySelector(`${PROTECTED_SELECTOR}, [itemscope]`);
}

export function collectProductReadingTargets(root: ParentNode, context: TranslationTargetContext): Element[] {
    if (context.scope !== 'smart' || context.mode !== 'smart') return [];
    const regions = [
        ...(root instanceof Element && root.matches(COPY_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll(COPY_SELECTOR))
    ];
    const targets: Element[] = [];
    for (const region of regions) {
        if (!getProductReadingRegion(region) || !isElementVisible(region) || region.closest(MANAGED_SELECTOR)) continue;
        const options = {
            ...context.grabOptions,
            contentFilter: getContentFilterDecision,
            contentUnitClassifier: undefined,
            shouldSkipSubtree: (node: Element) => Boolean(context.grabOptions?.shouldSkipSubtree?.(node))
                || node.matches(PROTECTED_SELECTOR) || !getProductReadingRegion(node)
        };
        // A colored sentence may consist of several inline spans before a
        // paragraph/list. Reuse reversible wrappers rather than translating
        // those formatting fragments independently.
        if (region.matches('[itemprop~="description"]')
            && Array.from(region.children).some(child => !inlineSet.has(child.tagName.toLowerCase()))) {
            let run: ChildNode[] = [];
            const flush = () => {
                if (run.some(node => node.textContent?.trim())) wrapDirectTextRun(region, run, options);
                run = [];
            };
            for (const child of Array.from(region.childNodes)) {
                if (child instanceof Text || (child instanceof Element && inlineSet.has(child.tagName.toLowerCase())
                    && !child.matches(`${MANAGED_SELECTOR}, ${PROTECTED_SELECTOR}`)
                    && !child.querySelector(PROTECTED_SELECTOR))) run.push(child);
                else flush();
            }
            flush();
        }
        targets.push(...grabAllNode(region, options).filter(isProductReadingTarget));
    }
    return targets;
}
