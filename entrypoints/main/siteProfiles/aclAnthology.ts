import type { SiteProfile } from './types';

const AUTHOR_ROW = '#main > div > h2#title + p.lead';
const PAPER_METADATA = '#main > .acl-paper-details > div > dl';

export const aclAnthologyProfile: SiteProfile = {
    id: 'acl-anthology',
    domains: ['aclanthology.org'],
    skipTarget: (node, context) => {
        if (context.scope !== 'smart' || !isPaperMetadata(node)) return false;
        return { policy: 'hard-skip', role: 'metadata', reason: 'acl-paper-metadata' };
    }
};

function isPaperMetadata(node: Element): boolean {
    const details = node.closest(PAPER_METADATA);
    if (details && !details.closest('.acl-abstract')
        && details.closest('#main')?.querySelector(':scope > div > h2#title')
        && Array.from(details.children).some(child => child.matches('dt')
            && /^Anthology ID\s*:$/.test(child.textContent?.trim() ?? ''))) return true;

    const row = node.closest(AUTHOR_ROW);
    if (!row?.childElementCount) return false;
    return Array.from(row.childNodes).every(child => {
        if (child instanceof Element) return child.matches('a[href^="/people/"]');
        return child.nodeType !== Node.TEXT_NODE || /^[\s,;]*$/.test(child.textContent ?? '');
    });
}
