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
                'h2.headline__text',
                '.headline__text',
                '.container__headline',
                '.container__headline-text',
                '.card__headline',
                '.card__headline-text',
                '[class*="container_"][class*="headline"]',
                '[class*="card_"][class*="headline"]',
                '[data-component-name*="headline"]',
                '.hero__headline',
                '.homepage__headline',
                '.homepage1__headline',
                '.lead__headline',
                '.zone__headline',
                '[class*="hero"] [class*="headline"]',
                '[class*="lead"] [class*="headline"]',
                '.container__title_url-text[data-editable="title"]',
                '[class*="container_"][class*="title_url-text"][data-editable="title"]',
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
