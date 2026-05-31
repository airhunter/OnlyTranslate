import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from '@/entrypoints/utils/model'
import { customModelString, services } from '@/entrypoints/utils/option'

vi.mock('@/entrypoints/utils/tip', () => ({
    sendErrorMessage: vi.fn(),
    sendSuccessMessage: vi.fn(),
}))

let runtimeConfig: Config
let checkConfig: () => boolean
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
})
