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
import { TRANSLATION_PROMPT_POLICY_VERSION } from '@/entrypoints/utils/translationPrompt'

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

        cache.localSet('Hello', '你好', 'zh-Hans', {
            scene: 'selection',
            title: 'Private example title',
            surroundingText: 'Private surrounding paragraph',
        })

        const key = onlyCacheKey()
        expect(key).toContain(TRANSLATION_PROMPT_POLICY_VERSION)
        expect(key).toContain(REQUEST_POLICY_VERSION)
        expect(key).toContain('_openai_gpt-5-mini_zh-Hans_Hello')
        expect(key).not.toContain('Private example title')
        expect(key).not.toContain('Private surrounding paragraph')
    })

    it('isolates context-aware translations while reusing identical context', () => {
        mockConfig.service = 'openai'
        const riverContext = {
            scene: 'selection' as const,
            title: 'River guide',
            surroundingText: 'They sat on the bank of the river.',
        }
        const financeContext = {
            scene: 'selection' as const,
            title: 'Finance guide',
            surroundingText: 'The bank approved the loan.',
        }

        cache.localSet('bank', '河岸', 'zh-Hans', riverContext)

        expect(cache.localGet('bank', 'zh-Hans', riverContext)).toBe('河岸')
        expect(cache.localGet('bank', 'zh-Hans', financeContext)).toBeNull()
    })

    it('keeps traditional translation cache independent of prompt context', () => {
        const firstContext = { scene: 'webpage' as const, title: 'Page one' }
        const secondContext = { scene: 'webpage' as const, title: 'Page two' }

        cache.localSet('Hello', '你好', 'zh-Hans', firstContext)

        expect(cache.localGet('Hello', 'zh-Hans', secondContext)).toBe('你好')
    })

    it('isolates DeepL translations by provider context', () => {
        mockConfig.service = 'deepL'
        const firstContext = { scene: 'ebook' as const, title: 'Book A', surroundingText: 'Chapter 1' }
        const secondContext = { scene: 'ebook' as const, title: 'Book B', surroundingText: 'Chapter 1' }

        cache.localSet('draft', '草稿', 'zh-Hans', firstContext)

        expect(cache.localGet('draft', 'zh-Hans', firstContext)).toBe('草稿')
        expect(cache.localGet('draft', 'zh-Hans', secondContext)).toBeNull()
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
