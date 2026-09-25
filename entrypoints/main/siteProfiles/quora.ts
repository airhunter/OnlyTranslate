import {
    BILINGUAL_CONTENT_CLASS,
    TRANSLATED_ATTR
} from '@/entrypoints/main/translationTarget/constants';
import type { SiteProfile } from './types';

const QUESTION_TITLE_SELECTOR = '#mainContent .puppeteer_test_question_title';
const ANSWER_TEXT_SELECTOR = '#mainContent .q-box.qu-pt--medium.qu-pb--medium.qu-borderBottom > .q-text p.q-text.qu-display--block.qu-wordBreak--break-word';
const COMMENT_CARD_SELECTOR = '#mainContent .q-box.qu-pt--small.qu-bg--raised';
const COMMENT_TEXT_SELECTOR = [
    'p.q-text.qu-display--block.qu-wordBreak--break-word',
    'div.q-text.qu-truncateLines--3.qu-wordBreak--break-word'
].join(', ');
const TARGET_SELECTOR = `${QUESTION_TITLE_SELECTOR}, ${ANSWER_TEXT_SELECTOR}, ${COMMENT_TEXT_SELECTOR}`;

export const quoraProfile: SiteProfile = {
    id: 'quora',
    domains: ['quora.com'],
    select: node => isQuoraReadingTarget(node) ? node : false,
    supplemental: (root, context) => context.mode === 'smart' ? getQuoraReadingTargets(root) : [],
    preserveSupplementalTargets: true,
    expandTarget: root => getQuoraReadingTargets(root),
    allowTarget: node => {
        if (!isQuoraReadingTarget(node)) return false;
        return {
            role: node.matches(QUESTION_TITLE_SELECTOR) ? 'title' : 'paragraph',
            source: 'site-profile',
            reason: 'quora-question-answer-or-comment'
        };
    },
    skipTarget: node => node.closest('.qt_read_more')
        ? { policy: 'hard-skip', role: 'ui', reason: 'quora-read-more-control' }
        : false,
    excludeFromText: node => node.matches('.qt_read_more')
};

function getQuoraReadingTargets(root: ParentNode): Element[] {
    const candidates = [
        ...(root instanceof Element && root.matches(TARGET_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<Element>(TARGET_SELECTOR))
    ];
    return candidates.filter(isQuoraReadingTarget);
}

function isQuoraReadingTarget(node: Element): boolean {
    if (node.closest(`.${BILINGUAL_CONTENT_CLASS}, [${TRANSLATED_ATTR}="true"]`)) return false;

    if (!node.matches(QUESTION_TITLE_SELECTOR) && !node.matches(ANSWER_TEXT_SELECTOR)) {
        if (!node.matches(COMMENT_TEXT_SELECTOR)) return false;
        const commentCard = node.closest(COMMENT_CARD_SELECTOR);
        if (!commentCard?.querySelector('a[href*="comment_id="]')) return false;
    }

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 12 && /[A-Za-z]/.test(text);
}
