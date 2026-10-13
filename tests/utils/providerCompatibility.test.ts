import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const provider = { protocol: 'openai' as const }
const endpoint = 'https://index-translate.bilibili.com/v1/chat/completions'

describe('provider request compatibility', () => {
    const fetchMock = vi.fn()
    const updateSessionRules = vi.fn()

    beforeEach(() => {
        vi.resetModules()
        fetchMock.mockReset().mockResolvedValue(new Response('{}'))
        updateSessionRules.mockReset().mockResolvedValue(undefined)
        vi.stubGlobal('fetch', fetchMock)
        vi.stubGlobal('browser', {
            runtime: { getURL: () => 'chrome-extension://onlytranslate-id/' },
            declarativeNetRequest: { updateSessionRules },
        })
    })

    afterEach(() => vi.unstubAllGlobals())

    it.each([undefined, { protocol: 'anthropic' as const }])('does not initialize compatibility without a custom OpenAI provider: %s', async nonOpenAIProvider => {
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        await fetchWithCustomProviderCompatibility(nonOpenAIProvider, endpoint)
        expect(updateSessionRules).not.toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(endpoint, undefined)
    })

    it('supports existing custom providers whose protocol defaults to OpenAI', async () => {
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        await fetchWithCustomProviderCompatibility({}, endpoint)
        expect(updateSessionRules).toHaveBeenCalledOnce()
    })

    it('installs a rule restricted to this extension, API endpoints and request types before fetching', async () => {
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        const init = { method: 'POST', body: '{"model":"index-mt-9b"}' }
        await fetchWithCustomProviderCompatibility(provider, endpoint, init)

        expect(updateSessionRules).toHaveBeenCalledOnce()
        const { addRules, removeRuleIds } = updateSessionRules.mock.calls[0][0]
        expect(removeRuleIds).toEqual([addRules[0].id])
        expect(addRules[0]).toMatchObject({
            action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] },
            condition: {
                initiatorDomains: ['onlytranslate-id'],
                resourceTypes: ['xmlhttprequest'],
                requestMethods: ['get', 'post'],
                isUrlFilterCaseSensitive: true,
            },
        })
        const pattern = new RegExp(addRules[0].condition.regexFilter)
        expect(pattern.test(endpoint)).toBe(true)
        expect(pattern.test('https://index-translate.bilibili.com:443/v1/models?limit=1')).toBe(true)
        expect(pattern.test('https://index-translate.bilibili.com/v1/models/other')).toBe(false)
        expect(pattern.test('https://index-translate.bilibili.com.evil.test/v1/models')).toBe(false)
        expect(pattern.test('https://index-translate.bilibili.com:8443/v1/models')).toBe(false)
        expect(fetchMock).toHaveBeenCalledWith(endpoint, init)
        expect(updateSessionRules.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0])
    })

    it('uses Firefox runtime UUID rather than its manifest ID', async () => {
        vi.stubGlobal('browser', {
            runtime: { id: 'onlytranslate@onlytranslate.top', getURL: () => 'moz-extension://runtime-uuid/' },
            declarativeNetRequest: { updateSessionRules },
        })
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        await fetchWithCustomProviderCompatibility(provider, endpoint)
        expect(updateSessionRules.mock.calls[0][0].addRules[0].condition.initiatorDomains).toEqual(['runtime-uuid'])
    })

    it.each([
        'https://api.openai.com/v1/chat/completions',
        'http://index-translate.bilibili.com/v1/chat/completions',
        'https://index-translate.bilibili.com:8443/v1/chat/completions',
        'https://sub.index-translate.bilibili.com/v1/chat/completions',
        'https://index-translate.bilibili.com.evil.test/v1/models',
        'https://index-translate.bilibili.com@evil.test/v1/models',
        'https://user:password@index-translate.bilibili.com/v1/models',
        'https://example.test/v1/models?next=https://index-translate.bilibili.com/v1/models',
        'https://index-translate.bilibili.com/site/translate.html',
        'https://index-translate.bilibili.com/v1/models/extra',
        'https://index-translate.bilibili.com/v1/chat/completions/extra',
        'invalid URL',
    ])('passes unrelated or lookalike endpoint %s through without installing rules', async url => {
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        vi.stubGlobal('browser', undefined)
        const init = { headers: { Authorization: 'Bearer test-token' } }
        await fetchWithCustomProviderCompatibility(provider, url, init)
        expect(updateSessionRules).not.toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(url, init)
    })

    it('shares initialization between concurrent translations and model requests', async () => {
        let complete!: () => void
        updateSessionRules.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        const requests = Promise.all([
            fetchWithCustomProviderCompatibility(provider, endpoint),
            fetchWithCustomProviderCompatibility(provider, 'https://index-translate.bilibili.com/v1/models'),
        ])
        expect(updateSessionRules).toHaveBeenCalledOnce()
        expect(fetchMock).not.toHaveBeenCalled()
        complete()
        await requests
        await fetchWithCustomProviderCompatibility(provider, endpoint)
        expect(updateSessionRules).toHaveBeenCalledOnce()
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('does not send the request when initialization fails, and permits a subsequent retry', async () => {
        updateSessionRules.mockRejectedValueOnce(new Error('rules unavailable'))
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        await expect(fetchWithCustomProviderCompatibility(provider, endpoint)).rejects.toThrow('rules unavailable')
        expect(fetchMock).not.toHaveBeenCalled()
        await fetchWithCustomProviderCompatibility(provider, endpoint)
        expect(updateSessionRules).toHaveBeenCalledTimes(2)
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('reports missing browser support instead of sending a request known to be incompatible', async () => {
        vi.stubGlobal('browser', {})
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        await expect(fetchWithCustomProviderCompatibility(provider, endpoint)).rejects.toThrow('compatibility is unavailable')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('respects cancellation before and during rule initialization', async () => {
        const { fetchWithCustomProviderCompatibility } = await import('@/entrypoints/utils/providerCompatibility')
        const aborted = new AbortController()
        aborted.abort()
        await expect(fetchWithCustomProviderCompatibility(provider, endpoint, { signal: aborted.signal })).rejects.toMatchObject({ name: 'AbortError' })
        expect(updateSessionRules).not.toHaveBeenCalled()

        let complete!: () => void
        updateSessionRules.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
        const controller = new AbortController()
        const request = fetchWithCustomProviderCompatibility(provider, endpoint, { signal: controller.signal })
        controller.abort()
        complete()
        await expect(request).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
