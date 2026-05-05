import { findMatchingElement } from '@/entrypoints/utils/common';
import type { SiteProfile } from './types';

export const cnnProfile: SiteProfile = {
    id: 'cnn',
    domains: ['cnn.com'],
    select: (node) => {
        const headline = findMatchingElement(
            node,
            [
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
