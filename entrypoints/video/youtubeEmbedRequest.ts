import {
    YOUTUBE_EMBED_MATCH,
    YOUTUBE_EMBED_QUERY,
} from './youtubeEmbed'

export const PREPARE_YOUTUBE_EMBED_REQUEST = 'PREPARE_YOUTUBE_EMBED_REQUEST'
const YOUTUBE_REFERER_RULE_ID = 2977402

export async function prepareYouTubeEmbedRequest() {
    // YouTube requires the embedding app's identity when the browser sends no Referer.
    // Scope the session rule to marked subframes created by this extension.
    const extensionId = new URL(browser.runtime.getURL('/')).hostname
    // Firefox's runtime hostname is a per-install UUID. Identify the product instead.
    const appIdentity = import.meta.env.BROWSER === 'firefox'
        ? browser.runtime.getManifest().homepage_url
        : `https://${extensionId}/`
    if (!appIdentity) throw new Error('Missing YouTube embed app identity')
    const rule: Browser.declarativeNetRequest.Rule = {
        id: YOUTUBE_REFERER_RULE_ID,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: 'referer', operation: 'set', value: appIdentity }],
        },
        condition: {
            urlFilter: `|${YOUTUBE_EMBED_MATCH}${YOUTUBE_EMBED_QUERY}^`,
            isUrlFilterCaseSensitive: true,
            initiatorDomains: [extensionId],
            resourceTypes: ['sub_frame'],
        },
    }
    await browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [rule.id],
        addRules: [rule],
    })
}
