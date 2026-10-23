import { getTranslatableTextWithProtectedInline, isProtectedInlineElement } from './dom';
import { isFullPageExcludedText } from './translationTarget/fullPage';

interface StyleChange {
    element: HTMLElement;
    property: string;
    original: string;
    priority: string;
    applied: string;
}
const changes = new Map<HTMLElement, StyleChange[]>();
const originals = new Map<HTMLElement, { element: HTMLElement; parent: HTMLElement }>();
const labels = new Map<HTMLElement, HTMLElement>();
export const BILINGUAL_ORIGINAL_CLASS = 'only-translate-bilingual-original';
export const BILINGUAL_LABEL_ATTR = 'data-only-translate-bilingual-label';

export function setTranslationStyle(host: HTMLElement, element: HTMLElement, property: string, value: string): void {
    const records = changes.get(host) ?? [];
    let record = records.find(item => item.element === element && item.property === property);
    if (!record) {
        record = { element, property, original: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), applied: value };
        records.push(record);
        changes.set(host, records);
    }
    element.style.setProperty(property, value, 'important');
    record.applied = element.style.getPropertyValue(property);
}

export function isCompactTranslationTarget(node: HTMLElement): boolean {
    return node.matches('a, button, summary, label, legend, th, td, [role="button"], [role^="menuitem"], [role="tab"], [role="link"]')
        || Boolean(node.closest('button, summary, nav, [role="navigation"], [role="menu"], [role="toolbar"], [role="tablist"]'))
        || (node.hasAttribute('data-fr-direct-text-target') && node.querySelectorAll('a').length === 1
            && node.textContent?.trim() === node.querySelector('a')?.textContent?.trim());
}

export function prepareCompactBilingualTarget(host: HTMLElement, appendTarget: HTMLElement): HTMLElement {
    let target = appendTarget;
    // 只沿唯一的有效文字分支向内挂载；图标不占文字分支，多个标签/计数不合并。
    while (true) {
        const content = Array.from(target.childNodes)
            .filter(node => getTranslatableTextWithProtectedInline(node, isFullPageExcludedText).text.trim());
        if (content.length !== 1) break;
        const child = content[0];
        if (child instanceof HTMLElement && !isProtectedInlineElement(child)) {
            target = child;
            continue;
        }
        // Flex/Grid 中的直接文字原本是匿名布局项，让原文和译文共用同一个项。
        if (child instanceof Text && /flex|grid/.test(window.getComputedStyle(target).display)) {
            const wrapper = target.ownerDocument.createElement('span');
            wrapper.className = BILINGUAL_ORIGINAL_CLASS;
            const next = child.nextSibling;
            // 在脱离文档时填充，避免观察器把新容器内部的文字挂载当作网站更新。
            wrapper.appendChild(child);
            target.insertBefore(wrapper, next);
            originals.set(host, { element: wrapper, parent: target });
            target = wrapper;
        }
        break;
    }
    target.setAttribute(BILINGUAL_LABEL_ATTR, 'true');
    labels.set(host, target);
    return target;
}

export function prepareBilingualClipping(host: HTMLElement, insertion: HTMLElement, translation: HTMLElement): boolean {
    let clip: HTMLElement | null = host;
    let lines = 0;
    for (let depth = 0; clip && depth < 4; depth++) {
        const style = window.getComputedStyle(clip);
        const clamp = Number.parseInt(style.webkitLineClamp || style.getPropertyValue('-webkit-line-clamp'), 10);
        if (clamp > 0 && clamp <= 12) { lines = clamp; break; }
        const limit = Number.parseFloat(style.maxHeight);
        const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
        if (['hidden', 'clip'].includes(style.overflowY || style.overflow) && limit > 0 && lineHeight > 0) {
            const count = Math.floor(limit / lineHeight);
            if (count > 0 && count <= 12) { lines = count; break; }
        }
        const parent: HTMLElement | null = clip.parentElement;
        if (!parent || parent.matches('body, main, article') || parent.children.length !== 1
            || Array.from(parent.childNodes).some(node => node instanceof Text && Boolean(node.data.trim()))) break;
        clip = parent;
    }
    if (!lines || !clip) return false;

    // 只处理实际限制该段文字的截断链，原文和译文各保留原来的行数。
    const source = host.ownerDocument.createElement('span');
    source.className = BILINGUAL_ORIGINAL_CLASS;
    while (host.firstChild) source.appendChild(host.firstChild);
    host.appendChild(source);
    originals.set(host, { element: source, parent: host });
    for (const block of [source, insertion]) {
        block.style.setProperty('display', '-webkit-box', 'important');
        block.style.setProperty('-webkit-line-clamp', String(lines), 'important');
        block.style.setProperty('-webkit-box-orient', 'vertical', 'important');
        block.style.setProperty('overflow', 'hidden', 'important');
    }
    translation.style.setProperty('display', 'inline', 'important');
    let current: HTMLElement | null = host;
    while (current) {
        for (const [property, value] of Object.entries({ display: 'block', '-webkit-line-clamp': 'unset', 'max-height': 'none', height: 'auto' })) {
            setTranslationStyle(host, current, property, value);
        }
        if (current === clip) break;
        current = current.parentElement;
    }
    return true;
}

export function isOriginalWrappingMutation(mutation: MutationRecord): boolean {
    if (mutation.type !== 'childList') return false;
    const added = Array.from(mutation.addedNodes);
    const removed = Array.from(mutation.removedNodes);
    return (added.length > 0 || removed.length > 0)
        && added.every(node => node instanceof Element && node.classList.contains(BILINGUAL_ORIGINAL_CLASS))
        && removed.every(node => node.parentElement?.classList.contains(BILINGUAL_ORIGINAL_CLASS)
            && node.parentElement.parentNode === mutation.target);
}

export function restoreBilingualLayout(host: HTMLElement): void {
    const label = labels.get(host);
    if (label?.getAttribute(BILINGUAL_LABEL_ATTR) === 'true') label.removeAttribute(BILINGUAL_LABEL_ATTR);
    labels.delete(host);
    const original = originals.get(host);
    if (original && original.element.parentElement === original.parent && host.contains(original.parent)) {
        const { element: source, parent } = original;
        while (source.firstChild) parent.insertBefore(source.firstChild, source);
        source.remove();
    }
    originals.delete(host);
    for (const record of changes.get(host) ?? []) {
        if (record.element.style.getPropertyValue(record.property) !== record.applied
            || record.element.style.getPropertyPriority(record.property) !== 'important') continue;
        if (record.original) record.element.style.setProperty(record.property, record.original, record.priority);
        else record.element.style.removeProperty(record.property);
    }
    changes.delete(host);
}

export function restoreAllBilingualLayouts(): void {
    new Set([...originals.keys(), ...changes.keys(), ...labels.keys()]).forEach(restoreBilingualLayout);
}
