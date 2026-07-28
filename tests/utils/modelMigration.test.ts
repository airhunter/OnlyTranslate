import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageState = vi.hoisted(() => new Map<string, unknown>())
const storageMocks = vi.hoisted(() => ({
    getItem: vi.fn(async (key: string) => storageState.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
        storageState.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
        storageState.delete(key)
    }),
}))

vi.mock('@wxt-dev/storage', () => ({ storage: storageMocks }))

import {
    CLAUDE_MODEL_MIGRATIONS,
    applyRetiredClaudeModelMigration,
    consumeClaudeModelMigrationNotice,
    getRetiredClaudeModelRecommendation,
    modelMigrationInternals,
    saveClaudeModelMigrationNotice,
} from '@/entrypoints/utils/modelMigration'
import { customModelString, models, services } from '@/entrypoints/utils/option'

describe('Claude preset model migration', () => {
    beforeEach(() => {
        storageState.clear()
        vi.clearAllMocks()
    })

    it('keeps every migration target in the current Claude presets', () => {
        const presets = models.get(services.claude) || []
        for (const target of Object.values(CLAUDE_MODEL_MIGRATIONS)) {
            expect(presets).toContain(target)
        }
    })

    it('exposes the reviewed provider preset lists', () => {
        expect(models.get(services.claude)).toEqual([
            'claude-haiku-4-5',
            'claude-sonnet-4-6',
            'claude-opus-4-8',
            'claude-sonnet-5',
            'claude-opus-5',
            customModelString,
        ])
        expect(models.get(services.gemini)).toEqual([
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
            customModelString,
        ])
        expect(models.get(services.openai)).not.toContain('gpt5')
        expect(models.get(services.newapi)).toContain('gpt5')
    })

    it.each(Object.entries(CLAUDE_MODEL_MIGRATIONS))(
        'migrates the exact built-in value %s to %s',
        (from, to) => {
            const config = { model: { [services.claude]: from } }

            expect(applyRetiredClaudeModelMigration(config)).toEqual({
                status: 'migrated',
                notice: { from, to },
            })
            expect(config.model[services.claude]).toBe(to)
            expect(applyRetiredClaudeModelMigration(config)).toEqual({ status: 'none' })
        },
    )

    it('leaves unknown and custom values untouched', () => {
        for (const value of ['claude-company-alias', customModelString]) {
            const config = {
                model: { [services.claude]: value },
                customModel: { [services.claude]: 'claude-sonnet-4-0' },
                customProviders: [{
                    id: 'custom_anthropic',
                    model: customModelString,
                    customModel: 'claude-opus-4-1',
                }],
            }

            expect(applyRetiredClaudeModelMigration(config)).toEqual({ status: 'none' })
            expect(config.model[services.claude]).toBe(value)
            expect(config.customModel[services.claude]).toBe('claude-sonnet-4-0')
            expect(config.customProviders[0].customModel).toBe('claude-opus-4-1')
        }
    })

    it('does not rewrite a retired value when its target is missing', () => {
        const config = { model: { [services.claude]: 'claude-opus-4-1' } }

        expect(applyRetiredClaudeModelMigration(config, ['claude-haiku-4-5'])).toEqual({
            status: 'target-missing',
            notice: {
                from: 'claude-opus-4-1',
                to: 'claude-opus-4-8',
            },
        })
        expect(config.model[services.claude]).toBe('claude-opus-4-1')
    })

    it('provides a recommendation without mutating custom model names', () => {
        expect(getRetiredClaudeModelRecommendation('claude-sonnet-4-0')).toBe('claude-sonnet-4-6')
        expect(getRetiredClaudeModelRecommendation('claude-company-alias')).toBeUndefined()
    })

    it('stores and consumes the migration notice exactly once', async () => {
        const notice = {
            from: 'claude-opus-4-1' as const,
            to: 'claude-opus-4-8',
        }
        await saveClaudeModelMigrationNotice(notice)

        expect(storageState.get(modelMigrationInternals.noticeKey)).toBe(JSON.stringify(notice))
        await expect(consumeClaudeModelMigrationNotice()).resolves.toEqual(notice)
        await expect(consumeClaudeModelMigrationNotice()).resolves.toBeNull()
    })

    it('discards malformed pending notices', async () => {
        storageState.set(modelMigrationInternals.noticeKey, JSON.stringify({
            from: 'claude-opus-4-1',
            to: 'unexpected-model',
        }))

        await expect(consumeClaudeModelMigrationNotice()).resolves.toBeNull()
        expect(storageState.has(modelMigrationInternals.noticeKey)).toBe(false)
    })
})
