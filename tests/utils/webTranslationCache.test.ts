import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
    service: 'google',
    model: {
        google: '',
        openai: 'gpt-5-mini',
    } as Record<string, string>,
    customModel: {} as Record<string, string>,
    customProviders: [] as Array<{
        id: string
        model: string
        customModel: string
    }>,
    to: 'zh-Hans',
    style: 'default',
    useCache: true,
}))

vi.mock('@/entrypoints/utils/config', () => ({ config: mockConfig }))

import { cache } from '@/entrypoints/utils/cache'
import { REQUEST_POLICY_VERSION } from '@/entrypoints/utils/modelCapabilities'

function onlyCacheKey(): string {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key): key is string => Boolean(key?.startsWith('flcache_')))
    expect(keys).toHaveLength(1)
    return keys[0]
}

describe('web translation cache identity', () => {
    beforeEach(() => {
        localStorage.clear()
        mockConfig.service = 'google'
        mockConfig.model = {
            google: '',
            openai: 'gpt-5-mini',
        }
        mockConfig.customModel = {}
        mockConfig.customProviders = []
        mockConfig.to = 'zh-Hans'
        mockConfig.style = 'default'
        mockConfig.useCache = true
    })

    it('keeps the legacy key shape for non-AI services', () => {
        cache.localSet('Hello', '你好')

        expect(onlyCacheKey()).toBe([
            'flcache_',
            'default',
            'google',
            '',
            'zh-Hans',
            'Hello',
        ].join('_'))
    })

    it('includes the request policy version for AI services', () => {
        mockConfig.service = 'openai'

        cache.localSet('Hello', '你好')

        expect(onlyCacheKey()).toBe([
            'flcache_',
            REQUEST_POLICY_VERSION,
            'default',
            'openai',
            'gpt-5-mini',
            'zh-Hans',
            'Hello',
        ].join('_'))
    })

    it('misses when a custom provider changes its preset or custom model', () => {
        mockConfig.service = 'custom_openai'
        mockConfig.customProviders = [{
            id: 'custom_openai',
            model: '自定义模型',
            customModel: 'gateway-model-a',
        }]
        cache.localSet('Hello', '你好')

        mockConfig.customProviders[0].customModel = 'gateway-model-b'
        expect(cache.localGet('Hello')).toBeNull()

        mockConfig.customProviders[0].model = 'gpt-5-mini'
        expect(cache.localGet('Hello')).toBeNull()
    })
})
