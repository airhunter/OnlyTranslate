import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const cnnProfile: SiteProfile = {
    id: 'cnn',
    domains: ['cnn.com'],
    select: (node, context) => {
        if (
            context.mode === 'smart'
            && node.closest('.layout-live-story-amplify__left, .layout-live-story-amplify__right, .layout-live-story-amplify__end')
        ) {
            return { skip: true };
        }

        const headline = findMatchingElement(
            node,
            [
                '.headline_live-story__text',
                '.live-story-post__headline',
                'h1.headline__text',
                '.headline__text',
                '.container__headline-text',
                '.card__headline-text',
                '[data-editable="headline"]',
                '[data-component-name="headline"]'
            ].join(', ')
        );
        if (headline) return headline;

        const description = findMatchingElement(
            node,
            [
                '.headline_live-story__teaser',
                '.live-story-post__byline',
                '.live-story-post__content .paragraph',
                '.image__caption',
                '.container__description',
                '.card__description',
                '.headline__sub-text',
                '.article__content p',
                'p.paragraph'
            ].join(', ')
        );
        if (description) return description;

        const liveLabel = findMatchingElement(node, '.live-updates__button, .container__live-updates');
        if (liveLabel) return liveLabel;

        return false;
    }
};
