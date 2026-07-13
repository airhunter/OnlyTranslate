export function buildSubtitleTrackKey(url: string, pageUrl: string = window.location.href): string {
    try {
        const parsed = new URL(url, pageUrl)
        if (parsed.pathname.includes('/api/timedtext')) {
            const page = new URL(pageUrl)
            return [
                'youtube',
                parsed.searchParams.get('v') || page.searchParams.get('v') || page.pathname,
                parsed.searchParams.get('lang') || '',
                parsed.searchParams.get('kind') || '',
                parsed.searchParams.get('name') || '',
                parsed.searchParams.get('tlang') || '',
            ].join('|')
        }

        parsed.hash = ''
        parsed.searchParams.sort()
        return `resource|${parsed.href}`
    } catch {
        return `resource|${url}`
    }
}

export function isSubtitleTrackForPage(url: string, pageUrl: string = window.location.href): boolean {
    try {
        const subtitleUrl = new URL(url, pageUrl)
        if (!subtitleUrl.pathname.includes('/api/timedtext')) return true

        const page = new URL(pageUrl)
        const pageVideoId = page.searchParams.get('v')
        const subtitleVideoId = subtitleUrl.searchParams.get('v')
        return !pageVideoId || !subtitleVideoId || pageVideoId === subtitleVideoId
    } catch {
        return true
    }
}
