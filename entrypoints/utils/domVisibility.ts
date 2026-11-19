import { getComposedParentElement } from '@/entrypoints/main/translationTarget/composedTree';

export function isElementVisible(element: Element, ariaHiddenException?: Element | null): boolean {
    let current: Element | null = element;

    while (current) {
        if (isSelfHidden(current, current !== ariaHiddenException)) return false;
        current = getComposedParentElement(current);
    }

    return true;
}

export function isElementSelfHidden(element: Element): boolean {
    return isSelfHidden(element, true);
}

function isSelfHidden(element: Element, checkAria: boolean): boolean {
    if (element.hasAttribute('hidden') || (checkAria && element.getAttribute('aria-hidden') === 'true')) return true;
    try {
        const style = window.getComputedStyle(element);
        return style.display === 'none'
            || style.visibility === 'hidden'
            || style.visibility === 'collapse';
    } catch (_) {
        return false;
    }
}
