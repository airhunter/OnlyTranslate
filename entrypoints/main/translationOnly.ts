import {
    buildProtectedInlinePlaceholder,
    isExcludedFromTranslatableText,
    isProtectedInlineElement,
} from '@/entrypoints/main/dom';

interface TextPart {
    node: Text;
    original: string;
    ancestors: Node[];
}

interface ProtectedPart {
    placeholder: string;
}

type TranslationPart = TextPart | ProtectedPart;

export interface PreparedTranslationOnly {
    host: HTMLElement;
    text: string;
    parts: TranslationPart[];
    separators: string[];
    separatorPadding: ' ' | '\n';
    snapshot: Node;
    positions: { node: Node; parent: Node; nextSibling: Node | null }[];
}

interface TranslationOnlyRecord {
    texts: (TextPart & { translated: string })[];
}

export type TranslationOnlyRestoreResult = 'missing' | 'restored' | 'discarded';

const translationOnlyRecords = new Map<HTMLElement, TranslationOnlyRecord>();
const markerPattern = /__ONLY_TRANSLATE_(?:SLOT_\d+|INLINE_\d+_[a-z0-9]+)__/g;
const interactiveSelector = [
    'a', 'button', 'summary', '[tabindex]', '[onclick]', '[onkeydown]',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
    '[role="switch"]', '[role^="menuitem"]', '[role="tab"]',
].join(', ');
const protectedSelector = [
    'script', 'style', 'noscript', 'template', 'iframe',
    'input', 'textarea', 'select', 'option',
    '[contenteditable]:not([contenteditable="false"])',
    '[translate="no"]', '.notranslate',
    '[hidden]', '[aria-hidden="true"]',
    '.only-translate-bilingual-content', '.only-translate-loading',
    '.only-translate-retry-wrapper',
].join(', ');

export function hasTranslationOnlyRecord(host: HTMLElement): boolean {
    return translationOnlyRecords.has(host);
}

export function hasTranslationOnlySourceChanged(host: HTMLElement): boolean {
    const record = translationOnlyRecords.get(host);
    return Boolean(record?.texts.some(part => part.node.data !== part.translated || !isTextInOriginalPosition(host, part)));
}

export function isPreparedTranslationOnlyCurrent(prepared: PreparedTranslationOnly): boolean {
    return prepared.host.isEqualNode(prepared.snapshot)
        && prepared.positions.every(({ node, parent, nextSibling }) => node.parentNode === parent && node.nextSibling === nextSibling);
}

function formatTranslationOnlyText(parts: TranslationPart[], separators: string[], padding: ' ' | '\n'): string {
    return parts.map((part, index) => `${index ? `${padding}${separators[index - 1]}${padding}` : ''}${'original' in part ? part.original : part.placeholder}`).join('');
}

export function withTranslationOnlyLineSeparators(prepared: PreparedTranslationOnly): PreparedTranslationOnly {
    return {
        ...prepared,
        separatorPadding: '\n',
        text: prepared.text ? formatTranslationOnlyText(prepared.parts, prepared.separators, '\n') : '',
    };
}

export function prepareTranslationOnly(host: HTMLElement): PreparedTranslationOnly {
    const parts: TranslationPart[] = [];
    const positions: PreparedTranslationOnly['positions'] = [];
    const collect = (node: Node, ancestors: Node[]): void => {
        node.childNodes.forEach(child => {
            positions.push({ node: child, parent: node, nextSibling: child.nextSibling });
        });
        if (node instanceof Text) {
            if (node.data) parts.push({ node, original: node.data, ancestors });
            return;
        }
        if (!(node instanceof Element)) return;
        if (node.matches(protectedSelector) || isExcludedFromTranslatableText(node) || isProtectedInlineElement(node)) {
            parts.push({ placeholder: buildProtectedInlinePlaceholder(node, parts.length) });
            return;
        }
        node.childNodes.forEach(child => collect(child, [node, ...ancestors]));
    };
    collect(host, []);

    const separators = parts.slice(1).map((_, index) => `__ONLY_TRANSLATE_SLOT_${index}__`);
    // 不让网页原文中的标记冒充我们生成的结构边界。
    const hasSourceMarkers = parts.some(part => 'original' in part && /__ONLY_TRANSLATE_/.test(part.original));
    const hasText = parts.some(part => 'original' in part && part.original.trim());
    const text = !hasSourceMarkers && hasText
        ? formatTranslationOnlyText(parts, separators, ' ')
        : '';
    return { host, text, parts, separators, separatorPadding: ' ', snapshot: host.cloneNode(true), positions };
}

