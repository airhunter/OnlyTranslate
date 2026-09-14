import { BILINGUAL_CONTENT_CLASS } from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

export const maxwellForbesProfile: SiteProfile = {
    id: 'maxwell-forbes',
    domains: ['maxwellforbes.com'],
    keepSelector: 'sup.footnote-ref',
    excludeFromText: isGeneratedSidenote,
    expandTarget: (node) => {
        const sidenoteTargets = Array.from(node.querySelectorAll<Element>('sup.footnote-ref + span'))
            .map(findGeneratedSidenoteTextTarget)
            .filter((target): target is Element => Boolean(target));

        return sidenoteTargets.length > 0 ? sidenoteTargets : false;
    },
    allowTarget: (node) => {
        if (!isGeneratedSidenoteTextTarget(node)) return false;

        return {
            target: node,
            role: 'paragraph',
            reason: 'maxwell-forbes-generated-sidenote'
        };
    }
};

function isGeneratedSidenote(node: Element): boolean {
    const footnote = getReferencedFootnote(node);
    if (!footnote) return false;

    const footnoteText = getFootnoteText(footnote);
    const candidateText = getOriginalText(node);
    return footnoteText.length >= 3 && candidateText.endsWith(footnoteText);
}

function isGeneratedSidenoteTextTarget(node: Element): boolean {
    const sidenote = node.parentElement;
    if (!sidenote || !isGeneratedSidenote(sidenote)) return false;

    const footnote = getReferencedFootnote(sidenote);
    return Boolean(footnote && getOriginalText(node) === getFootnoteText(footnote));
}

function findGeneratedSidenoteTextTarget(sidenote: Element): Element | null {
    if (!isGeneratedSidenote(sidenote)) return null;

    const footnote = getReferencedFootnote(sidenote);
    if (!footnote) return null;
    const footnoteText = getFootnoteText(footnote);

    return Array.from(sidenote.children)
        .find(child => getOriginalText(child) === footnoteText) ?? null;
}

function getReferencedFootnote(sidenote: Element): Element | null {
    const reference = sidenote.previousElementSibling;
    if (!reference?.matches('sup.footnote-ref')) return null;

    const anchor = reference.querySelector<HTMLAnchorElement>(':scope > a[href^="#"]');
    const hash = anchor?.getAttribute('href');
    if (!hash || hash.length < 2) return null;

    const footnote = document.getElementById(hash.slice(1));
    if (!footnote || footnote === sidenote || footnote.contains(sidenote)) return null;
    if (!footnote.matches('.footnote-item, [role="doc-endnote"]') && !footnote.closest('.footnotes')) return null;
    return footnote;
}

function getFootnoteText(footnote: Element): string {
    const clone = footnote.cloneNode(true) as Element;
    clone.querySelectorAll('.footnote-backref, [role="doc-backlink"]').forEach(node => node.remove());
    return normalizeText(clone.textContent ?? '');
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function getOriginalText(node: Element): string {
    const clone = node.cloneNode(true) as Element;
    clone.querySelectorAll(`.${BILINGUAL_CONTENT_CLASS}, .only-translate-loading, .only-translate-failure, .only-translate-retry-wrapper`)
        .forEach(element => element.remove());
    return normalizeText(clone.textContent ?? '');
}
