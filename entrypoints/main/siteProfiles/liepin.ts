import type { SiteProfile } from './types';

const JOB_DESCRIPTION_SELECTOR = '.job-intro-container dd[data-selector="job-intro-content"]';

function isJobDetailPage(): boolean {
    return /^\/job\/\d+\.shtml$/.test(location.pathname);
}

export const liepinProfile: SiteProfile = {
    id: 'liepin',
    domains: ['liepin.com'],
    supplemental: (root) => isJobDetailPage()
        ? Array.from(root.querySelectorAll(JOB_DESCRIPTION_SELECTOR)).flatMap(description => {
            const segments = Array.from(description.querySelectorAll('[data-fr-direct-text-target="true"]'));
            return segments.length ? segments : [description];
        })
        : [],
    allowTarget: (node) => {
        if (!isJobDetailPage()) return false;
        if (!node.matches(JOB_DESCRIPTION_SELECTOR)
            && !(node.getAttribute('data-fr-direct-text-target') === 'true' && node.closest(JOB_DESCRIPTION_SELECTOR))) return false;
        return { role: 'paragraph', reason: 'liepin-job-description' };
    }
};
