import type { SiteProfile } from './types';

export const appleProfile: SiteProfile = {
    id: 'apple',
    domains: ['apple.com'],
    afterBilingualAppend: (_node, translationNode, appendTarget) => {
        if (!appendTarget.closest('.rf-ccard-darkbg')) return;

        const sourceText = appendTarget.querySelector<HTMLElement>('.rf-ccard-content-desccontent');
        if (sourceText) translationNode.style.color = window.getComputedStyle(sourceText).color;
    }
};
