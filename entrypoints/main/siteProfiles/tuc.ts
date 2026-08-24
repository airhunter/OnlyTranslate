import type { SiteProfile } from './types';

const REPORT_PATH_PATTERN = /^\/research-analysis\/reports(?:\/|$)/;
const REPORT_STREAM_SELECTOR = '.page-body__cut-in__stream:not(.cut_sign_up)';
const REPORT_TARGET_SELECTORS = [
    '.stream-page-title h1',
    '.stream-introduction > span',
    '.stream-findings__title > span',
    '.stream-findings__paragraph h2',
    '.stream-findings__paragraph h3',
    '.stream-findings__paragraph h4',
    '.stream-findings__paragraph p',
    '.stream-findings__paragraph li',
    '.stream-findings__paragraph blockquote',
    '.views-element-container .stream-subheading > span',
    '.views-element-container .stream-paragraph h2',
    '.views-element-container .stream-paragraph h3',
    '.views-element-container .stream-paragraph h4',
    '.views-element-container .stream-paragraph p',
    '.views-element-container .stream-paragraph li',
    '.views-element-container .stream-paragraph blockquote'
];
const REPORT_TARGET_SELECTOR = REPORT_TARGET_SELECTORS.join(', ');
const SCOPED_REPORT_TARGET_SELECTOR = REPORT_TARGET_SELECTORS
    .map(selector => `${REPORT_STREAM_SELECTOR} ${selector}`)
    .join(', ');

export const tucProfile: SiteProfile = {
    id: 'tuc-report',
    domains: ['tuc.org.uk'],
    collectFastPathTargets: (root, context) => {
        if (context.mode !== 'smart' || !isTucReportPage(root)) return false;

        const document = getOwnerDocument(root);
        return Array.from(document.querySelectorAll<Element>(SCOPED_REPORT_TARGET_SELECTOR))
            .filter(isReadableReportTarget);
    },
    allowTarget: (node, context) => {
        if (context.mode !== 'smart' || !isTucReportPage(node)) return false;
        if (!node.matches(REPORT_TARGET_SELECTOR) || !node.closest(REPORT_STREAM_SELECTOR)) return false;
        if (!isReadableReportTarget(node)) return false;

        return {
            target: node,
            role: /^h[1-4]$/i.test(node.tagName) || node.closest('.stream-findings__title, .stream-subheading')
                ? 'title'
                : 'paragraph',
            reason: 'tuc-report-reading-target'
        };
    }
};

function isTucReportPage(root: ParentNode): boolean {
    const document = getOwnerDocument(root);
    return REPORT_PATH_PATTERN.test(window.location.pathname)
        && (document.body.classList.contains('page-node-type-report')
            || document.querySelector('.page-node-type-report') !== null)
        && document.querySelector(REPORT_STREAM_SELECTOR) !== null;
}

function getOwnerDocument(root: ParentNode): Document {
    return root instanceof Document ? root : root.ownerDocument ?? document;
}

function isReadableReportTarget(node: Element): boolean {
    if (node.closest('.footnotes, nav, aside, form, [aria-hidden="true"], .notranslate, [translate="no"]')) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 3 && /[A-Za-z]/.test(text);
}
