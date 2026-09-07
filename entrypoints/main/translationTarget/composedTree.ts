import { BILINGUAL_CONTENT_CLASS, TRANSLATED_ATTR } from './constants';

const MANAGED_SELECTOR = [
    `.${BILINGUAL_CONTENT_CLASS}`,
    `[${TRANSLATED_ATTR}="true"]`,
    '[data-only-translate-shadow-style="true"]'
].join(', ');

export function getComposedParentElement(node: Node | null): Element | null {
    if (!node) return null;
    if (node instanceof Element) {
        const assignedSlot = getAssignedSlot(node);
        if (assignedSlot) return assignedSlot;
    }
    if (node.parentElement) {
        if (node instanceof Element && node.parentElement.shadowRoot && !getAssignedSlot(node)) return null;
        return node.parentElement;
    }

    const root = node.getRootNode?.();
    return root instanceof ShadowRoot ? root.host : null;
}

export function isUnassignedLightDomSubtree(element: Element): boolean {
    let current: Element | null = element;
    while (current?.parentElement) {
        if (current.parentElement.shadowRoot) return !getAssignedSlot(current);
        current = current.parentElement;
    }
    return false;
}

function getAssignedSlot(element: Element): HTMLSlotElement | null {
    if (element.assignedSlot) return element.assignedSlot;
    const shadowRoot = element.parentElement?.shadowRoot;
    if (!shadowRoot) return null;
    const slotName = element.getAttribute('slot') ?? '';
    return Array.from(shadowRoot.querySelectorAll<HTMLSlotElement>('slot'))
        .find(slot => (slot.getAttribute('name') ?? '') === slotName) ?? null;
}

export function composedContains(ancestor: Element, node: Node): boolean {
    let current: Node | null = node;
    while (current) {
        if (current === ancestor) return true;
        current = getComposedParentElement(current);
    }
    return false;
}

export function composedClosest(element: Element, selector: string): Element | null {
    if (element.getRootNode() === document && !element.assignedSlot) {
        return element.closest(selector);
    }
    let current: Element | null = element;
    while (current) {
        if (current.matches(selector)) return current;
        current = getComposedParentElement(current);
    }
    return null;
}

export function isManagedComposedSubtree(element: Element): boolean {
    return composedClosest(element, MANAGED_SELECTOR) !== null;
}

export function isInactiveSlotFallback(element: Element): boolean {
    const slot = element instanceof HTMLSlotElement
        ? element
        : element.closest('slot');
    if (!slot) return false;
    if (slot.assignedNodes({ flatten: true }).length > 0) return true;
    const root = slot.getRootNode();
    if (!(root instanceof ShadowRoot)) return false;
    const name = slot.getAttribute('name') ?? '';
    return Array.from(root.host.childNodes).some(node => (
        node instanceof Element
            ? (node.getAttribute('slot') ?? '') === name
            : name === '' && Boolean(node.textContent?.trim())
    ));
}

export function discoverOpenShadowRoots(
    root: ParentNode,
    registry: Set<ShadowRoot> = new Set()
): Set<ShadowRoot> {
    const pending: ParentNode[] = [root];
    const visited = new Set<ParentNode>();

    while (pending.length > 0) {
        const currentRoot = pending.shift()!;
        if (visited.has(currentRoot)) continue;
        visited.add(currentRoot);

        const elements = currentRoot instanceof Element
            ? [currentRoot, ...Array.from(currentRoot.querySelectorAll<Element>('*'))]
            : Array.from(currentRoot.querySelectorAll<Element>('*'));

        for (const element of elements) {
            if (isManagedComposedSubtree(element)) continue;
            const shadowRoot = element.shadowRoot;
            if (!shadowRoot || registry.has(shadowRoot)) continue;
            registry.add(shadowRoot);
            pending.push(shadowRoot);
        }
    }

    return registry;
}

export async function discoverOpenShadowRootsAsync(
    root: ParentNode,
    registry: Set<ShadowRoot> = new Set(),
    signal?: AbortSignal
): Promise<Set<ShadowRoot>> {
    const pending: ParentNode[] = [root];
    const visited = new Set<ParentNode>();
    let sliceStarted = performance.now();
    let sliceElements = 0;

    while (pending.length > 0) {
        if (signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
        const currentRoot = pending.shift()!;
        if (visited.has(currentRoot)) continue;
        visited.add(currentRoot);

        const walker = document.createTreeWalker(currentRoot, NodeFilter.SHOW_ELEMENT);
        let current = currentRoot instanceof Element ? currentRoot : walker.nextNode();
        while (current) {
            const element = current as Element;
            if (!isManagedComposedSubtree(element)) {
                const shadowRoot = element.shadowRoot;
                if (shadowRoot && !registry.has(shadowRoot)) {
                    registry.add(shadowRoot);
                    pending.push(shadowRoot);
                }
            }

            sliceElements += 1;
            if (sliceElements >= 400 || performance.now() - sliceStarted >= 4) {
                await new Promise<void>(resolve => setTimeout(resolve, 0));
                if (signal?.aborted) throw new DOMException('Target collection cancelled', 'AbortError');
                sliceStarted = performance.now();
                sliceElements = 0;
            }
            current = walker.nextNode();
        }
    }

    return registry;
}

export function getRegisteredQueryRoots(registry?: Set<ShadowRoot>): ParentNode[] {
    return [document, ...Array.from(registry ?? []).filter(root => root.host.isConnected)];
}

export function querySelectorAllComposed<T extends Element>(
    selector: string,
    registry?: Set<ShadowRoot>
): T[] {
    const result = new Set<T>();
    for (const root of getRegisteredQueryRoots(registry)) {
        root.querySelectorAll<T>(selector).forEach(element => result.add(element));
    }
    return Array.from(result);
}
