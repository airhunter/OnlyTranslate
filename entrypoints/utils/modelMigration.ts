import { storage } from '@wxt-dev/storage'
import { models, services } from './option'

const CLAUDE_MODEL_MIGRATION_NOTICE_KEY = 'local:claude-model-migration-notice'

export const CLAUDE_MODEL_MIGRATIONS = Object.freeze({
    'claude-sonnet-4-0': 'claude-sonnet-4-6',
    'claude-opus-4-1': 'claude-opus-4-8',
    'claude-3-5-haiku-latest': 'claude-haiku-4-5',
} as const)

export type RetiredClaudeModel = keyof typeof CLAUDE_MODEL_MIGRATIONS

export interface ClaudeModelMigrationNotice {
    from: RetiredClaudeModel
    to: string
}

export type ClaudeModelMigrationResult =
    | { status: 'none' }
    | { status: 'migrated'; notice: ClaudeModelMigrationNotice }
    | { status: 'target-missing'; notice: ClaudeModelMigrationNotice }

interface ClaudeModelConfig {
    model?: Record<string, string>
}

export function getRetiredClaudeModelRecommendation(model: string): string | undefined {
    return CLAUDE_MODEL_MIGRATIONS[model as RetiredClaudeModel]
}

export function applyRetiredClaudeModelMigration(
    config: ClaudeModelConfig,
    availableClaudeModels: readonly string[] = models.get(services.claude) || [],
): ClaudeModelMigrationResult {
    const from = config.model?.[services.claude] as RetiredClaudeModel | undefined
    const to = from ? getRetiredClaudeModelRecommendation(from) : undefined
    if (!from || !to) return { status: 'none' }

    const notice = { from, to }
    if (!availableClaudeModels.includes(to)) {
        return { status: 'target-missing', notice }
    }

    config.model![services.claude] = to
    return { status: 'migrated', notice }
}

export async function saveClaudeModelMigrationNotice(
    notice: ClaudeModelMigrationNotice,
): Promise<void> {
    await storage.setItem(CLAUDE_MODEL_MIGRATION_NOTICE_KEY, JSON.stringify(notice))
}

export async function consumeClaudeModelMigrationNotice(): Promise<ClaudeModelMigrationNotice | null> {
    try {
        const value = await storage.getItem(CLAUDE_MODEL_MIGRATION_NOTICE_KEY)
        if (typeof value !== 'string' || !value.trim()) return null
        const parsed = JSON.parse(value) as Partial<ClaudeModelMigrationNotice>
        if (
            typeof parsed.from !== 'string'
            || typeof parsed.to !== 'string'
            || getRetiredClaudeModelRecommendation(parsed.from) !== parsed.to
        ) {
            await storage.removeItem(CLAUDE_MODEL_MIGRATION_NOTICE_KEY)
            return null
        }
        await storage.removeItem(CLAUDE_MODEL_MIGRATION_NOTICE_KEY)
        return parsed as ClaudeModelMigrationNotice
    } catch (error) {
        console.warn('Failed to consume Claude model migration notice:', error)
        return null
    }
}

export const modelMigrationInternals = {
    noticeKey: CLAUDE_MODEL_MIGRATION_NOTICE_KEY,
}
