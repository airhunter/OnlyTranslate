import { storage } from '@wxt-dev/storage'
import { supportsTranslationOnlyMode } from './option'

const DISPLAY_MODE_MIGRATION_NOTICE_KEY = 'local:display-mode-migration-notice'
const TRANSLATION_ONLY_DISPLAY_MODE = 0
export const BILINGUAL_DISPLAY_MODE = 1

interface DisplayModeConfig {
    display?: number
    service?: string
}

export interface DisplayModeMigrationNotice {
    service: string
}

export type DisplayModeMigrationResult =
    | { status: 'none' }
    | { status: 'migrated'; notice: DisplayModeMigrationNotice }

export function applyTranslationOnlyCompatibilityMigration(
    config: DisplayModeConfig,
): DisplayModeMigrationResult {
    if (
        config.display !== TRANSLATION_ONLY_DISPLAY_MODE
        || typeof config.service !== 'string'
        || supportsTranslationOnlyMode(config.service)
    ) {
        return { status: 'none' }
    }

    config.display = BILINGUAL_DISPLAY_MODE
    return { status: 'migrated', notice: { service: config.service } }
}

export async function saveDisplayModeMigrationNotice(
    notice: DisplayModeMigrationNotice,
): Promise<void> {
    await storage.setItem(DISPLAY_MODE_MIGRATION_NOTICE_KEY, JSON.stringify(notice))
}

export async function consumeDisplayModeMigrationNotice(): Promise<DisplayModeMigrationNotice | null> {
    try {
        const value = await storage.getItem(DISPLAY_MODE_MIGRATION_NOTICE_KEY)
        if (typeof value !== 'string' || !value.trim()) return null

        const parsed = JSON.parse(value) as Partial<DisplayModeMigrationNotice>
        if (typeof parsed.service !== 'string' || supportsTranslationOnlyMode(parsed.service)) {
            await storage.removeItem(DISPLAY_MODE_MIGRATION_NOTICE_KEY)
            return null
        }

        await storage.removeItem(DISPLAY_MODE_MIGRATION_NOTICE_KEY)
        return parsed as DisplayModeMigrationNotice
    } catch (error) {
        console.warn('Failed to consume display mode migration notice:', error)
        return null
    }
}

export const displayModeMigrationInternals = {
    noticeKey: DISPLAY_MODE_MIGRATION_NOTICE_KEY,
}
