import type { SiteProfile } from './types';

export const simpleProfiles: SiteProfile[] = [
    {
        id: 'mvnrepository',
        domains: ['mvnrepository.com'],
        select: (node) => {
            if (node.tagName.toLowerCase() === 'div' && node.classList.contains('im-description')) return node;
            return false;
        }
    },
    {
        id: 'aozora',
        domains: ['aozora.gr.jp'],
        select: (node) => {
            if (node.tagName.toLowerCase() === 'div' && node.classList.contains('main_text')) return node;
            return false;
        }
    },
    {
        id: 'webtrees',
        domains: ['webtrees.net'],
        select: (node) => {
            if (node.tagName.toLowerCase() === 'div' && node.classList.contains('kmsg')) return node;
            return false;
        }
    }
];
