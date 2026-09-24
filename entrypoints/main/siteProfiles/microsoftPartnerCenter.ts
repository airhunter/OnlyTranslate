import type { SiteProfile } from './types';

const EDGE_PROPERTIES_PATH_PATTERN = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?dashboard\/microsoftedge\/[^/]+\/properties\/?$/i;
const PROPERTIES_FORM_SELECTOR = 'main df-form form';
const PROPERTIES_STATIC_COPY_SELECTOR = [
    `${PROPERTIES_FORM_SELECTOR} formly-field.section-label h4`,
    `${PROPERTIES_FORM_SELECTOR} formly-field.select-field label > span`,
    `${PROPERTIES_FORM_SELECTOR} formly-field.input-field .section-title > label`,
    `${PROPERTIES_FORM_SELECTOR} formly-field.section-label .mature-content > label`,
    `${PROPERTIES_FORM_SELECTOR} formly-field.section-label .mature-content > span`,
    `${PROPERTIES_FORM_SELECTOR} formly-field.checkbox-field span.text-body`
].join(', ');

export const microsoftPartnerCenterProfile: SiteProfile = {
    id: 'microsoft-partner-center-edge-properties',
    domains: ['microsoft.com'],
    select: (node) => {
        if (!isEdgePropertiesPage(node) || !isStaticPropertiesCopy(node)) return false;
        return node;
    },
    supplemental: (root, context) => {
        if (context.mode !== 'smart' || !isEdgePropertiesPage(root)) return [];

        const document = getOwnerDocument(root);
        return Array.from(document.querySelectorAll<Element>(PROPERTIES_STATIC_COPY_SELECTOR))
            .filter(isReadableStaticCopy);
    },
    preserveSupplementalTargets: true,
    allowTarget: (node) => {
        if (!isEdgePropertiesPage(node) || !isStaticPropertiesCopy(node)) return false;

        return {
            target: node,
            role: /^h[1-6]$/i.test(node.tagName) ? 'title' : 'paragraph',
            reason: 'microsoft-partner-center-properties-static-copy'
        };
    }
};

function isEdgePropertiesPage(root: ParentNode): boolean {
    const document = getOwnerDocument(root);
    return EDGE_PROPERTIES_PATH_PATTERN.test(window.location.pathname)
        && document.querySelector(PROPERTIES_FORM_SELECTOR) !== null;
}

function isStaticPropertiesCopy(node: Element): boolean {
    return node.matches(PROPERTIES_STATIC_COPY_SELECTOR) && isReadableStaticCopy(node);
}

function isReadableStaticCopy(node: Element): boolean {
    if (node.closest('button, input, textarea, select, option, [contenteditable="true"]')) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && /[A-Za-z]/.test(text);
}

function getOwnerDocument(root: ParentNode): Document {
    return root instanceof Document ? root : root.ownerDocument ?? document;
}
