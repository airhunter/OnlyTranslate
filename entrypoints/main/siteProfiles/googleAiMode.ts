import type { SiteProfile } from './types';

const ANSWER_BLOCK_SELECTOR = '.Zkbeff div.n6owBd.awi2gc, .Zkbeff li.Z1qcYe';

function isAiModePage(): boolean {
    return new URLSearchParams(location.search).get('udm') === '50';
}

function isAnswerBlock(node: Element): boolean {
    return isAiModePage() && node.matches(ANSWER_BLOCK_SELECTOR) && Boolean(node.textContent?.trim());
}

export const googleAiModeProfile: SiteProfile = {
    id: 'google-ai-mode',
    domains: ['google.com'],
    select: node => isAnswerBlock(node) ? node : false,
    supplemental: (root, context) => {
        if (context.mode !== 'smart' || !isAiModePage()) return [];
        return Array.from(root.querySelectorAll<Element>(ANSWER_BLOCK_SELECTOR)).filter(isAnswerBlock);
    },
    preserveSupplementalTargets: true,
    allowTarget: node => isAnswerBlock(node)
        ? { target: node, role: 'paragraph', reason: 'google-ai-answer-block' }
        : false,
    allowOversizedMarkup: isAnswerBlock,
    expandTarget: node => {
        if (!isAiModePage() || node.closest('.notranslate')) return false;
        const block = node.closest(ANSWER_BLOCK_SELECTOR);
        return block && block !== node && isAnswerBlock(block) ? [block] : false;
    },
    excludeFromText: node => isAiModePage()
        && node.matches('.notranslate')
        && Boolean(node.closest(ANSWER_BLOCK_SELECTOR))
};
