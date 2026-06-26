import type { SiteProfile } from './types';

export const simpleProfiles: SiteProfile[] = [
    {
        id: 'mvnrepository',
        domains: ['mvnrepository.com'],
        targetSelector: 'div.im-description'
    },
    {
        id: 'aozora',
        domains: ['aozora.gr.jp'],
        targetSelector: 'div.main_text'
    },
    {
        id: 'webtrees',
        domains: ['webtrees.net'],
        targetSelector: 'div.kmsg'
    }
];
