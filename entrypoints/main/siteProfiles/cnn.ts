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
    },
    allowTarget: (node) => {
        const title = findMatchingElement(node, CNN_TITLE_SELECTOR);
        if (title && hasReadableCnnText(title)) {
            return {
                target: title,
                role: 'title',
                reason: 'cnn-title-or-headline'
            };
        }

        const summary = findMatchingElement(node, CNN_SUMMARY_SELECTOR);
        if (summary && hasReadableCnnText(summary)) {
            return {
                target: summary,
                role: 'summary',
                reason: 'cnn-summary-or-description'
            };
        }

        return false;
    },
    skipTarget: (node) => {
        if (!shouldSkipCnnTarget(node)) return false;

        return {
            policy: 'hard-skip',
            role: 'ui',
            reason: 'cnn-navigation-ad-or-label'
        };
    }
};

const CNN_TITLE_SELECTOR = [
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
].join(', ');

const CNN_SUMMARY_SELECTOR = [
    '.headline_live-story__teaser',
    '.live-story-post__byline',
    '.live-story-post__content .paragraph',
    '.image__caption',
    '.container__description',
    '.card__description',
    '.headline__sub-text',
    '.article__content p',
    'p.paragraph'
].join(', ');

function shouldSkipCnnTarget(node: Element): boolean {
    if (node.closest('nav, header, footer, form, button, [role="navigation"], [role="toolbar"]')) return true;
    if (node.closest('[class*="ad"], [id*="ad"], [data-component-name*="ad"], .card__label-container')) return true;
    if (node.matches('.card__label, .card__label *, .container__video-duration, .container__text-label, .image__credit')) return true;

    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return /^(ad|advertisement|video|show all|\d+:\d+|watch|listen|sign in)$/i.test(text);
}

function hasReadableCnnText(node: Element): boolean {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length >= 12 && /[A-Za-z]/.test(text) && !/^(show all|video|\d+:\d+)$/i.test(text);
}
