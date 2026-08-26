import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from '@/entrypoints/utils/model'
import { customModelString, services } from '@/entrypoints/utils/option'

vi.mock('@/entrypoints/utils/tip', () => ({
    sendErrorMessage: vi.fn(),
    sendSuccessMessage: vi.fn(),
}))

let runtimeConfig: Config
let checkConfig: () => boolean
let contentPostHandler: (text: unknown) => string
let sendErrorMessage: (message: string) => void

describe('checkConfig', () => {
    beforeAll(async () => {
        vi.stubGlobal('storage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            watch: vi.fn(),
        })

        const configModule = await import('@/entrypoints/utils/config')
        const checkModule = await import('@/entrypoints/utils/check')
        const tipModule = await import('@/entrypoints/utils/tip')

        runtimeConfig = configModule.config
        checkConfig = checkModule.checkConfig
        contentPostHandler = checkModule.contentPostHandler
        sendErrorMessage = vi.mocked(tipModule.sendErrorMessage)
    })

    afterAll(() => {
        vi.unstubAllGlobals()
    })

    beforeEach(() => {
        Object.assign(runtimeConfig, new Config())
        vi.clearAllMocks()
    })

    it('accepts dynamic custom providers that do not require a token', () => {
        runtimeConfig.service = 'custom_123'
        runtimeConfig.customProviders = [{
            id: 'custom_123',
            name: 'Local gateway',
            url: 'http://localhost:11434/v1/chat/completions',
            token: '',
            model: 'qwen2.5',
            customModel: ''
        }]

        expect(checkConfig()).toBe(true)
        expect(sendErrorMessage).not.toHaveBeenCalled()
    })

    it('uses the custom provider model when validating custom model settings', () => {
        runtimeConfig.service = 'custom_123'
        runtimeConfig.customProviders = [{
            id: 'custom_123',
            name: 'Local gateway',
            url: 'http://localhost:11434/v1/chat/completions',
            token: '',
            model: customModelString,
            customModel: ''
        }]

        expect(checkConfig()).toBe(false)
        expect(sendErrorMessage).toHaveBeenCalled()
    })

    it('still rejects token-based built-in services without a token', () => {
        runtimeConfig.service = services.openai
        runtimeConfig.model[services.openai] = 'gpt-5-mini'

        expect(checkConfig()).toBe(false)
        expect(sendErrorMessage).toHaveBeenCalled()
    })

    it('rejects translation-only mode for Microsoft', () => {
        runtimeConfig.service = services.microsoft
        runtimeConfig.display = 0

        expect(checkConfig()).toBe(false)
        expect(sendErrorMessage).toHaveBeenCalledWith(expect.stringContaining('translation-only'))
    })

    it('allows translation-only mode for Google', () => {
        runtimeConfig.service = services.google
        runtimeConfig.display = 0

        expect(checkConfig()).toBe(true)
        expect(sendErrorMessage).not.toHaveBeenCalled()
    })

    it('allows translation-only mode for configured AI services', () => {
        runtimeConfig.service = services.openai
        runtimeConfig.token[services.openai] = 'configured-token'
        runtimeConfig.model[services.openai] = 'gpt-5-mini'
        runtimeConfig.display = 0

        expect(checkConfig()).toBe(true)
        expect(sendErrorMessage).not.toHaveBeenCalled()
    })
})

describe('contentPostHandler', () => {
    it('removes leaked LLM file separator tokens from translation output', () => {
        expect(contentPostHandler('该公司成立于 21 世纪初。<|file_separator|>')).toBe('该公司成立于 21 世纪初。')
    })
})
