import {
    getTranslatableText, grabAllNode, inlineSet, isExcludedFromTranslatableText,
    isNumericContent, isProtectedInlineElement, wrapDirectTextRun,
    type GrabAllNodeOptions,
} from '@/entrypoints/main/dom';
import { composedClosest } from './composedTree';
import { isElementVisible, markScannedElement, markSkippedSubtree } from './scanContext';
import { BILINGUAL_CONTENT_CLASS, TRANSLATED_ATTR } from './constants';
import { hasSentencePunctuation } from '@/entrypoints/utils/proseSignals';

// Full Page 扩大阅读范围，但不扩大编辑区、输入值和代码的写入权限。
const FULL_PAGE_SOURCE_PROTECTED_SELECTOR = [
    'script', 'style', 'noscript', 'template', 'iframe', 'input', 'textarea', 'select', 'option',
    'pre', 'code', 'kbd', 'samp', 'var', 'math', '.math', 'mjx-container', 'svg', 'canvas',
    'table.highlight', 'table.diff-table', '[contenteditable]:not([contenteditable="false"])',
    '.notranslate', '[translate="no"]', '.sr-only', '[hidden]', '[aria-hidden="true"]',
    `.${BILINGUAL_CONTENT_CLASS}`,
    '.only-translate-loading', '.only-translate-retry-wrapper', '[data-only-translate-shadow-style]',
].join(', ');
export const FULL_PAGE_PROTECTED_SELECTOR = `${FULL_PAGE_SOURCE_PROTECTED_SELECTOR}, [${TRANSLATED_ATTR}="true"]`;
const CONTROL_SELECTOR = 'a, button, summary, [role="button"], [role="link"], [role^="menuitem"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]';
const LABEL_SELECTOR = 'th, td, caption, dt, dd, legend, label';
const LAYOUT_TAGS = new Set(['html', 'body', 'main', 'article', 'section', 'nav', 'header', 'footer', 'aside', 'form', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'details']);

export function isFullPageExcludedText(element: Element): boolean {
    return element.matches(FULL_PAGE_SOURCE_PROTECTED_SELECTOR) && !isProtectedInlineElement(element);
}

export function isFullPageVisible(element: Element): boolean {
    if (!isElementVisible(element)) return false;
    let current = element.parentElement;
    while (current) {
        if (current.matches('details:not([open])')) {
            const summary = current.querySelector(':scope > summary');
            if (!summary?.contains(element)) return false;
        }
        current = current.parentElement;
    }
    return true;
}

export function hasFullPageText(text: string): boolean {
    const value = text.trim();
    return /\p{L}/u.test(value) && !isNumericContent(value)
        && !/^[{\[].*"[A-Za-z]+"\s*:/s.test(value);
}

export function collectFullPageTargets(root: ParentNode, options: GrabAllNodeOptions): Element[] {
    // 复用已有正文分组；只补它遗漏的界面和零散静态文字。
    const targets = grabAllNode(root as Node, options).filter(target => isFullPageVisible(target)
        && !(target.querySelectorAll(CONTROL_SELECTOR).length > 1 && !hasSentencePunctuation(getTranslatableText(target)))
        && !Array.from(
        target.querySelectorAll('input, textarea, select, option, [contenteditable]:not([contenteditable="false"])')
    ).some(element => {
        let current: Element | null = element;
        while (current && current !== target) {
            if (isProtectedInlineElement(current) || isExcludedFromTranslatableText(current)) return false;
            current = current.parentElement;
        }
        return true;
    }));
    const covered = new Set(targets);
    const isCovered = (element: Element): boolean => {
        let current: Element | null = element;
        while (current) {
            if (covered.has(current)) return true;
            current = current.parentElement;
        }
        return false;
    };
    const isProtected = (element: Element): boolean => element.matches(FULL_PAGE_PROTECTED_SELECTOR)
        || isExcludedFromTranslatableText(element) || isProtectedInlineElement(element)
        || Boolean(options.shouldSkipSubtree?.(element)) || !isFullPageVisible(element);
    if (root instanceof Element && (composedClosest(root, FULL_PAGE_PROTECTED_SELECTOR) || isProtected(root))) return targets;

    const texts: Text[] = [];
    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node instanceof Element) {
                markScannedElement(options.scanContext);
                if (isProtected(node) || isCovered(node)) {
                    markSkippedSubtree(options.scanContext);
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_SKIP;
            }
            return node instanceof Text && hasFullPageText(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
    });
    while (walker.nextNode()) texts.push(walker.currentNode as Text);

    for (const text of texts) {
        const parent = text.parentElement;
        if (!parent || isCovered(parent) || composedClosest(parent, FULL_PAGE_PROTECTED_SELECTOR)) continue;
        const target = findLabelTarget(parent, root);
        if (target) {
            targets.push(target);
            covered.add(target);
            continue;
        }
        // 混合布局中的直接文字单独包装，不移动按钮、链接或输入控件。
        const run: ChildNode[] = [text];
        const isRunNode = (node: ChildNode): boolean => node instanceof Text
            || (node instanceof Element && inlineSet.has(node.tagName.toLowerCase())
                && !node.matches(CONTROL_SELECTOR) && !node.querySelector(CONTROL_SELECTOR)
                && !isProtected(node) && !isCovered(node));
        let sibling = text.previousSibling;
        while (sibling && isRunNode(sibling)) { run.unshift(sibling); sibling = sibling.previousSibling; }
        sibling = text.nextSibling;
        while (sibling && isRunNode(sibling)) { run.push(sibling); sibling = sibling.nextSibling; }
        const wrapper = wrapDirectTextRun(parent, run, options, true);
        if (wrapper) { targets.push(wrapper); covered.add(wrapper); }
    }
    return Array.from(new Set(targets));
}

function findLabelTarget(parent: Element, root: ParentNode): Element | null {
    let current = parent;
    while (true) {
        if (!LAYOUT_TAGS.has(current.tagName.toLowerCase()) && isInlineLabel(current)) {
            if (current.matches(CONTROL_SELECTOR + ', ' + LABEL_SELECTOR)) return current;
            const next = current.parentElement;
            if (!next || current === root || !isInlineLabel(next) || LAYOUT_TAGS.has(next.tagName.toLowerCase())) return current;
            current = next;
            continue;
        }
        return null;
    }
}

function isInlineLabel(element: Element): boolean {
    if (element.querySelector(FULL_PAGE_PROTECTED_SELECTOR)) return false;
    if (element.querySelectorAll(CONTROL_SELECTOR).length > 1) return false;
    if (!hasFullPageText(getTranslatableText(element))) return false;
    return Array.from(element.children).every(child => inlineSet.has(child.tagName.toLowerCase())
        || child.matches('button, summary'));
}
