import { DIRECT_TEXT_TARGET_ATTR, grabAllNode, inlineSet, wrapDirectTextRun } from '@/entrypoints/main/dom';
import type { SiteProfile } from './types';

const PRODUCT_FORM_SELECTOR = '#listing[itemtype="http://schema.org/Product"] form#add';
const PRODUCT_COPY_SELECTOR = [
    `${PRODUCT_FORM_SELECTOR} h1[itemprop="name"]`,
    `${PRODUCT_FORM_SELECTOR} [itemprop="description"]`,
    `${PRODUCT_FORM_SELECTOR} .below-desc .flex-box > div:last-child`
].join(', ');

export const potownProfile: SiteProfile = {
    id: 'potown',
    domains: ['potownstore.com'],
    supplemental: (root, context) => {
        if (context.mode !== 'smart') return [];

        // The store wraps its product description in the purchase form. Scan only
        // these reading blocks, keeping the normal form exclusion everywhere else.
        return Array.from(root.querySelectorAll(PRODUCT_COPY_SELECTOR))
            .flatMap(block => {
                if (block.matches('[itemprop="description"]')) wrapDescriptionInlineRuns(block);
                return grabAllNode(block, { siteCompatMode: 'smart' });
            });
    },
    preserveSupplementalTargets: true,
    allowTarget: (node, context) => {
        if (context.scope !== 'smart' || !node.closest(PRODUCT_COPY_SELECTOR)) return false;

        return {
            role: node.matches('h1') ? 'title' : 'paragraph',
            reason: 'potown-product-reading-copy'
        };
    }
};

function wrapDescriptionInlineRuns(description: Element): void {
    // Its opening paragraph is split into adjacent colored spans before the
    // block paragraphs and list. Keep that sentence together in the request.
    let run: ChildNode[] = [];
    const flush = () => {
        if (run.some(node => node.textContent?.trim())) wrapDirectTextRun(description, run, {});
        run = [];
    };
    for (const child of Array.from(description.childNodes)) {
        if (child instanceof Text || (child instanceof Element
            && inlineSet.has(child.tagName.toLowerCase())
            && !child.hasAttribute(DIRECT_TEXT_TARGET_ATTR))) {
            run.push(child);
        } else {
            flush();
        }
    }
    flush();
}
