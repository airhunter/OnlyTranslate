import type { SiteProfile } from './types';

// Explicit adaptation of the reviewed article template, not semantic evidence
// for generic newsletter prose. Other article paths retain ordinary recognition.
function inReviewedArticle(): boolean {
    return location.hostname === 'www.joshwcomeau.com' && location.pathname === '/css/has/';
}

function signupParagraph(node: Element): boolean {
    if (!node.matches('main > article > p')) return false;
    const module = node.nextElementSibling;
    if (!module?.matches('div')) return false;
    const form = module.querySelector(':scope > form');
    if (!form?.querySelector('input[type="email"]')) return false;
    return Array.from(module.children).every(child => child === form || child.matches('span') && !child.textContent?.trim());
}

function reviewedParagraph(node: Element): Element | null {
    const paragraph = node.matches('p') ? node : node.closest('main > article > div')?.previousElementSibling;
    if (!paragraph || !signupParagraph(paragraph)) return null;
    // Ambiguous template states do not widen the exception.
    const candidates = Array.from(paragraph.parentElement!.children).filter(signupParagraph);
    return candidates.length === 1 ? paragraph : null;
}

export const joshComeauProfile: SiteProfile = {
    id: 'josh-reviewed-article',
    domains: ['joshwcomeau.com'],
    allowTarget: (node, context) => context.mode === 'smart' && inReviewedArticle() && reviewedParagraph(node) === node
        ? { role: 'paragraph', reason: 'josh-reviewed-article-introduction' } : undefined,
    supplemental: (root, context) => context.mode === 'smart' && inReviewedArticle()
        ? Array.from(root.querySelectorAll('main > article > p')).filter(node => reviewedParagraph(node) === node) : [],
    expandTarget: (node, context) => {
        if (context.mode !== 'smart' || !inReviewedArticle()) return undefined;
        const paragraph = reviewedParagraph(node);
        return paragraph ? [paragraph] : undefined;
    }
};
