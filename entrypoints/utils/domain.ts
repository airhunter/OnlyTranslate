export type DomainInput = string | URL | null | undefined;

export function getMainDomain(url: DomainInput): string {
    try {
        let hostname = '';

        if (typeof url === 'string') {
            const noProtocol = url.replace(/^(https?:\/\/)/, '');
            hostname = noProtocol.split('/')[0];
        } else if (url instanceof URL) {
            hostname = url.hostname;
        } else {
            return '';
        }

        if (hostname === 'twitter.com' || hostname === 'x.com'
            || hostname === 'www.twitter.com' || hostname === 'www.x.com') {
            return 'x.com';
        }

        hostname = hostname.replace(/^www\./, '');
        if (hostname === 'news.ycombinator.com') return hostname;

        const parts = hostname.split('.');
        if (parts.length >= 2) {
            if (parts.length >= 3
                && ((parts[parts.length - 2] === 'co'
                    || parts[parts.length - 2] === 'com'
                    || parts[parts.length - 2] === 'org')
                    && parts[parts.length - 1].length === 2)) {
                return parts.slice(-3).join('.');
            }

            return parts.slice(-2).join('.');
        }

        return hostname;
    } catch (error) {
        console.error('getMainDomain error:', error);
        return '';
    }
}
