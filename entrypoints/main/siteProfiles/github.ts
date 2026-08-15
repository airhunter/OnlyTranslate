import { findMatchingElement } from '@/entrypoints/utils/common';
import { collectDomTextUnits } from '@/entrypoints/main/translationTarget/unitizer';
import type { SiteProfile, SiteProfileMode } from './types';
import { debugLog, isSpecialContent, matchesOrClosest } from './utils';

export const githubProfile: SiteProfile = {
    id: 'github',
    domains: ['github.com'],
    collectFastPathTargets: (root, context) => {
        if (context.mode !== 'smart') return false;
        return collectGitHubMarkdownReadingTargets(root);
    },
    select: (node, context) => {
        if (isGitHubRepositorySearchChrome(node)) {
            return { skip: true };
        }

        const repositorySearchDescription = findGitHubRepositorySearchDescription(node);
        if (repositorySearchDescription) return repositorySearchDescription;

        const searchSponsorCopy = findGitHubSearchSponsorCopy(node);
        if (searchSponsorCopy) return searchSponsorCopy;

        if (shouldSkipGitHubElement(node, context.mode)) {
            return { skip: true };
        }

        if (isGitHubPathOrFileName(node)) {
            debugLog('GitHub', '目录/文件名跳过', node.textContent);
            return { skip: true };
        }

        const markdownUnit = findGitHubMarkdownReadingUnit(node);
        if (markdownUnit) return markdownUnit;

        if (isInsideGitHubMarkdownBody(node)) return false;

        const issueBody = findMatchingElement(node, 'div.comment-body');
        if (issueBody) return issueBody;

        const comment = findMatchingElement(node, 'div.comment-body td.comment-body');
        if (comment) return comment;

        const issueListTitle = findGitHubIssueListTitle(node);
        if (issueListTitle) return issueListTitle;

        const issueTitle = findMatchingElement(node, 'div.js-issue-title');
        if (issueTitle) return issueTitle;

        const prDescription = findMatchingElement(node, 'div.pull-request-review-comment');
        if (prDescription) return prDescription;

        const repoDescription = findMatchingElement(node, 'p.f4.my-3');
        if (repoDescription) return repoDescription;

        const commitMessage = findMatchingElement(node, 'div.commit-desc pre');
        if (commitMessage) return commitMessage;

        const aboutText = findMatchingElement(node, 'div.BorderGrid-cell > p');
        if (aboutText) return aboutText;

        const prStatus = findMatchingElement(node, 'div.merge-status-item span.status-meta');
        if (prStatus) return prStatus;

        const languageDesc = findMatchingElement(node, 'div.f6.color-fg-muted.mt-2');
        if (languageDesc) return languageDesc;

        const profile = findMatchingElement(node, 'div.p-note.user-profile-bio');
        if (profile) return profile;

        const repoListDesc = findMatchingElement(node, 'p.pinned-item-desc');
        if (repoListDesc) return repoListDesc;

        const actionLog = findMatchingElement(node, 'div.js-log-container pre');
        if (actionLog) return actionLog;

        return false;
    },
    appendTarget: (node) => {
        return findGitHubSearchSponsorCopy(node);
    },
    expandTarget: (node) => {
        return collectGitHubMarkdownUnits(node);
    },
    shouldKeepNestedTarget: (parent, child) => {
        if (isGitHubMarkdownListContainer(parent) && isGitHubMarkdownListItemOf(child, parent)) return true;
        return parent.matches('.markdown-body') && isGitHubMarkdownReadingUnit(child);
    },
    allowTarget: (node) => {
        if (isGitHubRepositorySearchDescription(node)) {
            return {
                target: node,
                role: 'summary',
                reason: 'github-repository-search-description'
            };
        }

        if (isGitHubSearchSponsorCopy(node)) {
            return {
                target: node,
                role: 'paragraph',
                reason: 'github-search-sponsor-copy'
            };
        }

        if (isGitHubIssueListTitle(node)) {
            return {
                target: node,
                role: 'title',
                reason: 'github-issue-list-title'
            };
        }

        if (!isGitHubMarkdownReadingUnit(node)) return false;

        return {
            target: node,
            role: /^h[1-6]$/i.test(node.tagName) ? 'title' : 'paragraph',
            reason: 'github-markdown-reading-unit'
        };
    },
    skipTarget: (node, context) => {
        if (!shouldSkipGitHubElement(node, context.mode)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'github-profile-skip'
        };
    }
};

