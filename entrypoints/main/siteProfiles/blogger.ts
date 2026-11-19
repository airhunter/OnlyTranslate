import type { SiteProfile } from './types';

// Explicit Blogger template adaptation approved by the user.
export const bloggerProfile: SiteProfile = {
    id: 'blogger',
    domains: ['blogspot.com'],
    skipTarget: (node, context) => context.scope === 'smart' && node.closest('.sidebar .widget.Followers')
        ? { policy: 'hard-skip', role: 'ui', reason: 'blogger-followers-widget' }
        : false
};
