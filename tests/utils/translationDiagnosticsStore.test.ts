import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageState = vi.hoisted(() => ({ items: new Map<string, unknown>() }))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: vi.fn(async (key: string) => storageState.items.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => { storageState.items.set(key, value) }),
    removeItem: vi.fn(async (key: string) => { storageState.items.delete(key) }),
  },
}))

import {
  getRecentTranslationDiagnostics,
  recordTranslationDiagnosticRequest,
  TRANSLATION_DIAGNOSTICS_STORAGE_KEY,
} from '@/entrypoints/utils/translationDiagnostics'

describe('translation diagnostics local retention', () => {
  beforeEach(() => {
    storageState.items.clear()
    vi.useRealTimers()
  })

  it('keeps only the five most recent sessions', async () => {
    vi.useFakeTimers()
    const baseTime = new Date('2026-08-09T00:00:00.000Z').getTime()
    for (let index = 0; index < 7; index += 1) {
      const timestamp = baseTime + index
      vi.setSystemTime(timestamp)
      await recordTranslationDiagnosticRequest({
        metadata: {
          sessionId: `session-${index}`,
          requestId: `request-${index}`,
          scene: 'webpage',
          startedAt: timestamp,
          queuedAt: timestamp,
          requestStartedAt: timestamp,
          attempt: 0,
        },
        service: 'deepseek',
        model: 'deepseek-chat',
        characters: 100,
        durationMs: 50,
        success: true,
      })
    }

    const sessions = await getRecentTranslationDiagnostics()
    expect(sessions).toHaveLength(5)
    expect(sessions.map(session => session.id)).toEqual([
      'session-6', 'session-5', 'session-4', 'session-3', 'session-2',
    ])
  })

  it('drops sessions older than 24 hours when they are read', async () => {
    const now = Date.now()
    storageState.items.set(TRANSLATION_DIAGNOSTICS_STORAGE_KEY, JSON.stringify([
      { id: 'old', updatedAt: now - 25 * 60 * 60 * 1000 },
      { id: 'recent', updatedAt: now - 60 * 1000 },
    ]))

    expect((await getRecentTranslationDiagnostics()).map(session => session.id)).toEqual(['recent'])
  })
})
