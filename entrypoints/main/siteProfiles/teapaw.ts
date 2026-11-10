import type { SiteProfile } from './types';

const ANNOUNCEMENT = 'main .landing-page > aside.home-announce';
const ANNOUNCEMENT_TARGET = `${ANNOUNCEMENT} > strong, ${ANNOUNCEMENT} > p`;

export const teapawProfile: SiteProfile = {
    id: 'teapaw',
    domains: ['teapaw.org'],
    supplemental: root => location.pathname === '/'
        ? Array.from(root.querySelectorAll(ANNOUNCEMENT_TARGET))
        : [],
    preserveSupplementalTargets: true,
    allowTarget: node => {
        if (location.pathname !== '/' || !node.matches(ANNOUNCEMENT_TARGET)) return false;
        return {
            target: node,
            role: node.matches('strong') ? 'title' : 'paragraph',
            reason: 'teapaw-home-announcement'
        };
    }
};
