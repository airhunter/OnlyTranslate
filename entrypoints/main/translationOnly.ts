export const TRANSLATION_ONLY_BACKUP_CLASS = 'only-translate-original-backup';

interface TranslationOnlyRecord {
    host: HTMLElement;
    appendTarget: HTMLElement;
    insertionNode: HTMLElement;
    anchor: Comment;
    backup: HTMLTemplateElement;
    originalNodes: Node[];
}

export interface PreparedTranslationOnly {
    host: HTMLElement;
    appendTarget: HTMLElement;
    originalNodes: Node[];
    originalSnapshots: Node[];
}

export type TranslationOnlyRestoreResult = 'missing' | 'restored' | 'discarded';

const translationOnlyRecords = new Map<HTMLElement, TranslationOnlyRecord>();

export function hasTranslationOnlyRecord(host: HTMLElement): boolean {
    return translationOnlyRecords.has(host);
}

export function prepareTranslationOnly(
    host: HTMLElement,
    appendTarget: HTMLElement,
): PreparedTranslationOnly {
    return {
        host,
        appendTarget,
        originalNodes: Array.from(appendTarget.childNodes),
        originalSnapshots: Array.from(appendTarget.childNodes, node => node.cloneNode(true)),
    };
}

export function hideOriginalForTranslationOnly(
    prepared: PreparedTranslationOnly,
    insertionNode: HTMLElement,
): boolean {
    const { host, appendTarget, originalNodes, originalSnapshots } = prepared;
    if (translationOnlyRecords.has(host) || !originalNodes.length) return false;
    const currentNodes = Array.from(appendTarget.childNodes)
        .filter(node => node !== insertionNode);
    if (
        currentNodes.length !== originalNodes.length
        || originalNodes.some((node, index) => (
            node.parentNode !== appendTarget
            || currentNodes[index] !== node
            || !node.isEqualNode(originalSnapshots[index]!)
        ))
    ) {
        return false;
    }

    const anchor = document.createComment('only-translate-original');
    const backup = document.createElement('template');
    backup.className = TRANSLATION_ONLY_BACKUP_CLASS;

    appendTarget.insertBefore(anchor, originalNodes[0]!);
    originalNodes.forEach(node => backup.content.appendChild(node));
    insertionNode.appendChild(backup);

    translationOnlyRecords.set(host, {
        host,
        appendTarget,
        insertionNode,
        anchor,
        backup,
        originalNodes,
    });
    return true;
}

export function restoreTranslationOnly(host: HTMLElement): TranslationOnlyRestoreResult {
    const record = translationOnlyRecords.get(host);
    if (!record) return 'missing';

    translationOnlyRecords.delete(host);
    const canRestore = record.anchor.parentNode === record.appendTarget
        && record.originalNodes.every(node => node.parentNode === record.backup.content);

    if (canRestore) {
        const original = document.createDocumentFragment();
        record.originalNodes.forEach(node => original.appendChild(node));
        record.anchor.replaceWith(original);
    } else {
        record.anchor.remove();
    }

    record.insertionNode.remove();
    return canRestore ? 'restored' : 'discarded';
}

export function restoreAllTranslationOnly(): HTMLElement[] {
    const hosts = Array.from(translationOnlyRecords.keys());
    hosts.forEach(host => restoreTranslationOnly(host));
    return hosts;
}
