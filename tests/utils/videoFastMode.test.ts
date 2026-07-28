import { describe, expect, it } from 'vitest'
import { isVideoFastModeEffective } from '@/entrypoints/video/fastMode'
import { customModelString, services } from '@/entrypoints/utils/option'

describe('video FastMode effect', () => {
    it('recognizes supported built-in request paths', () => {
        expect(isVideoFastModeEffective(services.openai, {
            model: { [services.openai]: 'gpt-5-mini' },
        })).toBe(true)
        expect(isVideoFastModeEffective(services.openrouter, {
            model: { [services.openrouter]: 'openai/gpt-5' },
        })).toBe(true)
        expect(isVideoFastModeEffective(services.gemini, {
            model: { [services.gemini]: 'gemini-2.5-pro' },
        })).toBe(true)
        expect(isVideoFastModeEffective(services.claude, {
            model: { [services.claude]: 'claude-haiku-4-5' },
        })).toBe(true)
        expect(isVideoFastModeEffective(services.deepseek, {
            model: { [services.deepseek]: 'deepseek-reasoner' },
        })).toBe(true)
    })

    it('recognizes custom providers according to their transport protocol', () => {
        expect(isVideoFastModeEffective('custom_anthropic', {
            customProviders: [{
                id: 'custom_anthropic',
                name: 'Anthropic gateway',
                protocol: 'anthropic',
                url: 'https://gateway.example',
                token: '',
                model: customModelString,
                customModel: 'anthropic/claude-opus-5',
            }],
        })).toBe(true)
        expect(isVideoFastModeEffective('custom_openai', {
            customProviders: [{
                id: 'custom_openai',
                name: 'OpenAI gateway',
                protocol: 'openai',
                url: 'https://gateway.example',
                token: '',
                model: 'gpt-5.1',
                customModel: '',
            }],
        })).toBe(true)
    })

    it('treats unneeded, unknown, and unsupported request paths as inactive', () => {
        expect(isVideoFastModeEffective(services.openai, {
            model: { [services.openai]: 'gpt-4.1' },
        })).toBe(false)
        expect(isVideoFastModeEffective(services.openrouter, {
            model: { [services.openrouter]: 'anthropic/claude-opus-5' },
        })).toBe(false)
        expect(isVideoFastModeEffective(services.zhipu, {
            model: { [services.zhipu]: 'glm-4' },
        })).toBe(false)
        expect(isVideoFastModeEffective(services.google, {})).toBe(false)
    })
})
