import { describe, expect, it, vi } from 'vitest'
import {
  VideoSubtitleCacheMaintenance,
  videoSubtitleCacheMaintenanceDefaults,
  type SubtitleCacheAlarmAdapter,
} from '@/entrypoints/video/cacheMaintenance'
import type { SubtitleCachePruneResult } from '@/entrypoints/video/cache'

class FakeAlarms implements SubtitleCacheAlarmAdapter {
  createCalls: Array<{ name: string; when: number }> = []
  clearCalls: string[] = []
  current: { name: string; when: number } | undefined
  failuresRemaining = 0

  async create(name: string, alarmInfo: { when: number }): Promise<void> {
    this.createCalls.push({ name, when: alarmInfo.when })
    if (this.failuresRemaining > 0) {
      this.failuresRemaining--
      throw new Error('alarm unavailable')
    }
    this.current = { name, when: alarmInfo.when }
  }

  async clear(name: string): Promise<boolean> {
    this.clearCalls.push(name)
    const removed = this.current?.name === name
    if (removed) this.current = undefined
    return removed
  }
}

const result = (nextExpiryAt?: number): SubtitleCachePruneResult => ({
  entries: nextExpiryAt === undefined ? 0 : 1,
  bytes: nextExpiryAt === undefined ? 0 : 100,
  removed: 0,
  nextExpiryAt,
})

function createMaintenance(options: {
  alarms: FakeAlarms
  prune: () => Promise<SubtitleCachePruneResult>
  now: () => number
  onError?: (error: unknown) => void
}) {
  return new VideoSubtitleCacheMaintenance({
    ...options,
    cacheKeyPrefix: 'onlytranslate:video-subtitle:v1:',
    writeSettleMs: 30_000,
    retryBaseMs: 100,
    retryMaxMs: 400,
  })
}

describe('video subtitle cache maintenance coordinator', () => {
  it('does not postpone an already earlier alarm when more writes arrive', async () => {
    let now = 1_000
    const alarms = new FakeAlarms()
    const maintenance = createMaintenance({
      alarms,
      prune: vi.fn(async () => result(100_000)),
      now: () => now,
    })

    await maintenance.runNow()
    expect(alarms.current?.when).toBe(100_000)

    expect(maintenance.handleStorageChanges({
      'onlytranslate:video-subtitle:v1:first': { newValue: { translatedText: 'one' } },
    }, 'local')).toBe(true)
    await vi.waitFor(() => expect(alarms.current?.when).toBe(31_000))

    now = 2_000
    expect(maintenance.handleStorageChanges({
      'onlytranslate:video-subtitle:v1:second': { newValue: { translatedText: 'two' } },
    }, 'local')).toBe(true)
    await Promise.resolve()
    expect(alarms.createCalls.map(call => call.when)).toEqual([100_000, 31_000])
  })

  it('runs prune again when a write arrives during maintenance', async () => {
    let releaseFirst!: (value: SubtitleCachePruneResult) => void
    const firstPrune = new Promise<SubtitleCachePruneResult>(resolve => {
      releaseFirst = resolve
    })
    const alarms = new FakeAlarms()
    const prune = vi.fn()
      .mockReturnValueOnce(firstPrune)
      .mockResolvedValueOnce(result(200_000))
    const maintenance = createMaintenance({ alarms, prune, now: () => 1_000 })

    const running = maintenance.runNow()
    maintenance.handleStorageChanges({
      'onlytranslate:video-subtitle:v1:during-run': { newValue: { translatedText: 'new' } },
    }, 'local')
    releaseFirst(result(100_000))
    await running

    expect(prune).toHaveBeenCalledTimes(2)
    expect(alarms.current?.when).toBe(200_000)
  })

  it('ignores removals, unrelated keys and non-local storage changes', () => {
    const alarms = new FakeAlarms()
    const maintenance = createMaintenance({
      alarms,
      prune: vi.fn(async () => result()),
      now: () => 1_000,
    })

    expect(maintenance.handleStorageChanges({
      'onlytranslate:video-subtitle:v1:removed': { newValue: undefined },
    }, 'local')).toBe(false)
    expect(maintenance.handleStorageChanges({ config: { newValue: {} } }, 'local')).toBe(false)
    expect(maintenance.handleStorageChanges({
      'onlytranslate:video-subtitle:v1:sync': { newValue: {} },
    }, 'sync')).toBe(false)
    expect(alarms.createCalls).toEqual([])
  })

  it('uses a bounded retry alarm after prune fails and resets after recovery', async () => {
    let now = 1_000
    const alarms = new FakeAlarms()
    const onError = vi.fn()
    const prune = vi.fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(result(5_000))
    const maintenance = createMaintenance({ alarms, prune, now: () => now, onError })

    await maintenance.runNow()
    expect(alarms.current?.when).toBe(1_100)
    expect(onError).toHaveBeenCalledTimes(1)

    now = 1_100
    await maintenance.handleAlarm(videoSubtitleCacheMaintenanceDefaults.alarmName)
    expect(alarms.current?.when).toBe(5_000)
    expect(prune).toHaveBeenCalledTimes(2)
  })

  it('retries alarm creation a bounded number of times before scheduling recovery', async () => {
    const alarms = new FakeAlarms()
    alarms.failuresRemaining = videoSubtitleCacheMaintenanceDefaults.alarmCreateAttempts
    const onError = vi.fn()
    const maintenance = createMaintenance({
      alarms,
      prune: vi.fn(async () => result(5_000)),
      now: () => 1_000,
      onError,
    })

    await maintenance.runNow()

    expect(alarms.createCalls).toHaveLength(
      videoSubtitleCacheMaintenanceDefaults.alarmCreateAttempts + 1,
    )
    expect(alarms.current?.when).toBe(1_100)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
