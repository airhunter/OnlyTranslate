import { DIRECT_TEXT_TARGET_ATTR, getTranslatableTextWithProtectedInline, isProtectedInlineElement } from './dom';
import { isFullPageExcludedText } from './translationTarget/fullPage';

interface StyleChange {
    element: HTMLElement;
    property: string;
    original: string;
    priority: string;
    applied: string;
    originalAttribute: string | null;
    owners: Set<HTMLElement>;
}
const changes = new Map<HTMLElement, StyleChange[]>();
const sharedChanges = new Map<HTMLElement, Map<string, StyleChange>>();
const originals = new Map<HTMLElement, { element: HTMLElement; parent: HTMLElement }>();
const labels = new Map<HTMLElement, HTMLElement>();
export const BILINGUAL_ORIGINAL_CLASS = 'only-translate-bilingual-original';
export const BILINGUAL_LABEL_ATTR = 'data-only-translate-bilingual-label';

export function setTranslationStyle(host: HTMLElement, element: HTMLElement, property: string, value: string): void {
    const records = changes.get(host) ?? [];
    let record = records.find(item => item.element === element && item.property === property);
    if (!record) {
        const shared = sharedChanges.get(element) ?? new Map<string, StyleChange>();
        record = shared.get(property);
        if (!record) {
            const firstChange = shared.values().next().value as StyleChange | undefined;
            const originalAttribute = firstChange ? firstChange.originalAttribute : element.getAttribute('style');
            record = { element, property, original: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), applied: value,
                originalAttribute, owners: new Set() };
            shared.set(property, record);
            sharedChanges.set(element, shared);
        }
        record.owners.add(host);
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
            && node.textContent?.trim() === node.querySelector('a')?.textContent?.trim())
        || isShortInlineText(node);
}

export function resolveBilingualControlTarget(node: HTMLElement): HTMLElement {
    let current = node;
    // 外层可能只是定位容器。整段原文只属于一个内部控件时，译文也必须属于该控件。
    // 这与短文案阈值无关；多段文字、显式换行和受保护内容不跨越边界。
    while (!current.matches('a, button, summary, [role="button"], [role="link"], [role^="menuitem"], [role="tab"]')) {
        if (current.querySelector(':scope > br')) return node;
        const child = getOnlyTextChild(current);
        if (!(child instanceof HTMLElement) || isProtectedInlineElement(child)) return node;
        current = child;
    }
    return current;
}

function getOnlyTextChild(node: HTMLElement): ChildNode | undefined {
    const content = Array.from(node.childNodes)
        .filter(child => getTranslatableTextWithProtectedInline(child, isFullPageExcludedText).text.trim());
    return content.length === 1 ? content[0] : undefined;
}

function isShortInlineText(node: HTMLElement): boolean {
    const text = getTranslatableTextWithProtectedInline(node, isFullPageExcludedText).text.trim();
    const style = window.getComputedStyle(node);
    if (!text || style.display === 'contents' || node.querySelector('br')) return false;
    if (/pre|break-spaces/.test(style.whiteSpace) && /[\r\n]/.test(text)) return false;
    if (node.hasAttribute(DIRECT_TEXT_TARGET_ATTR) && (node.parentElement?.querySelector(':scope > br')
        || /pre|break-spaces/.test(style.whiteSpace))) return false;
    // HTML 缩进产生的换行不等于可见换行；独立的段落/列表仍保留块级展示。
    if (node.querySelector('p, li, ul, ol, blockquote, table, section, article')) return false;
    const normalized = text.replace(/\s+/g, ' ');
    return normalized.length <= 24 && normalized.split(' ').length <= 4;
}

export function prepareCompactBilingualTarget(host: HTMLElement, appendTarget: HTMLElement): HTMLElement {
    let target = appendTarget;
    // 只沿唯一的有效文字分支向内挂载；图标不占文字分支，多个标签/计数不合并。
    while (true) {
        const child = getOnlyTextChild(target);
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
    // 原站的单行约束参与 Flex/Shadow 组件的固有宽度计算，不能被标签的通用换行样式抹掉。
    if (window.getComputedStyle(target).whiteSpace === 'nowrap') setTranslationStyle(host, target, 'white-space', 'nowrap');
    target.setAttribute(BILINGUAL_LABEL_ATTR, 'true');
    labels.set(host, target);
    return target;
}

const TEXT_FLOW_BOUNDARY = 'html, body, main, article, section, aside, nav, header, footer, form, ul, ol, table, thead, tbody, tr, dialog, [role="dialog"]';
const TEXT_FLOW_MEDIA = 'img:not([aria-hidden="true"]), picture, video, audio, iframe, canvas, input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export function prepareBilingualTextFlow(host: HTMLElement, appendTarget: HTMLElement): void {
    const source = (node: HTMLElement) => getTranslatableTextWithProtectedInline(node, isFullPageExcludedText).text.replace(/\s+/g, ' ').trim();
    const text = source(appendTarget);
    if (!text) return;
    let current: HTMLElement | null = appendTarget;
    // 只让附近的单一文字分支随双语增高，卡片其他内容和页面布局不在这条链中。
    for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
        if (current.matches(TEXT_FLOW_BOUNDARY) || current.querySelector(TEXT_FLOW_MEDIA) || source(current) !== text) break;
        const style = window.getComputedStyle(current);
        if (['none', 'contents'].includes(style.display) || ['absolute', 'fixed'].includes(style.position)
            || style.visibility === 'hidden' || ['auto', 'scroll'].includes(style.overflowY)) break;
        const height = Number.parseFloat(style.height);
        const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
        const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
        // 大型留白、整屏区域不应被当成文字行高处理。
        if (height > lineHeight * 12 + padding) break;
        if (style.display === 'inline' || !(height > 0)) continue;
        if (!(Number.parseFloat(style.minHeight) >= height)) setTranslationStyle(host, current, 'min-height', style.height);
        setTranslationStyle(host, current, 'height', 'auto');
        if (style.maxHeight && style.maxHeight !== 'none') setTranslationStyle(host, current, 'max-height', 'none');
    }
}

