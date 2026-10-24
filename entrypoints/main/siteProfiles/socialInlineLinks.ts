import type { InlineLinkPolicy } from './types';

export function classifySocialInlineLink(node: Element): InlineLinkPolicy | false {
    if (!node.matches('a[href]')) return false;
    let url: URL;
    try {
        url = new URL(node.getAttribute('href')!, location.href);
    } catch {
        return false;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const text = node.textContent?.trim() ?? '';
    if (!text) return false;
    // Account/topic identifiers and visible URLs keep their original labels.
    // Descriptive link labels remain part of the translated sentence.
    return /^[@#]\S+$/u.test(text)
        || /^(?:https?:\/\/|www\.)\S+$/i.test(text)
        || /^[^\s/]+\.[a-z]{2,}(?:[/:?#][^\s]*)?[.…]*$/i.test(text)
        ? 'preserve' : 'translate';
}
