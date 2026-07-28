import { describe, expect, it } from 'vitest'
import { customModelString } from '@/entrypoints/utils/option'
import { resolveConfiguredTranslationModel } from '@/entrypoints/utils/modelSelection'

describe('configured translation model selection', () => {
    it('resolves built-in presets and custom model names without rewriting aliases', () => {
        expect(resolveConfiguredTranslationModel('claude', {
            model: { claude: 'claude-opus-5（推荐）' },
        })).toBe('claude-opus-5')

        expect(resolveConfiguredTranslationModel('claude', {
            model: { claude: customModelString },
            customModel: { claude: 'claude-3-opus' },
        })).toBe('claude-3-opus')
    })

    it('preserves custom-provider model names exactly', () => {
        expect(resolveConfiguredTranslationModel('custom_anthropic', {
            customProviders: [{
                id: 'custom_anthropic',
                model: customModelString,
                customModel: 'claude-3-5-sonnet',
            }],
        })).toBe('claude-3-5-sonnet')

        expect(resolveConfiguredTranslationModel('custom_openai', {
            customProviders: [{
                id: 'custom_openai',
                model: 'vendor/private-alias（专用）',
                customModel: '',
            }],
        })).toBe('vendor/private-alias')
    })
})