function isTextInOriginalPosition(host: HTMLElement, part: TextPart): boolean {
    let current: Node = part.node;
    for (const ancestor of part.ancestors) {
        if (current.parentNode !== ancestor) return false;
        current = ancestor;
    }
    return current === host;
}

export function applyTranslationOnly(prepared: PreparedTranslationOnly, translated: string): boolean {
    const { host, text, parts, separators } = prepared;
    if (!text || !translated.trim() || translationOnlyRecords.has(host)) return false;
    if (!isPreparedTranslationOnlyCurrent(prepared)) return false;

    // 返回的标记必须各出现一次且顺序不变，才能原位更新对应文字。
    const expectedMarkers = text.match(markerPattern) ?? [];
    const actualMarkers = translated.match(markerPattern) ?? [];
    if (actualMarkers.length !== expectedMarkers.length
        || expectedMarkers.some((marker, index) => marker !== actualMarkers[index])) return false;

    const values: string[] = [];
    let cursor = 0;
    for (const separator of separators) {
        const index = translated.indexOf(separator, cursor);
        if (index < 0) return false;
        values.push(translated.slice(cursor, index));
        cursor = index + separator.length;
    }
    values.push(translated.slice(cursor));

    const texts: TranslationOnlyRecord['texts'] = [];
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index]!;
        // 分行重试时只去掉协议添加的一次换行，保留文字自身的空白。
        // 连续句子的空格由服务决定，不能误删英语译文中的词间空格。
        let value = values[index]!;
        if (prepared.separatorPadding === '\n') {
            if (index > 0) value = value.replace(/^\r?\n/, '');
            if (index < parts.length - 1) value = value.replace(/\r?\n$/, '');
        }
        if ('placeholder' in part) {
            if (value.trim() !== part.placeholder) return false;
        } else {
            if (value.includes('__ONLY_TRANSLATE_')) return false;
            texts.push({ ...part, translated: value });
        }
    }

    if (!texts.some(part => part.translated.trim())) return false;

    // 语序调整可以使普通片段为空，但不能清空链接/按钮的整体可见标签。
    const translatedValues = new Map(texts.map(part => [part.node, part.translated]));
    const interactiveElements = Array.from(host.querySelectorAll(interactiveSelector));
    if (host.matches(interactiveSelector)) interactiveElements.unshift(host);
    for (const element of interactiveElements) {
        if (!element.textContent?.trim()) continue;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let label = '';
        let textNode: Node | null;
        while (textNode = walker.nextNode()) {
            label += translatedValues.get(textNode as Text) ?? textNode.nodeValue ?? '';
        }
        if (!label.trim()) return false;
    }
    if (!texts.some(part => part.original !== part.translated)) return true;

    // 校验全部完成后才写入；保留 a/button、Text、格式和受保护节点的身份与事件。
    texts.forEach(part => { part.node.data = part.translated; });
    translationOnlyRecords.set(host, { texts });
    return true;
}

export function restoreTranslationOnly(host: HTMLElement): TranslationOnlyRestoreResult {
    const record = translationOnlyRecords.get(host);
    if (!record) return 'missing';
    translationOnlyRecords.delete(host);

    let restored = false;
    record.texts.forEach(part => {
        // 网站更新或复用过的文字不回滚；仍由扩展持有的其他文字可以独立恢复。
        if (part.node.data !== part.translated || !isTextInOriginalPosition(host, part)) return;
        part.node.data = part.original;
        restored = true;
    });
    return restored ? 'restored' : 'discarded';
}

export function restoreAllTranslationOnly(): HTMLElement[] {
    const hosts = Array.from(translationOnlyRecords.keys());
    hosts.forEach(host => restoreTranslationOnly(host));
    return hosts;
}
