import { storage } from '@wxt-dev/storage'
import { models, services } from './option'
import { normalizeTranslationModelId } from './modelCapabilities'

const CLAUDE_MODEL_MIGRATION_NOTICE_KEY = 'local:claude-model-migration-notice'

export const CLAUDE_MODEL_MIGRATIONS = Object.freeze({
    'claude-sonnet-4-0': 'claude-sonnet-4-6',
    'claude-opus-4-1': 'claude-opus-4-8',
    'claude-3-5-haiku-latest': 'claude-haiku-4-5',
} as const)

export const CLAUDE_RETIRED_MODEL_RECOMMENDATIONS = Object.freeze({
    ...CLAUDE_MODEL_MIGRATIONS,
    'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
    'claude-opus-4-20250514': 'claude-opus-4-8',
    'claude-3-7-sonnet': 'claude-sonnet-4-6',
    'claude-3-7-sonnet-20250219': 'claude-sonnet-4-6',
    'claude-3-5-sonnet': 'claude-sonnet-4-6',
    'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
    'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
    'claude-3-5-haiku': 'claude-haiku-4-5',
    'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
    'claude-3-haiku': 'claude-haiku-4-5',
    'claude-3-haiku-20240307': 'claude-haiku-4-5',
    'claude-3-opus': 'claude-opus-4-8',
    'claude-3-opus-20240229': 'claude-opus-4-8',
    'claude-3-sonnet-20240229': 'claude-sonnet-4-6',
    'claude-2.0': 'claude-opus-4-8',
    'claude-2.1': 'claude-opus-4-8',
    'claude-1.0': 'claude-haiku-4-5',
    'claude-1.1': 'claude-haiku-4-5',
    'claude-1.2': 'claude-haiku-4-5',
    'claude-1.3': 'claude-haiku-4-5',
    'claude-instant-1.0': 'claude-haiku-4-5',
    'claude-instant-1.1': 'claude-haiku-4-5',
    'claude-instant-1.2': 'claude-haiku-4-5',
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
    const normalized = normalizeTranslationModelId(model)
    return CLAUDE_RETIRED_MODEL_RECOMMENDATIONS[
        normalized as keyof typeof CLAUDE_RETIRED_MODEL_RECOMMENDATIONS
    ]
}

export function applyRetiredClaudeModelMigration(
    config: ClaudeModelConfig,
    availableClaudeModels: readonly string[] = models.get(services.claude) || [],
): ClaudeModelMigrationResult {
    const from = config.model?.[services.claude] as RetiredClaudeModel | undefined
    const to = from ? CLAUDE_MODEL_MIGRATIONS[from] : undefined
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
            || CLAUDE_MODEL_MIGRATIONS[parsed.from as RetiredClaudeModel] !== parsed.to
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
