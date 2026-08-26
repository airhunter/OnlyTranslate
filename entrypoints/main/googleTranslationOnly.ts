const ROOT_MARKER_ATTRIBUTE = 'data-onlytranslate-google-root';
const SLOT_MARKER_ATTRIBUTE = 'data-onlytranslate-google-slot';
const PROTECTED_CONTENT_SELECTOR = [
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'code',
    'pre',
    'kbd',
    'samp',
    'var',
    'math',
    'mjx-container',
    'svg',
].join(', ');

interface SourceSnapshotEntry {
    node: Text;
    parent: Node | null;
    value: string;
}

interface TextSwapPair {
    node: Text;
    originalValue: string;
    translatedValue: string;
}

interface TranslationOnlyRecord {
    pairs: TextSwapPair[];
}

export interface PreparedGoogleTranslationOnlyHtml {
    html: string;
    root: HTMLElement;
    slots: WeakMap<Element, string>;
    protectedElements: WeakSet<Element>;
    snapshot: SourceSnapshotEntry[];
}

interface AlignmentState {
    pairs: TextSwapPair[];
    lastPair: TextSwapPair | null;
}

type LevelItem = Element | Text[];

const translationOnlyRecords = new WeakMap<HTMLElement, TranslationOnlyRecord>();

function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
}

function isText(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
}

function isProtectedElement(element: Element): boolean {
    try {
        return element.matches(PROTECTED_CONTENT_SELECTOR);
    } catch {
        return false;
    }
}

function pairSourceAndCloneElements(
    source: ParentNode,
    clone: ParentNode,
    slots: WeakMap<Element, string>,
    protectedElements: WeakSet<Element>,
    nextSlot: { value: number },
    inheritedProtection = false,
): void {
    const sourceChildren = Array.from(source.childNodes);
    const cloneChildren = Array.from(clone.childNodes);
    if (sourceChildren.length !== cloneChildren.length) {
        throw new Error('Failed to prepare Google translation HTML');
    }

    for (let index = 0; index < sourceChildren.length; index++) {
        const sourceChild = sourceChildren[index]!;
        const cloneChild = cloneChildren[index]!;
        if (!isElement(sourceChild) || !isElement(cloneChild)) continue;

        const slot = String(nextSlot.value++);
        const protectedContent = inheritedProtection || isProtectedElement(sourceChild);
        slots.set(sourceChild, slot);
        if (protectedContent) protectedElements.add(sourceChild);

        Array.from(cloneChild.attributes).forEach(attribute => {
            cloneChild.removeAttributeNode(attribute);
        });
        cloneChild.setAttribute(SLOT_MARKER_ATTRIBUTE, slot);
        if (protectedContent) cloneChild.setAttribute('translate', 'no');

        pairSourceAndCloneElements(
            sourceChild,
            cloneChild,
            slots,
            protectedElements,
            nextSlot,
            protectedContent,
        );
    }
}

function collectSnapshot(
    parent: ParentNode,
    protectedElements: WeakSet<Element>,
    result: SourceSnapshotEntry[],
): void {
    for (const child of parent.childNodes) {
        if (isText(child)) {
            result.push({ node: child, parent: child.parentNode, value: child.data });
            continue;
        }
        if (!isElement(child) || protectedElements.has(child)) continue;
        collectSnapshot(child, protectedElements, result);
    }
}

function collectCurrentTextNodes(
    parent: ParentNode,
    protectedElements: WeakSet<Element>,
    result: Text[],
): void {
    for (const child of parent.childNodes) {
        if (isText(child)) {
            result.push(child);
            continue;
        }
        if (!isElement(child) || protectedElements.has(child)) continue;
        collectCurrentTextNodes(child, protectedElements, result);
    }
}

function verifySnapshot(prepared: PreparedGoogleTranslationOnlyHtml): boolean {
    if (!prepared.root.isConnected) return false;

    const current: Text[] = [];
    collectCurrentTextNodes(prepared.root, prepared.protectedElements, current);
    if (current.length !== prepared.snapshot.length) return false;

    return prepared.snapshot.every((entry, index) => (
        current[index] === entry.node
        && entry.node.parentNode === entry.parent
        && entry.node.data === entry.value
    ));
}

function partitionLevel(nodes: readonly Node[]): LevelItem[] {
    const sequence: LevelItem[] = [];
    let gap: Text[] = [];

    for (const node of nodes) {
        if (isElement(node)) {
            sequence.push(gap);
            gap = [];
            sequence.push(node);
        } else if (isText(node)) {
            gap.push(node);
        }
    }

    sequence.push(gap);
    return sequence;
}

