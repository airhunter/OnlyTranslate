import type { SiteProfile } from './types';

const UPDATE_CONTENT_SELECTOR = '[data-component-part="update-content"]';
const UPDATE_NOTE_SELECTOR = [
    `${UPDATE_CONTENT_SELECTOR} li`,
    `${UPDATE_CONTENT_SELECTOR} p`,
    `${UPDATE_CONTENT_SELECTOR} [data-as="p"]`
].join(', ');
const CHANGELOG_METADATA_SELECTOR = [
    '#header',
    '#page-context-menu',
    '[data-component-part="update-label"]',
    '[data-component-part="update-description"]',
    '[data-component-part="accordion-button"]',
    '[data-component-part="accordion-title"]',
    '[data-component-part="accordion-title-container"]',
    'details.accordion',
    'summary'
].join(', ');

export const devinDocsProfile: SiteProfile = {
    id: 'devin-docs',
    domains: ['devin.ai'],
    targetStrategy: 'profile-first',
    select: (node) => {
        if (!isDevinChangelogPage()) return false;
        if (shouldSkipDevinChangelogNode(node)) return { skip: true };

        const target = getDevinChangelogNoteTarget(node);
        return target ?? false;
    },
    allowTarget: (node) => {
        if (!isDevinChangelogPage()) return false;

        const target = getDevinChangelogNoteTarget(node);
        if (!target) return false;

        return {
            target,
            role: 'paragraph',
            reason: 'devin-changelog-release-note'
        };
    },
    skipTarget: (node) => {
        if (!isDevinChangelogPage()) return false;

        if (shouldSkipDevinChangelogNode(node)) {
            return {
                policy: 'hard-skip',
                role: 'metadata',
                reason: 'devin-changelog-metadata'
            };
        }

        if (isDevinChangelogWrapper(node)) {
            return {
                policy: 'hard-skip',
                role: 'layout',
                reason: 'devin-changelog-wrapper'
            };
        }

        return false;
    }
};

function isDevinChangelogPage(): boolean {
    return window.location.hostname === 'docs.devin.ai'
        && /^\/desktop\/changelog\/?$/.test(window.location.pathname);
}

function getDevinChangelogNoteTarget(node: Element): Element | null {
    if (shouldSkipDevinChangelogNode(node)) return null;

    const target = node.closest(UPDATE_NOTE_SELECTOR);
    if (!target || shouldSkipDevinChangelogNode(target)) return null;
    if (!target.closest(UPDATE_CONTENT_SELECTOR)) return null;
    if (target.closest('details, summary')) return null;

    const text = getNormalizedText(target);
    if (text.length < 3) return null;
    if (!/[A-Za-z]/.test(text)) return null;

    return target;
}

function shouldSkipDevinChangelogNode(node: Element): boolean {
    if (node.closest(CHANGELOG_METADATA_SELECTOR)) return true;
    if (isDevinChangelogLabel(node)) return true;
    if (node.matches('h1, h2, h3, h4, h5, h6') && node.closest(UPDATE_CONTENT_SELECTOR)) return true;
    if (node.closest('.update-container') && !node.closest(UPDATE_CONTENT_SELECTOR)) return true;

    return false;
}

function isDevinChangelogLabel(node: Element): boolean {
    const paragraph = node.closest(`${UPDATE_CONTENT_SELECTOR} [data-as="p"]`);
    if (!paragraph) return false;
    if (paragraph.children.length !== 1) return false;

    const child = paragraph.firstElementChild;
    if (child?.tagName.toLowerCase() !== 'strong') return false;

    return getNormalizedText(paragraph) === getNormalizedText(child);
}

function isDevinChangelogWrapper(node: Element): boolean {
    return node.matches('#content-area, .update-container, [data-component-part="update-content"]');
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