const GITHUB_ISSUE_LIST_TITLE_SELECTOR = [
    'a[href*="/issues/"]',
    'a[href*="/pull/"]'
].join(', ');

const GITHUB_MARKDOWN_READING_TARGET_SELECTOR = [
    '.markdown-body h1',
    '.markdown-body h2',
    '.markdown-body h3',
    '.markdown-body h4',
    '.markdown-body h5',
    '.markdown-body h6',
    '.markdown-body p',
    '.markdown-body li',
    '.markdown-body blockquote',
    '.markdown-body figcaption'
].join(', ');

function collectGitHubMarkdownReadingTargets(root: ParentNode): Element[] {
    const targets = Array.from(root.querySelectorAll<Element>(GITHUB_MARKDOWN_READING_TARGET_SELECTOR));
    if (root instanceof Element && root.matches(GITHUB_MARKDOWN_READING_TARGET_SELECTOR)) {
        targets.unshift(root);
    }

    return targets.filter(isGitHubMarkdownReadingUnit);
}

function isGitHubMarkdownReadingUnit(node: Element): boolean {
    if (!node.closest('.markdown-body')) return false;
    if (node.closest('pre, code, table.highlight, table.diff-table')) return false;

    const tag = node.tagName.toLowerCase();
    if (!['p', 'li', 'blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 8 && /[A-Za-z]/.test(text);
}

function findGitHubMarkdownReadingUnit(node: Element): Element | false {
    let current: Element | null = node;

    while (current && current !== document.body) {
        if (isGitHubMarkdownReadingUnit(current)) return current;
        if (current.matches('.markdown-body')) return false;
        current = current.parentElement;
    }

    return false;
}

function isInsideGitHubMarkdownBody(node: Element): boolean {
    return Boolean(node.closest('.markdown-body'));
}

function collectGitHubMarkdownUnits(node: Element): Element[] | false {
    const roots = getGitHubMarkdownRoots(node);
    if (roots.length === 0) return false;

    const units = roots.flatMap(root => collectDomTextUnits(root));
    return units.length > 0 ? units : false;
}

function getGitHubMarkdownRoots(node: Element): Element[] {
    if (node.matches('.markdown-body')) return [node];
    return Array.from(node.querySelectorAll<Element>('.markdown-body'));
}

function isGitHubMarkdownListContainer(element: Element): boolean {
    return element.matches('ul, ol') && Boolean(element.closest('.markdown-body'));
}

function isGitHubMarkdownListItemOf(item: Element, list: Element): boolean {
    return item.tagName.toLowerCase() === 'li'
        && item.parentElement === list
        && Boolean(item.closest('.markdown-body'));
}

function shouldSkipGitHubElement(node: Element, mode: SiteProfileMode = 'smart'): boolean {
    if (isGitHubRepositorySearchDescription(node)) return false;
    if (isGitHubSearchSponsorCopy(node)) return false;
    if (isGitHubIssueListTitle(node)) return false;
    if (isGitHubRepositorySearchChrome(node)) return true;
    if (shouldSkipGitHubSafetyElement(node)) return true;
    if (mode === 'full') return false;
    return shouldSkipGitHubSmartOnlyElement(node);
}

function findGitHubRepositorySearchDescription(node: Element): Element | false {
    let current: Element | null = node;
    while (current) {
        if (isGitHubRepositorySearchDescription(current)) return current;
        current = current.parentElement;
    }

    return false;
}

function isGitHubRepositorySearchDescription(node: Element): boolean {
    if (!isGitHubRepositorySearchPage()) return false;
    if (node.matches?.('a, button, summary, nav, header, footer, aside')) return false;
    if (node.closest('nav, header, footer, aside, button, summary, [role="button"]')) return false;
    if (node.closest('.topic-tag, .Label, .IssueLabel, [class*="label"], [class*="topic"], [class*="TokenList-module"]')) return false;

    const tag = node.tagName.toLowerCase();
    if (tag !== 'span') return false;
    if (!node.closest('[class*="Content-module__Content"]')) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text.length < 8 || !/[A-Za-z]/.test(text)) return false;
    if (/^(updated|star|stars|fork|forks|sponsor|sort by|filter by)\b/i.test(text)) return false;

    const resultContainer = findGitHubRepositorySearchResultContainer(node);
    if (!resultContainer) return false;

    const repoLink = findRepositorySearchResultLink(resultContainer);
    if (!repoLink) return false;
    if (repoLink.contains(node)) return false;

    const nodeLinks = Array.from(node.querySelectorAll('a'));
    if (nodeLinks.length > 0) return false;

    return true;
}

function isGitHubRepositorySearchChrome(node: Element): boolean {
    if (!isGitHubRepositorySearchPage()) return false;
    if (isGitHubRepositorySearchDescription(node) || isGitHubSearchSponsorCopy(node)) return false;
    if (isInsideGitHubRepositorySearchResult(node)) return true;

    if (node.closest('nav, header, footer, form, [data-testid="facets-pane"], [data-testid="filter-groups"], [aria-labelledby="search-filters-title"], [data-testid="search-sub-header"], [data-testid="results-list"]')) return true;
    if (hasClassKeyword(node, 'sidebar')
        || hasClosestClassKeyword(node, 'sidebar')
        || hasClassKeyword(node, 'facets')
        || hasClosestClassKeyword(node, 'facets')
        || hasClassKeyword(node, 'minitip')
        || hasClosestClassKeyword(node, 'minitip')
        || hasClassKeyword(node, 'secondarysuggestions')
        || hasClosestClassKeyword(node, 'secondarysuggestions')
        || hasClassKeyword(node, 'searchsubheader')
        || hasClosestClassKeyword(node, 'searchsubheader')
        || hasClassKeyword(node, 'typemobiledropdown')
        || hasClosestClassKeyword(node, 'typemobiledropdown')) {
        return true;
    }

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (/^(filter by|filter:|sort by|repositories|code|issues|pull requests|discussions|users|languages|advanced)$/i.test(text)) {
        return true;
    }
    if (/^\d+(\.\d+)?k?\s+results/i.test(text)) return true;

    return false;
}

function findGitHubSearchSponsorCopy(node: Element): HTMLElement | false {
    let current: Element | null = node;
    while (current) {
        if (isGitHubSearchSponsorCopy(current)) return current as HTMLElement;
        current = current.parentElement;
    }

    const candidates = Array.from(node.querySelectorAll?.<HTMLElement>('p, span, div') ?? []);
    const sponsorCopy = candidates.find(candidate => isGitHubSearchSponsorCopy(candidate));
    if (sponsorCopy) return sponsorCopy;

    return false;
}

function isGitHubSearchSponsorCopy(node: Element): boolean {
    if (!isGitHubRepositorySearchPage()) return false;
    if (!['p', 'span', 'div'].includes(node.tagName.toLowerCase())) return false;
    if (!hasClassKeyword(node, 'marketingsuggestion-module__description') && !node.closest('[class*="MarketingSuggestion-module__container"]')) return false;
    if (!findGitHubSearchSponsorCard(node)) return false;
    if (node.querySelector('h1, h2, h3, a, button')) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 40
        && /open source/i.test(text)
        && /contributors|recognition|everyone/i.test(text);
}

function findGitHubSearchSponsorCard(node: Element): Element | false {
    let current: Element | null = node;
    while (current && current !== document.body) {
        if (!hasClassKeyword(current, 'marketingsuggestion-module__container')) {
            current = current.parentElement;
            continue;
        }

        const heading = current.querySelector?.('h2, h3');
        const headingText = heading?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (/sponsor open source projects/i.test(headingText)) return current;
        current = current.parentElement;
    }

    return false;
}

function isGitHubRepositorySearchPage(): boolean {
    try {
        const url = new URL(location.href);
        return url.hostname === 'github.com'
            && url.pathname === '/search'
            && url.searchParams.get('type') === 'repositories';
    } catch (_) {
        return false;
    }
}

function findGitHubRepositorySearchResultContainer(node: Element): Element | false {
    return node.closest('[class*="Result-module__Result"], [class*="Repositories-module__resultRow"]') ?? false;
}

function isInsideGitHubRepositorySearchResult(node: Element): boolean {
    return Boolean(findGitHubRepositorySearchResultContainer(node));
}

function findRepositorySearchResultLink(container: Element): HTMLAnchorElement | undefined {
    return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .find(link => isRepositorySearchResultHref(link.getAttribute('href') ?? ''));
}

function isRepositorySearchResultHref(href: string): boolean {
    return /^\/[^/\s]+\/[^/\s]+$/.test(href)
        || /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/.test(href);
}

function hasClassKeyword(node: Element, keyword: string): boolean {
    return typeof node.className === 'string'
        && node.className.toLowerCase().includes(keyword);
}

function hasClosestClassKeyword(node: Element, keyword: string): boolean {
    let current = node.parentElement;
    while (current) {
        if (hasClassKeyword(current, keyword)) return true;
        current = current.parentElement;
    }

    return false;
}

function findGitHubIssueListTitle(node: Element): Element | false {
    const candidate = findMatchingElement(node, GITHUB_ISSUE_LIST_TITLE_SELECTOR);
    return candidate && isGitHubIssueListTitle(candidate) ? candidate : false;
}

function isGitHubIssueListTitle(node: Element): boolean {
    if (!node.matches?.(GITHUB_ISSUE_LIST_TITLE_SELECTOR)) return false;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text.length < 8 || !/[A-Za-z]/.test(text)) return false;
    if (node.closest('nav, header, footer, aside, form, button, summary')) return false;

    const href = node.getAttribute('href') ?? '';
    return /^\/[^/\s]+\/[^/\s]+\/(issues|pull)\/\d+([/?#].*)?$/.test(href)
        || /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(issues|pull)\/\d+([/?#].*)?$/.test(href);
}

function shouldSkipGitHubSafetyElement(node: Element): boolean {
    if (node.textContent && isSpecialContent(node.textContent)) {
        debugLog('GitHub', '特殊内容跳过', node.textContent);
        return true;
    }

    if (isGitHubPathOrFileName(node)) {
        debugLog('GitHub', '目录/文件名跳过', node.textContent);
        return true;
    }

    const gitHubLabels = [
        'bug', 'feature', 'enhancement', 'documentation', 'duplicate', 'good first issue',
        'help wanted', 'invalid', 'question', 'wontfix', 'dependencies', 'security',
        'open', 'closed', 'merged', 'draft', 'done', 'in progress',
        'pending', 'fixed', 'resolved', 'won\'t fix', 'needs review', 'approved',
        'blocked', 'stale', 'needs work', 'ready for review', 'needs more information',
        'frontend', 'backend', 'api', 'ui', 'ux', 'refactor', 'test',
        'needs tests', 'ready for work', 'wip', 'top priority', 'low priority', 'medium priority',
        'high priority', 'work in progress', 'needs investigation', 'feature request',
        'discussion', 'breaking change', 'needs triage'
    ];

    const gitHubStatusTexts = [
        'Open', 'Closed', 'Merged', 'Draft', 'Pending', 'Approved',
        'Changes requested', 'Review required', 'Needs work', 'Ready for review',
        'Assignee', 'Author', 'Changed', 'Comments', 'Commits', 'Conversation',
        'Files changed', 'Participants', 'Reviewers', 'Unresolved conversations',
        'View changes', 'Clone', 'Code', 'Issues', 'Pull requests', 'Discussions',
        'Actions', 'Projects', 'Security', 'Security and quality', 'Insights',
        'Wiki', 'Settings', 'Contributors', 'Raw', 'Blame', 'History',
        'is:issue', 'is:pr', 'is:open', 'is:closed', 'state:open', 'state:closed',
        'No wrap', 'Soft wrap', 'Set status'
    ];

    if (node.textContent) {
        const text = node.textContent.trim();
        const uiText = normalizeGitHubUiText(text);

        for (const label of gitHubLabels) {
            if (uiText.toLowerCase() === label.toLowerCase()) {
                debugLog('GitHub', 'GitHub Label跳过', text);
                return true;
            }
        }

        for (const status of gitHubStatusTexts) {
            if (uiText === status) {
                debugLog('GitHub', 'GitHub状态文本跳过', text);
                return true;
            }
        }

        if (/^([a-z]+):([a-z]+)(\s+([a-z]+):([a-z]+))*$/.test(text)) {
            debugLog('GitHub', '搜索过滤器语法跳过', text);
            return true;
        }

        if (/^v?\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/.test(text)
            || /^\d+\s+(issues|pull requests|commits|stars|forks|watching)$/.test(text.toLowerCase())) {
            debugLog('GitHub', '版本号或数字统计跳过', text);
            return true;
        }
    }

    const safeSkipSelectors = [
        'nav[aria-label="Repository"]',
        'nav.js-repo-nav',
        'a.UnderlineNav-item',
        'pre',
        'code',
        'table.highlight',
        'table.diff-table',
        'button',
        'input',
        'textarea',
        'summary',
        'span.Counter',
        '.octicon',
        'svg',
        'aside.Layout-sidebar',
        'div.Layout-sidebar',
        'div.release-entry'
    ];

    for (const selector of safeSkipSelectors) {
        if (matchesOrClosest(node, selector)) {
            debugLog('GitHub', '安全选择器匹配跳过', selector, node.textContent);
            return true;
        }
    }

    const statCountPattern = /^\s*\d+(\.\d+)?[kKmMbB]?\s*(stars|watching|forks|views|issues|pull|commits|watchers)?\s*$/;
    if (statCountPattern.test(node.textContent?.trim() ?? '')) {
        debugLog('GitHub', '统计数字跳过', node.textContent);
        return true;
    }

    if (typeof node.className === 'string'
        && (node.className.includes('topic-tag-link') || node.className.includes('topic-tag'))
        || typeof node.parentElement?.className === 'string' && node.parentElement.className.includes('topic-tag')) {
        debugLog('GitHub', '仓库标签跳过', node.textContent);
        return true;
    }

    if (/^Apache-[\d.]+|MIT|GPL-[\d.]+|BSD|LGPL/.test(node.textContent?.trim() ?? '')) {
        debugLog('GitHub', '许可证文本跳过', node.textContent);
        return true;
    }

    return false;
}

function shouldSkipGitHubSmartOnlyElement(node: Element): boolean {
    const skipSelectors = [
        'header.Header',
        'nav.js-repo-nav',
        'nav.menu',
        'div.Layout-sidebar',
        'form',
        'input',
        'textarea',
        'button',
        'pre.highlight',
        'code',
        'table.highlight',
        'table.diff-table',
        'div.pagination',
        'div.subnav',
        'div.file-header',
        'div.file-actions',
        'div.js-calendar-graph',
        'ul.repository-lang-stats-numbers',
        'summary',
        'span.Counter',
        'div.controls',
        'span.js-hidden-pane-button',
        'div.js-details-container Details',
        'div.Box-row',
        'div.react-directory-filename-column',
        'div.react-directory-filename-cell',
        'div.react-directory-truncate',
        'div[class*="directory-"]',
        'a[title][aria-label*="Directory"]',
        'a[title][aria-label*="File"]',
        'footer',
        'a.author',
        'span.author',
        'a.user-mention',
        'a.commit-author',
        'div.merge-status-list',
        'div.js-navigation-container',
        'span.State',
        'div.TimelineItem-badge',
        'div.color-fg-muted',
        'div.Box-header',
        'div.js-details-container',
        'span.Link--secondary',
        'div.BorderGrid-row',
        '.repo-language-color',
        'a.topic-tag',
        'span.d-inline-block.mr-3',
        'a.Link--muted',
        'span.no-wrap',
        '.octicon',
        'a.Link--primary > svg.octicon',
        'div.d-flex',
        'div.repo-and-owner',
        'h1.flex-auto',
        'div.pagehead',
        'div.pagehead-actions',
        'div.f4.mt-3',
        'h2#files',
        'div.commit-tease',
        'div.file-wrap',
        'span[data-view-component="true"]',
        'span.color-fg-muted',
        'span.text-bold',
        'div.tabnav',
        'div.tabnav-tabs',
        'div.table-list-header-toggle',
        'div.package-list',
        'div.release-entry',
        'span.Label',
        'a.social-count',
        'a.pl-3',
        'div[role="grid"]',
        'div.flash',
        'div.Box-row--gray',
        'div.BorderGrid-cell',
        'div.issue-item',
        'div.issue-item-header',
        'span.opened-by',
        'div.issue-item-body',
        'div.issue-item-footer',
        'span.issue-item-meta',
        'span.issue-meta-section',
        'div.flex-auto.min-width-0',
        'div.issues-reset-query-wrapper',
        'span.issue-keyword',
        'a.issues-reset-query',
        'span.selected-text',
        'a.filter-item',
        'span.label',
        'span.tooltipped',
        'div.select-menu-item-text',
        'div.select-menu-filters',
        'a.select-menu-item',
        'div.select-menu-list',
        'nav.subnav',
        'div.flex-column.flex-auto',
        'div.table-list-filters',
        'div.table-list-header',
        'div.flex-items-center.flex-justify-between',
        'div.js-issue-row',
        'div.lh-default',
        'a.js-selected-navigation-item',
        'nav.d-flex',
        'div.js-check-all-container',
        'div.flex-shrink-0',
        'div.timeline-comment-header',
        'div.comment-form-textarea',
        'div.sidebar-notifications',
        'div.gh-header',
        'span.js-issue-title',
        'a.js-hard-refresh',
        'div.Link--muted',
        'a.IssueLabel',
        'span.IssueLabel',
        'span.labels',
        'span.label-link',
        'a.label-link',
        'div.labels',
        'span.color-label',
        'span.bg-yellow',
        'span.bg-green',
        'span.bg-red',
        'span.bg-purple',
        'span.bg-blue',
        'span.text-green',
        'span.text-red',
        'div.js-issue-labels',
        'div.js-issue-labels .labels a',
        'div.js-issue-labels .IssueLabel',
        'span.js-issue-labels',
        'span.issue-meta-section.ml-2.issue-label-group',
        'span.color-fg-danger',
        'span.color-fg-success',
        'span.color-fg-done',
    ];

    for (const selector of skipSelectors) {
        if (matchesOrClosest(node, selector)) {
            debugLog('GitHub', '选择器匹配跳过', selector, node.textContent);
            return true;
        }
    }

    const skipClassKeywords = [
        'octicon', 'anim-', 'btn', 'menu', 'icon', 'Avatar', 'repo',
        'branch', 'commits', 'issues', 'pull', 'directory', 'filename',
        'Counter', 'topic-tag', 'social-count', 'State', 'Label', 'UnderlineNav',
        'IssueLabel', 'issue-keyword', 'issue-label', 'label-link', 'color-label',
        'js-issue-labels', 'issue-meta', 'bg-', 'color-text-'
    ];

    if (typeof node.className === 'string') {
        for (const keyword of skipClassKeywords) {
            if (node.className.includes(keyword)) {
                debugLog('GitHub', '类名关键字跳过', keyword, node.className);
                return true;
            }
        }
    }

    const skipAttributes = [
        'data-hovercard-type', 'data-issue-and-pr-hovercards-enabled',
        'data-issue-title', 'data-url', 'data-pjax', 'data-hotkey', 'data-target',
        'data-filter-value', 'data-direction', 'data-state'
    ];

    for (const attr of skipAttributes) {
        if (node.hasAttribute && node.hasAttribute(attr)) {
            debugLog('GitHub', '属性匹配跳过', attr);
            return true;
        }
    }

    if (node.textContent?.trim().startsWith('@')) {
        debugLog('GitHub', '用户名@提及跳过', node.textContent);
        return true;
    }

    return false;
}

function normalizeGitHubUiText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s+\d+$/g, '')
        .trim();
}

function isGitHubPathOrFileName(node: Element): boolean {
    if (!node || !node.textContent) return false;

    const text = node.textContent.trim();
    if (!text) return false;

    if (node.matches?.('nav[aria-label="Breadcrumb"]')
        || node.matches?.('span.final-path')
        || node.matches?.('span.js-repo-root')
        || node.matches?.('a[title][aria-label*="Directory"]')
        || node.matches?.('a[title][aria-label*="File"]')) {
        debugLog('GitHub', '路径导航元素', '匹配选择器', node.outerHTML?.substring(0, 100));
        return true;
    }

    let parent = node.parentElement;
    while (parent) {
        if (parent.matches?.('div.react-directory-filename-column')
            || parent.matches?.('div.react-directory-filename-cell')
            || parent.matches?.('div.react-directory-truncate')
            || (typeof parent.className === 'string' && parent.className.includes('directory-'))) {
            debugLog('GitHub', '目录元素父节点', '匹配父元素选择器', parent.outerHTML?.substring(0, 100));
            return true;
        }
        parent = parent.parentElement;
    }

    if (node.tagName?.toLowerCase() === 'a' && node.getAttribute('aria-label')?.includes('Directory')) {
        debugLog('GitHub', '目录链接', 'aria-label包含Directory', node.getAttribute('aria-label'));
        return true;
    }

    if (/^\.github|^src\/|^test\/|^docs\/|^\.gitignore$|^LICENSE$|^README\.md$|^CHANGELOG\.md$|^package\.json$|^Dockerfile$/i.test(text)) {
        if (node.tagName?.toLowerCase() === 'a' || node.parentElement?.matches?.('div.Box-row')) {
            debugLog('GitHub', '常见目录或文件名', text);
            return true;
        }
    }

    if (text.includes('/') && text.length < 100
        && !/\s/.test(text)
        && !/[，。？！；：""''（）【】「」『』〔〕]/.test(text)) {
        debugLog('GitHub', '路径格式文本', text);
        return true;
    }

    if (/\.(js|ts|jsx|tsx|css|scss|html|json|md|py|java|go|rs|c|cpp|h|hpp|rb|php|sh|bat|cmd|yaml|yml|xml)$/i.test(text)) {
        debugLog('GitHub', '文件扩展名匹配', text);
        return true;
    }

    if (/^#\d+$/.test(text) || /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+#\d+$/.test(text)) {
        debugLog('GitHub', 'Issue/PR编号', text);
        return true;
    }

    return false;
}
