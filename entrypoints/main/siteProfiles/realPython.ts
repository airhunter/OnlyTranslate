import type { SiteProfile } from './types';

const ARTICLE_TOC_LINK_SELECTOR = '#toc .toc li > a';
const ARTICLE_TOC_LIST_ITEM_SELECTOR = '#toc .toc li';
const ARTICLE_BODY_SELECTOR = '.article-body';
const ALERT_SELECTOR = '.article-body .alert[role="alert"]';
const ALERT_PARAGRAPH_SELECTOR = `${ALERT_SELECTOR} > p`;
const ARTICLE_TABLE_CELL_SELECTOR = '.article-body .table-responsive table.table th, .article-body .table-responsive table.table td';
const ARTICLE_TABLE_WRAPPER_SELECTOR = '.article-body .table-responsive, .article-body .table-responsive table, .article-body .table-responsive tr';

export const realPythonProfile: SiteProfile = {
    id: 'real-python',
    domains: ['realpython.com'],
    select: (node) => {
        if (node.matches(ARTICLE_TOC_LINK_SELECTOR)) return node;
        if (node.matches(ALERT_PARAGRAPH_SELECTOR)) return node;
        if (node.matches(ARTICLE_TABLE_CELL_SELECTOR)) return node;

        return false;
    },
    allowTarget: (node) => {
        if (node.matches(ARTICLE_TOC_LINK_SELECTOR)) {
            return {
                target: node,
                role: 'metadata',
                reason: 'real-python-article-toc-link'
            };
        }

        if (node.matches(ALERT_PARAGRAPH_SELECTOR)) {
            return {
                target: node,
                role: 'paragraph',
                reason: 'real-python-alert-paragraph'
            };
        }

        if (node.matches(ARTICLE_TABLE_CELL_SELECTOR)) {
            return {
                target: node,
                role: node.tagName.toLowerCase() === 'th' ? 'metadata' : 'paragraph',
                reason: 'real-python-table-cell'
            };
        }

        return false;
    },
    skipTarget: (node) => {
        if (node.matches(ARTICLE_BODY_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'layout',
                reason: 'real-python-article-body-wrapper'
            };
        }

        if (node.matches(ARTICLE_TOC_LIST_ITEM_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'metadata',
                reason: 'real-python-toc-list-item-wrapper'
            };
        }

        if (node.matches(ALERT_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'ui',
                reason: 'real-python-alert-wrapper'
            };
        }

        if (node.matches(ARTICLE_TABLE_WRAPPER_SELECTOR)) {
            return {
                policy: 'hard-skip',
                role: 'layout',
                reason: 'real-python-table-wrapper'
            };
        }

        return false;
    }
};
