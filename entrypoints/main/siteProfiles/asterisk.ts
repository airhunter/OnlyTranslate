import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

const FOOTNOTE_TRANSLATION_CLASS = 'only-translate-asterisk-footnote';
const ARTICLE_TARGET_SELECTOR = 'h1, h2, h3, h4, p, li, blockquote, figcaption';
const ARTICLE_WRAPPER_SELECTOR = [
    '.post .content',
    '.post .content-blocks',
    '.post .intro',
    '.post .heading',
    '.post .text'
].join(', ');

let footnoteRelayoutTimer: number | undefined;

export const asteriskProfile: SiteProfile = {
    id: 'asterisk',
    domains: ['asteriskmag.com'],
    targetStrategy: 'profile-first',
    select: (node) => {
        const target = getAsteriskArticleTarget(node);
        return target ?? false;
    },
    allowTarget: (node) => {
        const target = getAsteriskArticleTarget(node);
        if (!target) return false;

        return {
            target,
            role: inferAsteriskRole(target),
            reason: 'asterisk-article-target'
        };
    },
    skipTarget: (node) => {
        if (isAsteriskProgressNavigation(node)) {
            return {
                policy: 'hard-skip',
                role: 'ui',
                reason: 'asterisk-progress-navigation'
            };
        }

        if (!isAsteriskArticleWrapper(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'layout',
            reason: 'asterisk-article-wrapper'
        };
    },
    afterBilingualAppend: (_node, translationNode, appendTarget) => {
        if (!appendTarget.closest('.footnotes-list li')) return;

        translationNode.classList.add(FOOTNOTE_TRANSLATION_CLASS);
        scheduleFootnoteRelayout();
    }
};

function getAsteriskArticleTarget(node: Element): Element | null {
    if (isAsteriskProgressNavigation(node)) return null;

    const target = node.closest(ARTICLE_TARGET_SELECTOR);
    if (!target || !isReadableAsteriskArticleTarget(target)) return null;
    return target;
}

function isReadableAsteriskArticleTarget(node: Element): boolean {
    if (!node.matches(ARTICLE_TARGET_SELECTOR)) return false;
    if (isAsteriskProgressNavigation(node)) return false;
    if (isManagedTranslationElement(node)) return false;
    if (!isInsideAsteriskArticleContent(node)) return false;

    const text = getNormalizedText(node);
    if (text.length < 3) return false;

    return /[A-Za-z]/.test(text);
}

function isAsteriskArticleWrapper(node: Element): boolean {
    if (!isInsideAsteriskArticleContent(node)) return false;
    if (!node.matches(ARTICLE_WRAPPER_SELECTOR) && !hasAsteriskArticleWrapperClass(node)) return false;
    if (isReadableAsteriskArticleTarget(node)) return false;
    return node.querySelector(ARTICLE_TARGET_SELECTOR) !== null;
}

function isAsteriskProgressNavigation(node: Element): boolean {
    return Boolean(node.closest('#progress, .progress-bookmark, .chapter-indicators, .markers'));
}

function inferAsteriskRole(node: Element) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'title';
    if (tag === 'figcaption') return 'summary';
    return 'paragraph';
}

function isInsideAsteriskArticleContent(node: Element): boolean {
    return Boolean(node.closest('.post') && node.closest('.opener, .content'));
}

function hasAsteriskArticleWrapperClass(node: Element): boolean {
    return node.id === 'rangyscope'
        || node.classList.contains('content')
        || node.classList.contains('content-blocks')
        || node.classList.contains('intro')
        || node.classList.contains('heading')
        || node.classList.contains('text');
}

function isManagedTranslationElement(node: Element): boolean {
    return Boolean(node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`));
}

function getNormalizedText(node: Element): string {
    return node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function scheduleFootnoteRelayout() {
    if (footnoteRelayoutTimer) window.clearTimeout(footnoteRelayoutTimer);

    footnoteRelayoutTimer = window.setTimeout(() => {
        footnoteRelayoutTimer = undefined;
        window.dispatchEvent(new Event('resize'));
    }, 50);
}
