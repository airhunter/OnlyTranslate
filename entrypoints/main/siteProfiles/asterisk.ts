import type { SiteProfile } from './types';

const FOOTNOTE_TRANSLATION_CLASS = 'only-translate-asterisk-footnote';

let footnoteRelayoutTimer: number | undefined;

export const asteriskProfile: SiteProfile = {
    id: 'asterisk',
    domains: ['asteriskmag.com'],
    afterBilingualAppend: (_node, translationNode, appendTarget) => {
        if (!appendTarget.closest('.footnotes-list li')) return;

        translationNode.classList.add(FOOTNOTE_TRANSLATION_CLASS);
        scheduleFootnoteRelayout();
    }
};

function scheduleFootnoteRelayout() {
    if (footnoteRelayoutTimer) window.clearTimeout(footnoteRelayoutTimer);

    footnoteRelayoutTimer = window.setTimeout(() => {
        footnoteRelayoutTimer = undefined;
        window.dispatchEvent(new Event('resize'));
    }, 50);
}
