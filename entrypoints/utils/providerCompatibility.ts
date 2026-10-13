import type { CustomProvider } from './model'
import { getCustomProviderProtocol } from './providerEndpoint'

const INDEX_TRANSLATE_RULE_ID = 2977401
const INDEX_TRANSLATE_ENDPOINT_PATTERN = '^https://index-translate\\.bilibili\\.com(:443)?/v1/(chat/completions|models)(\\?|$)'

let compatibilityReady: Promise<void> | undefined

export function isIndexTranslateEndpoint(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'https:'
            && url.hostname === 'index-translate.bilibili.com'
            && !url.port
            && !url.username
            && !url.password
            && (url.pathname === '/v1/chat/completions' || url.pathname === '/v1/models')
    } catch {
        return false
    }
}

async function installCompatibilityRule(): Promise<void> {
    if (typeof browser === 'undefined' || !browser.declarativeNetRequest?.updateSessionRules) {
        throw new Error('Index-Translate request compatibility is unavailable in this browser')
    }

    // Firefox 的运行时地址使用 UUID，不能用 manifest 中的扩展 ID 匹配请求来源。
    const initiatorDomain = new URL(browser.runtime.getURL('')).hostname
    const rule: Browser.declarativeNetRequest.Rule = {
        id: INDEX_TRANSLATE_RULE_ID,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: 'origin', operation: 'remove' }],
        },
        condition: {
            regexFilter: INDEX_TRANSLATE_ENDPOINT_PATTERN,
            isUrlFilterCaseSensitive: true,
            initiatorDomains: [initiatorDomain],
            resourceTypes: ['xmlhttprequest'],
            requestMethods: ['get', 'post'],
        },
    }

    // 会话规则随浏览器会话结束而清除；原子替换也允许设置页和后台并发初始化。
    await browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [INDEX_TRANSLATE_RULE_ID],
        addRules: [rule],
    })
}

export async function fetchWithCustomProviderCompatibility(
    provider: Pick<CustomProvider, 'protocol'> | undefined,
    url: string,
    init?: RequestInit,
): Promise<Response> {
    if (provider && getCustomProviderProtocol(provider) === 'openai' && isIndexTranslateEndpoint(url)) {
        init?.signal?.throwIfAborted()
        compatibilityReady ??= installCompatibilityRule().catch(error => {
            compatibilityReady = undefined
            throw error
        })
        await compatibilityReady
        init?.signal?.throwIfAborted()
    }
    return fetch(url, init)
}