export function prepareBilingualCardFlow(host: HTMLElement, appendTarget: HTMLElement): void {
    const link = appendTarget.closest('a');
    if (!link) return;
    const path: HTMLElement[] = [];
    // 只处理单个链接内的局部纵向裁切卡片；不放开页面布局、滚动面板或定位叠层。
    for (let current: HTMLElement | null = appendTarget; current && current !== link && path.length < 6; current = current?.parentElement ?? null) {
        const style = window.getComputedStyle(current);
        if (current.matches(TEXT_FLOW_BOUNDARY) || current.querySelector('input, textarea, select, button, [contenteditable]:not([contenteditable="false"])')
            || ['absolute', 'fixed'].includes(style.position) || ['auto', 'scroll'].includes(style.overflowY || style.overflow)
            || ['none', 'contents'].includes(style.display) || style.visibility === 'hidden') return;
        path.push(current);
        if (!/flex/.test(style.display) || style.flexDirection !== 'column'
            || !['hidden', 'clip'].includes(style.overflowY || style.overflow) || current.children.length < 2) continue;
        // 外层仍遵循原有的等高/百分比布局，只补足内容所需的最小高度。
        setTranslationStyle(host, current, 'min-height', 'min-content');
        for (const element of path.slice(0, -1)) {
            const flow = window.getComputedStyle(element);
            const height = Number.parseFloat(flow.height);
            if (flow.display === 'inline' || !(height > 0)) continue;
            if (!(Number.parseFloat(flow.minHeight) >= height)) setTranslationStyle(host, element, 'min-height', flow.height);
            setTranslationStyle(host, element, 'height', 'auto');
            if (flow.maxHeight && flow.maxHeight !== 'none') setTranslationStyle(host, element, 'max-height', 'none');
        }
        return;
    }
}

export function prepareBilingualClipping(host: HTMLElement, insertion: HTMLElement, translation: HTMLElement, owner: HTMLElement = host): boolean {
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
    originals.set(owner, { element: source, parent: host });
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
            setTranslationStyle(owner, current, property, value);
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
    const records = (changes.get(host) ?? []).filter(record => {
        record.owners.delete(host);
        if (record.owners.size) return false;
        const shared = sharedChanges.get(record.element);
        shared?.delete(record.property);
        if (!shared?.size) sharedChanges.delete(record.element);
        return true;
    });
    for (const element of new Set(records.map(record => record.element))) {
        restoreRecordedStyles(element, records.filter(record => record.element === element));
    }
    changes.delete(host);
}

function restoreRecordedStyles(element: HTMLElement, records: StyleChange[]): void {
    const originalAttribute = records[0].originalAttribute;
    const expected = element.ownerDocument.createElement('span');
    if (originalAttribute !== null) expected.setAttribute('style', originalAttribute);
    records.forEach(record => expected.style.setProperty(record.property, record.applied, 'important'));
    // 没有网站后续样式更新时，恢复原属性字符串，避免格式变化被误判成源 DOM 更新。
    if (element.style.cssText === expected.style.cssText) {
        if (originalAttribute === null) {
            element.style.cssText = '';
            // 先同步 CSSOM 的惰性属性更新，避免序列化时重新出现空 style。
            if (element.hasAttribute('style')) element.removeAttribute('style');
        }
        else element.setAttribute('style', originalAttribute);
        return;
    }
    for (const record of records) {
        if (element.style.getPropertyValue(record.property) !== record.applied
            || element.style.getPropertyPriority(record.property) !== 'important') continue;
        if (record.original) element.style.setProperty(record.property, record.original, record.priority);
        else element.style.removeProperty(record.property);
    }
    if (originalAttribute === null && !element.style.cssText && element.hasAttribute('style')) element.removeAttribute('style');
}

export function normalizeBilingualSourceStyles(host: HTMLElement, clone: HTMLElement): void {
    const records = changes.get(host) ?? [];
    for (const element of new Set(records.map(record => record.element))) {
        if (!host.contains(element)) continue;
        const path: number[] = [];
        let current: Node = element;
        while (current !== host && current.parentNode) {
            path.unshift(Array.from(current.parentNode.childNodes).indexOf(current as ChildNode));
            current = current.parentNode;
        }
        let cloned: Node = clone;
        for (const index of path) cloned = cloned.childNodes[index];
        if (cloned instanceof HTMLElement) restoreRecordedStyles(cloned, records.filter(record => record.element === element));
    }
}

export function restoreAllBilingualLayouts(): void {
    new Set([...originals.keys(), ...changes.keys(), ...labels.keys()]).forEach(restoreBilingualLayout);
}
