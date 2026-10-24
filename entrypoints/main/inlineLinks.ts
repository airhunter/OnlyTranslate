import { isExcludedFromTranslatableText, isProtectedInlineElement } from './dom';
import { siteProfiles } from './siteProfiles';
import type { InlineLinkPolicy } from './siteProfiles/types';
import { getMainDomain } from '@/entrypoints/utils/domain';
import {
    applyTranslationOnly, prepareTranslationOnly, restoreTranslationOnly,
    type PreparedTranslationOnly,
} from './translationOnly';

export type InlineLinkResolver = (node: Element) => InlineLinkPolicy | false;
const UI_SELECTOR = 'button, [role="button"], time, nav, [role="navigation"], [contenteditable="true"]';
const EXCLUDED_SELECTOR = 'script, style, noscript, template, iframe, [hidden], [aria-hidden="true"], .only-translate-bilingual-content, .only-translate-loading, .only-translate-retry-wrapper';

function copyLinkLabel(node: Node, parent: Node): void {
    if (node instanceof Text) {
        parent.appendChild(document.createTextNode(node.data));
    } else if (node instanceof Element && node.matches('span, br')) {
        // Legacy X clips URL prefixes/tails with CSS spans. Keep their visual
        // and accessibility structure without copying IDs or event attributes.
        const label = document.createElement(node.tagName.toLowerCase());
        for (const name of ['class', 'dir', 'aria-hidden', 'hidden', 'translate']) {
            if (node.hasAttribute(name)) label.setAttribute(name, node.getAttribute(name)!);
        }
        node.childNodes.forEach(child => copyLinkLabel(child, label));
        parent.appendChild(label);
    } else if (node instanceof Element && !node.matches('script, style, template')) {
        node.childNodes.forEach(child => copyLinkLabel(child, parent));
    }
}

export function getSmartInlineLinkResolver(host: HTMLElement, scope: string | null | undefined): InlineLinkResolver | undefined {
    const resolve = getSmartInlineLinkPolicy(scope);
    return resolve && Array.from(host.querySelectorAll('a[href]')).some(link => resolve(link)) ? resolve : undefined;
}

export function getSmartInlineLinkPolicy(scope: string | null | undefined): InlineLinkResolver | undefined {
    if (scope !== 'smart') return undefined;
    return siteProfiles.find(profile => profile.domains.includes(getMainDomain(location.href)))?.inlineLink;
}

export function preserveInlineLink(node: Element, resolve: InlineLinkResolver): boolean {
    return node.matches(UI_SELECTOR) || resolve(node) === 'preserve';
}

// Build only local, minimal inline markup; service output is always treated as text.
// Classes keep the site's theme/hover colors, while our class constrains layout/font.
export function prepareInlineLinkTranslation(host: HTMLElement, resolve: InlineLinkResolver): PreparedTranslationOnly {
    const draft = document.createElement('span');
    const preserved = new Set<Element>();
    const collect = (node: Node, parent: Node): void => {
        if (node instanceof Text) {
            parent.appendChild(document.createTextNode(node.data));
            return;
        }
        if (!(node instanceof Element) || node.matches(`${EXCLUDED_SELECTOR}, ${UI_SELECTOR}`) || isExcludedFromTranslatableText(node)) return;
        const policy = resolve(node);
        if (policy) {
            const link = document.createElement('a');
            link.href = new URL(node.getAttribute('href')!, location.href).href;
            link.className = node.getAttribute('class') ?? '';
            link.classList.add('only-translate-inline-link');
            link.setAttribute('data-only-translate-inline-link', 'v1');
            if (node.hasAttribute('title')) link.title = node.getAttribute('title')!;
            if (node.hasAttribute('dir')) link.dir = node.getAttribute('dir')!;
            if (node.getAttribute('target') === '_blank') link.target = '_blank';
            link.rel = `${node.getAttribute('rel') ?? ''} noopener noreferrer`.trim();
            if (node instanceof HTMLElement) {
                link.style.color = node.style.color;
                link.style.textDecoration = node.style.textDecoration;
            }
            if (policy === 'preserve') {
                node.childNodes.forEach(child => copyLinkLabel(child, link));
                preserved.add(link);
            } else link.textContent = node.textContent;
            parent.appendChild(link);
            return;
        }
        if (isProtectedInlineElement(node)) {
            const clone = node.cloneNode(true) as Element;
            clone.removeAttribute('id');
            clone.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
            parent.appendChild(clone);
            return;
        }
        if (node.matches('br')) {
            parent.appendChild(document.createTextNode('\n'));
            return;
        }
        node.childNodes.forEach(child => collect(child, parent));
    };
    host.childNodes.forEach(child => collect(child, draft));
    return prepareTranslationOnly(draft, node => preserved.has(node));
}

export function renderInlineLinkTranslation(prepared: PreparedTranslationOnly, text: string): DocumentFragment | null {
    if (!applyTranslationOnly(prepared, text)) return null;
    const fragment = document.createDocumentFragment();
    prepared.host.childNodes.forEach(child => fragment.appendChild(child.cloneNode(true)));
    // Detached draft records must not accumulate in the page's restore registry.
    restoreTranslationOnly(prepared.host);
    return fragment;
}

// English protocol names can dominate automatic language detection on short
// multilingual posts. Transport numbered boundaries; restore the existing local
// protocol only after validating every boundary exactly once and in order.
export function encodeInlineLinkRequest(prepared: PreparedTranslationOnly) {
    const markers: string[] = [];
    const collision = /⟦\d+⟧/.test(prepared.text);
    const source = prepared.separatorPadding === ' '
        ? prepared.text.replace(/ (__ONLY_TRANSLATE_SLOT_\d+__) /g, '$1') : prepared.text;
    const text = collision ? '' : source.replace(/__ONLY_TRANSLATE_(?:SLOT_\d+|INLINE_\d+_[a-z0-9]+)__/g, marker => {
        markers.push(marker);
        return `⟦${markers.length - 1}⟧`;
    });
    return {
        text,
        decode(value: string): string | null {
            if (collision) return null;
            const actual = value.match(/⟦\d+⟧/g) ?? [];
            if (actual.length !== markers.length || actual.some((marker, index) => marker !== `⟦${index}⟧`)) return null;
            return value.replace(/⟦(\d+)⟧/g, (_, index: string) => markers[Number(index)]!);
        }
    };
}
