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
  BILINGUAL_DISPLAY_MODE,
  applyTranslationOnlyCompatibilityMigration,
  consumeDisplayModeMigrationNotice,
  displayModeMigrationInternals,
  saveDisplayModeMigrationNotice,
} from '@/entrypoints/utils/displayModeMigration'
import { services } from '@/entrypoints/utils/option'

describe('translation-only compatibility migration', () => {
  beforeEach(() => {
    storageState.clear()
    vi.clearAllMocks()
  })

  it('migrates Microsoft from translation-only to bilingual mode', () => {
    const config = { service: services.microsoft, display: 0 }

    expect(applyTranslationOnlyCompatibilityMigration(config)).toEqual({
      status: 'migrated',
      notice: { service: services.microsoft },
    })
    expect(config.display).toBe(BILINGUAL_DISPLAY_MODE)
    expect(applyTranslationOnlyCompatibilityMigration(config)).toEqual({ status: 'none' })
  })

  it('leaves supported services and existing bilingual mode untouched', () => {
    const aiConfig = { service: services.openai, display: 0 }
    const googleConfig = { service: services.google, display: 0 }
    const microsoftConfig = { service: services.microsoft, display: 1 }

    expect(applyTranslationOnlyCompatibilityMigration(aiConfig)).toEqual({ status: 'none' })
    expect(aiConfig.display).toBe(0)
    expect(applyTranslationOnlyCompatibilityMigration(googleConfig)).toEqual({ status: 'none' })
    expect(googleConfig.display).toBe(0)
    expect(applyTranslationOnlyCompatibilityMigration(microsoftConfig)).toEqual({ status: 'none' })
    expect(microsoftConfig.display).toBe(1)
  })

  it('stores and consumes the migration notice exactly once', async () => {
    const notice = { service: services.microsoft }
    await saveDisplayModeMigrationNotice(notice)

    expect(storageState.get(displayModeMigrationInternals.noticeKey)).toBe(JSON.stringify(notice))
    await expect(consumeDisplayModeMigrationNotice()).resolves.toEqual(notice)
    await expect(consumeDisplayModeMigrationNotice()).resolves.toBeNull()
  })

  it('discards malformed or no-longer-relevant notices', async () => {
    storageState.set(displayModeMigrationInternals.noticeKey, JSON.stringify({ service: services.openai }))

    await expect(consumeDisplayModeMigrationNotice()).resolves.toBeNull()
    expect(storageState.has(displayModeMigrationInternals.noticeKey)).toBe(false)
  })
})