function alignTextGap(sourceGap: Text[], targetGap: Text[], state: AlignmentState): boolean {
    const sourceTextNodes = sourceGap.filter(node => node.data.trim().length > 0);
    const translatedValue = targetGap.map(node => node.data).join('');

    if (!sourceTextNodes.length) {
        if (translatedValue.trim()) return false;
        if (translatedValue && state.lastPair && !/\s$/.test(state.lastPair.translatedValue)) {
            state.lastPair.translatedValue += ' ';
        }
        return true;
    }

    if (!translatedValue.trim()) return false;

    const firstPair: TextSwapPair = {
        node: sourceTextNodes[0]!,
        originalValue: sourceTextNodes[0]!.data,
        translatedValue,
    };
    state.pairs.push(firstPair);
    state.lastPair = firstPair;

    for (const sourceNode of sourceTextNodes.slice(1)) {
        state.pairs.push({
            node: sourceNode,
            originalValue: sourceNode.data,
            translatedValue: '',
        });
    }

    return true;
}

function alignLevel(
    source: ParentNode,
    target: ParentNode,
    prepared: PreparedGoogleTranslationOnlyHtml,
    state: AlignmentState,
): boolean {
    const sourceSequence = partitionLevel(Array.from(source.childNodes));
    const targetSequence = partitionLevel(Array.from(target.childNodes));
    if (sourceSequence.length !== targetSequence.length) return false;

    for (let index = 0; index < sourceSequence.length; index++) {
        const sourceItem = sourceSequence[index]!;
        const targetItem = targetSequence[index]!;

        if (Array.isArray(sourceItem)) {
            if (!Array.isArray(targetItem) || !alignTextGap(sourceItem, targetItem, state)) {
                return false;
            }
            continue;
        }

        if (Array.isArray(targetItem)) return false;
        if (sourceItem.localName !== targetItem.localName) return false;
        if (targetItem.getAttribute(SLOT_MARKER_ATTRIBUTE) !== prepared.slots.get(sourceItem)) {
            return false;
        }
        if (prepared.protectedElements.has(sourceItem)) continue;
        if (!alignLevel(sourceItem, targetItem, prepared, state)) return false;
    }

    return true;
}

export function prepareGoogleTranslationOnlyHtml(
    root: HTMLElement,
): PreparedGoogleTranslationOnlyHtml {
    const wrapper = document.createElement('span');
    wrapper.setAttribute(ROOT_MARKER_ATTRIBUTE, '1');
    const clone = root.cloneNode(true) as HTMLElement;
    wrapper.append(...Array.from(clone.childNodes));

    const slots = new WeakMap<Element, string>();
    const protectedElements = new WeakSet<Element>();
    pairSourceAndCloneElements(root, wrapper, slots, protectedElements, { value: 0 });

    const snapshot: SourceSnapshotEntry[] = [];
    collectSnapshot(root, protectedElements, snapshot);

    return {
        html: wrapper.outerHTML,
        root,
        slots,
        protectedElements,
        snapshot,
    };
}

export function applyGoogleTranslationOnlyHtml(
    prepared: PreparedGoogleTranslationOnlyHtml,
    translatedHtml: string,
): boolean {
    if (!verifySnapshot(prepared)) return false;

    const template = document.createElement('template');
    template.innerHTML = translatedHtml;
    const roots = Array.from(template.content.children).filter(element => (
        element.getAttribute(ROOT_MARKER_ATTRIBUTE) === '1'
    ));
    if (roots.length !== 1 || template.content.children.length !== 1) return false;

    const state: AlignmentState = { pairs: [], lastPair: null };
    if (!alignLevel(prepared.root, roots[0]!, prepared, state)) return false;
    if (!state.pairs.length || !verifySnapshot(prepared)) return false;

    const changedPairs = state.pairs.filter(pair => pair.originalValue !== pair.translatedValue);
    if (!changedPairs.length) return false;

    changedPairs.forEach(pair => {
        pair.node.data = pair.translatedValue;
    });
    translationOnlyRecords.set(prepared.root, { pairs: changedPairs });
    return true;
}

export function restoreGoogleTranslationOnly(root: HTMLElement): boolean {
    const record = translationOnlyRecords.get(root);
    if (!record) return false;

    record.pairs.forEach(pair => {
        if (pair.node.isConnected && pair.node.data === pair.translatedValue) {
            pair.node.data = pair.originalValue;
        }
    });
    translationOnlyRecords.delete(root);
    return true;
}
