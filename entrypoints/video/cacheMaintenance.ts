import type { SubtitleCachePruneResult } from './cache'

const DEFAULT_ALARM_NAME = 'onlytranslate-video-subtitle-cache-maintenance'
const DEFAULT_WRITE_SETTLE_MS = 30_000
const DEFAULT_RETRY_BASE_MS = 30_000
const DEFAULT_RETRY_MAX_MS = 5 * 60_000
const ALARM_CREATE_ATTEMPTS = 3

export interface SubtitleCacheAlarmAdapter {
    create(name: string, alarmInfo: { when: number }): Promise<void>
    clear(name: string): Promise<boolean>
}

export interface VideoSubtitleCacheMaintenanceOptions {
    alarms: SubtitleCacheAlarmAdapter
    prune: () => Promise<SubtitleCachePruneResult>
    cacheKeyPrefix: string
    now?: () => number
    onError?: (error: unknown) => void
    alarmName?: string
    writeSettleMs?: number
    retryBaseMs?: number
    retryMaxMs?: number
}

export class VideoSubtitleCacheMaintenance {
    private readonly alarms: SubtitleCacheAlarmAdapter
    private readonly prune: () => Promise<SubtitleCachePruneResult>
    private readonly cacheKeyPrefix: string
    private readonly now: () => number
    private readonly onError?: (error: unknown) => void
    private readonly alarmName: string
    private readonly writeSettleMs: number
    private readonly retryBaseMs: number
    private readonly retryMaxMs: number
    private scheduledAt = Number.POSITIVE_INFINITY
    private running: Promise<void> | null = null
    private rerunRequested = false
    private failureCount = 0

    constructor(options: VideoSubtitleCacheMaintenanceOptions) {
        this.alarms = options.alarms
        this.prune = options.prune
        this.cacheKeyPrefix = options.cacheKeyPrefix
        this.now = options.now || Date.now
        this.onError = options.onError
        this.alarmName = options.alarmName || DEFAULT_ALARM_NAME
        this.writeSettleMs = options.writeSettleMs ?? DEFAULT_WRITE_SETTLE_MS
        this.retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS
        this.retryMaxMs = options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS
    }

    handleStorageChanges(
        changes: Record<string, { newValue?: unknown }>,
        areaName: string,
    ): boolean {
        if (areaName !== 'local') return false
        const hasCacheWrite = Object.entries(changes).some(([key, change]) => (
            key.startsWith(this.cacheKeyPrefix) && change.newValue !== undefined
        ))
        if (!hasCacheWrite) return false

        if (this.running) this.rerunRequested = true
        this.scheduleEarlier(this.now() + this.writeSettleMs)
        return true
    }

    async handleAlarm(name: string): Promise<boolean> {
        if (name !== this.alarmName) return false
        this.scheduledAt = Number.POSITIVE_INFINITY
        await this.runNow()
        return true
    }

    runNow(): Promise<void> {
        if (this.running) {
            this.rerunRequested = true
            return this.running
        }

        const operation = this.performMaintenance()
        this.running = operation.finally(() => {
            this.running = null
            if (this.rerunRequested) void this.runNow()
        })
        return this.running
    }

    private async performMaintenance(): Promise<void> {
        try {
            let result: SubtitleCachePruneResult
            do {
                this.rerunRequested = false
                result = await this.prune()
            } while (this.rerunRequested)

            if (result.nextExpiryAt === undefined) {
                this.scheduledAt = Number.POSITIVE_INFINITY
                await this.alarms.clear(this.alarmName)
            } else {
                const expiryAt = Math.max(this.now() + 1_000, result.nextExpiryAt)
                await this.replaceAlarm(expiryAt)
            }
            this.failureCount = 0
        } catch (error) {
            this.reportError(error)
            this.failureCount++
            const retryDelay = Math.min(
                this.retryBaseMs * (2 ** Math.max(0, this.failureCount - 1)),
                this.retryMaxMs,
            )
            try {
                await this.replaceAlarm(this.now() + retryDelay)
            } catch (retryError) {
                this.scheduledAt = Number.POSITIVE_INFINITY
                this.reportError(retryError)
            }
        }
    }

    private scheduleEarlier(when: number) {
        if (when >= this.scheduledAt) return
        this.scheduledAt = when
        void this.createAlarm(when).catch(error => {
            if (this.scheduledAt === when) this.scheduledAt = Number.POSITIVE_INFINITY
            this.reportError(error)
            void this.runNow()
        })
    }

    private async replaceAlarm(when: number): Promise<void> {
        this.scheduledAt = when
        try {
            await this.createAlarm(when)
        } catch (error) {
            if (this.scheduledAt === when) this.scheduledAt = Number.POSITIVE_INFINITY
            throw error
        }
    }

    private async createAlarm(when: number): Promise<void> {
        let lastError: unknown
        for (let attempt = 0; attempt < ALARM_CREATE_ATTEMPTS; attempt++) {
            try {
                await this.alarms.create(this.alarmName, { when })
                return
            } catch (error) {
                lastError = error
            }
        }
        throw lastError || new Error('Failed to create video subtitle cache maintenance alarm')
    }

    private reportError(error: unknown) {
        try {
            this.onError?.(error)
        } catch {
            // Reporting must not disable future cache maintenance.
        }
    }
}

export const videoSubtitleCacheMaintenanceDefaults = {
    alarmName: DEFAULT_ALARM_NAME,
    writeSettleMs: DEFAULT_WRITE_SETTLE_MS,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    retryMaxMs: DEFAULT_RETRY_MAX_MS,
    alarmCreateAttempts: ALARM_CREATE_ATTEMPTS,
}
