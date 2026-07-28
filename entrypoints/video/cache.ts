import browser from 'webextension-polyfill'

const CACHE_KEY_PREFIX = 'onlytranslate:video-subtitle:v1:'
const CACHE_GENERATION_KEY = 'onlytranslate:video-subtitle:cache-generation-at'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000
const MAX_CACHE_BYTES = 4 * 1024 * 1024
const TARGET_CACHE_BYTES = Math.floor(3.5 * 1024 * 1024)
const MAX_CACHE_ENTRIES = 15_000
const TARGET_CACHE_ENTRIES = 13_500
const MAX_ENTRY_BYTES = 16 * 1024
const CONTEXT_SEGMENTS_PER_SIDE = 6
const SEMANTIC_GAP_SECONDS = 1
const SENSITIVE_ENDPOINT_PARAMETER = /^(?:(?:x-)?api[_-]?key|key|token|access[_-]?token|auth(?:orization)?|signature|sig|secret|password)$/i

export interface SubtitleCacheStorageArea {
    get(keys?: null | string | string[]): Promise<Record<string, unknown>>
    set(items: Record<string, unknown>): Promise<void>
    remove(keys: string | string[]): Promise<void>
}

export interface SubtitleCacheIdentity {
    trackKey: string
    title: string
    sourceLanguage?: string
    targetLanguage: string
    segmenterVersion: string | number
    contextVersion: string | number
    promptVersion: string
    mode: 'structured' | 'direct'
    service: string
    model: string
    endpoint: string
    fastMode: boolean
    promptFingerprint: string
    requestPolicyVersion?: string
    thinkingWanted?: boolean
}

export interface SubtitleCacheSegment {
    id: string
    start: number
    end: number
    sourceText: string
}

export interface SubtitleCacheHit {
    id: string
    translatedText: string
}

export interface SubtitleCacheCommit {
    id: string
    translatedText: string
}

export interface SubtitleCacheLimits {
    ttlMs: number
    maxBytes: number
    targetBytes: number
    maxEntries: number
    targetEntries: number
    maxEntryBytes: number
}

export interface CreateSubtitleCacheSessionOptions {
    identity: SubtitleCacheIdentity
    segments: SubtitleCacheSegment[]
    useCache: boolean
    incognito?: boolean
    storageArea?: SubtitleCacheStorageArea
    now?: () => number
    hashText?: (value: string) => Promise<string>
}

interface StoredSubtitleCacheEntry {
    translatedText: string
    createdAt: number
    lastAccessedAt: number
    cacheGenerationAt: number
}

interface PreparedCacheSegment {
    id: string
    storageKey: string
}

export interface SubtitleCachePruneResult {
    entries: number
    bytes: number
    removed: number
    nextExpiryAt?: number
}

export const videoSubtitleCacheDefaults: Readonly<SubtitleCacheLimits> = Object.freeze({
    ttlMs: CACHE_TTL_MS,
    maxBytes: MAX_CACHE_BYTES,
    targetBytes: TARGET_CACHE_BYTES,
    maxEntries: MAX_CACHE_ENTRIES,
    targetEntries: TARGET_CACHE_ENTRIES,
    maxEntryBytes: MAX_ENTRY_BYTES,
})

function defaultStorageArea(): SubtitleCacheStorageArea {
    return browser.storage.local as unknown as SubtitleCacheStorageArea
}

function isIncognitoContext(): boolean {
    return Boolean((browser as unknown as {
        extension?: { inIncognitoContext?: boolean }
    }).extension?.inIncognitoContext)
}

function byteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength
}

function cacheEntryBytes(key: string, entry: StoredSubtitleCacheEntry): number {
    // Counting each record as its own JSON object is slightly conservative and keeps
    // the real chrome.storage payload below the configured ceiling.
    return byteLength(JSON.stringify({ [key]: entry }))
}

function isStoredCacheEntry(value: unknown): value is StoredSubtitleCacheEntry {
    if (!value || typeof value !== 'object') return false
    const entry = value as Partial<StoredSubtitleCacheEntry>
    return typeof entry.translatedText === 'string'
        && Boolean(entry.translatedText.trim())
        && Number.isFinite(entry.createdAt)
        && Number.isFinite(entry.lastAccessedAt)
        && Number.isFinite(entry.cacheGenerationAt)
        && Number(entry.createdAt) >= 0
        && Number(entry.lastAccessedAt) >= Number(entry.createdAt)
        && Number(entry.cacheGenerationAt) >= 0
}

function cacheGenerationFrom(items: Record<string, unknown>): number {
    const generation = items[CACHE_GENERATION_KEY]
    return typeof generation === 'number' && Number.isFinite(generation) && generation >= 0
        ? generation
        : 0
}

function isExpired(entry: StoredSubtitleCacheEntry, now: number, ttlMs: number): boolean {
    return now - entry.createdAt >= ttlMs
}

function hasFutureTimestamp(entry: StoredSubtitleCacheEntry, now: number): boolean {
    return entry.createdAt > now || entry.lastAccessedAt > now
}

function cacheKeysFrom(items: Record<string, unknown>): string[] {
    return Object.keys(items).filter(key => key.startsWith(CACHE_KEY_PREFIX))
}

export function normalizeSubtitleCacheEndpoint(endpoint: string): string {
    const trimmed = String(endpoint || '').trim()
    if (!trimmed) return ''

    try {
        const url = new URL(trimmed)
        url.username = ''
        url.password = ''
        url.search = ''
        url.hash = ''
        url.protocol = url.protocol.toLowerCase()
        url.hostname = url.hostname.toLowerCase()
        if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
            url.port = ''
        }
        url.pathname = url.pathname.replace(/\/+$/, '') || '/'
        const safeParameters = [...new URL(trimmed).searchParams.entries()]
            .filter(([name]) => !SENSITIVE_ENDPOINT_PARAMETER.test(name))
            .sort(([leftName, leftValue], [rightName, rightValue]) => (
                leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue)
            ))
        for (const [name, value] of safeParameters) url.searchParams.append(name, value)
        return url.toString().replace(/\/(?=\?|$)/, '')
    } catch {
        const [base, rawQuery = ''] = trimmed.replace(/#.*$/, '').split('?', 2)
        const safeQuery = [...new URLSearchParams(rawQuery).entries()]
            .filter(([name]) => !SENSITIVE_ENDPOINT_PARAMETER.test(name))
            .sort(([leftName, leftValue], [rightName, rightValue]) => (
                leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue)
            ))
        const normalizedBase = base.replace(/\/+$/, '').toLowerCase()
        return safeQuery.length
            ? `${normalizedBase}?${new URLSearchParams(safeQuery).toString()}`
            : normalizedBase
    }
}

export async function sha256SubtitleCacheValue(value: string): Promise<string> {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) throw new Error('Web Crypto SHA-256 is unavailable')
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function segmentFingerprintPart(segment: SubtitleCacheSegment) {
    return [
        Math.round(segment.start * 1_000),
        Math.round(segment.end * 1_000),
        segment.sourceText,
    ] as const
}

function isNonSpeechMarker(text: string): boolean {
    const normalized = text.trim()
        .replace(/^[\[(\uFF08\u3010]\s*/, '')
        .replace(/\s*[\])\uFF09\u3011][.!\uFF01\u3002\u2026]*$/, '')
        .trim()
        .toLowerCase()

    if (/^[\u266A\u266B\uD83C\uDFB5\uD83C\uDFB6\s]+$/.test(normalized)) return true
    return /^(?:background\s+)?(?:music(?:\s+(?:playing|continues|starts|stops))?|applause|laughter|laughs|cheering|silence|inaudible|\u97F3\u4E50|\u97F3\u6A02|\u638C\u58F0|\u638C\u8072|\u7B11\u58F0|\u7B11\u8072|\u6B22\u547C|\u6B61\u547C|\u9759\u9ED8|\u975C\u9ED8|\u542C\u4E0D\u6E05|\u807D\u4E0D\u6E05)$/.test(normalized)
}

function semanticBounds(segments: SubtitleCacheSegment[], index: number): [number, number] {
    let start = index
    let end = index
    while (
        start > 0
        && index - start < CONTEXT_SEGMENTS_PER_SIDE
        && segments[start].start - segments[start - 1].end < SEMANTIC_GAP_SECONDS
        && !isNonSpeechMarker(segments[start].sourceText)
        && !isNonSpeechMarker(segments[start - 1].sourceText)
    ) start--
    while (
        end < segments.length - 1
        && end - index < CONTEXT_SEGMENTS_PER_SIDE
        && segments[end + 1].start - segments[end].end < SEMANTIC_GAP_SECONDS
        && !isNonSpeechMarker(segments[end].sourceText)
        && !isNonSpeechMarker(segments[end + 1].sourceText)
    ) end++
    return [start, end]
}

function buildSegmentIdentity(
    identity: SubtitleCacheIdentity,
    segments: SubtitleCacheSegment[],
    index: number,
): string {
    const [semanticStart, semanticEnd] = semanticBounds(segments, index)
    const before = segments
        .slice(Math.max(semanticStart, index - CONTEXT_SEGMENTS_PER_SIDE), index)
        .map(segmentFingerprintPart)
    const after = segments
        .slice(index + 1, Math.min(semanticEnd + 1, index + CONTEXT_SEGMENTS_PER_SIDE + 1))
        .map(segmentFingerprintPart)

    // The canonical identity only exists in memory. Storage receives the SHA-256 digest below.
    const requestPolicyIdentity = identity.requestPolicyVersion
        ? [identity.requestPolicyVersion, Boolean(identity.thinkingWanted)]
        : []
    return JSON.stringify([
        identity.trackKey,
        identity.title,
        identity.sourceLanguage || '',
        identity.targetLanguage,
        String(identity.segmenterVersion),
        String(identity.contextVersion),
        identity.promptVersion,
        identity.mode,
        identity.service,
        identity.model,
        normalizeSubtitleCacheEndpoint(identity.endpoint),
        identity.fastMode,
        ...requestPolicyIdentity,
        identity.promptFingerprint,
        segmentFingerprintPart(segments[index]),
        before,
        after,
    ])
}

async function prepareSegments(
    identity: SubtitleCacheIdentity,
    inputSegments: SubtitleCacheSegment[],
    cacheGeneration: number,
    hashText: (value: string) => Promise<string>,
): Promise<PreparedCacheSegment[]> {
    const segments = [...inputSegments].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))
    const prepared = new Array<PreparedCacheSegment>(segments.length)
    let nextIndex = 0
    const workerCount = Math.min(16, segments.length)
    const runWorker = async () => {
        while (nextIndex < segments.length) {
            const index = nextIndex++
            prepared[index] = {
                id: segments[index].id,
                storageKey: `${CACHE_KEY_PREFIX}${await hashText(JSON.stringify([
                    cacheGeneration,
                    buildSegmentIdentity(identity, segments, index),
                ]))}`,
            }
        }
    }
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
    return prepared
}

export async function pruneVideoSubtitleCache(options: {
    storageArea?: SubtitleCacheStorageArea
    now?: number
    limits?: SubtitleCacheLimits
} = {}): Promise<SubtitleCachePruneResult> {
    const storageArea = options.storageArea || defaultStorageArea()
    const limits = options.limits || videoSubtitleCacheDefaults
    const now = options.now ?? Date.now()
    const stored = await storageArea.get(null)
    const cacheGeneration = cacheGenerationFrom(stored)
    const invalidOrExpired: string[] = []
    const valid: Array<{ key: string; entry: StoredSubtitleCacheEntry; bytes: number }> = []

    for (const key of cacheKeysFrom(stored)) {
        const value = stored[key]
        if (!isStoredCacheEntry(value)
            || value.cacheGenerationAt !== cacheGeneration
            || hasFutureTimestamp(value, now)
            || isExpired(value, now, limits.ttlMs)) {
            invalidOrExpired.push(key)
            continue
        }
        const bytes = cacheEntryBytes(key, value)
        if (bytes > limits.maxEntryBytes) {
            invalidOrExpired.push(key)
            continue
        }
        valid.push({ key, entry: value, bytes })
    }

    let totalBytes = valid.reduce((sum, item) => sum + item.bytes, 0)
    const keysToRemove = [...invalidOrExpired]

    if (valid.length > limits.maxEntries || totalBytes > limits.maxBytes) {
        valid.sort((a, b) => a.entry.lastAccessedAt - b.entry.lastAccessedAt
            || a.entry.createdAt - b.entry.createdAt
            || a.key.localeCompare(b.key))
        while (valid.length > limits.targetEntries || totalBytes > limits.targetBytes) {
            const oldest = valid.shift()
            if (!oldest) break
            keysToRemove.push(oldest.key)
            totalBytes -= oldest.bytes
        }
    }

    if (keysToRemove.length) await storageArea.remove(keysToRemove)
    return {
        entries: valid.length,
        bytes: Math.max(0, totalBytes),
        removed: keysToRemove.length,
        nextExpiryAt: valid.length
            ? Math.min(...valid.map(item => item.entry.createdAt + limits.ttlMs))
            : undefined,
    }
}

export async function clearVideoSubtitleCache(
    storageArea: SubtitleCacheStorageArea = defaultStorageArea(),
): Promise<number> {
    const generationState = await storageArea.get(CACHE_GENERATION_KEY)
    const nextGeneration = Math.max(Date.now(), cacheGenerationFrom(generationState) + 1)
    await storageArea.set({ [CACHE_GENERATION_KEY]: nextGeneration })
    // Advance the generation before scanning. Any old session that writes after
    // this point will either be included below or remove its own stale write
    // after its post-write generation check.
    const stored = await storageArea.get(null)
    const keys = cacheKeysFrom(stored)
    if (keys.length) await storageArea.remove(keys)
    return keys.length
}

export class VideoSubtitleCacheSession {
    readonly enabled: boolean
    private readonly keyBySegmentId: Map<string, string>
    private readonly storageArea: SubtitleCacheStorageArea
    private readonly now: () => number
    private readonly cacheGeneration: number
    private commitQueue: Promise<void> = Promise.resolve()
    private knownEntries?: number
    private knownBytes?: number

    constructor(options: {
        enabled: boolean
        preparedSegments: PreparedCacheSegment[]
        storageArea: SubtitleCacheStorageArea
        now: () => number
        cacheGeneration: number
    }) {
        this.enabled = options.enabled
        this.keyBySegmentId = new Map(options.preparedSegments.map(segment => [segment.id, segment.storageKey]))
        this.storageArea = options.storageArea
        this.now = options.now
        this.cacheGeneration = options.cacheGeneration
    }

    async hydrate(): Promise<SubtitleCacheHit[]> {
        if (!this.enabled || this.keyBySegmentId.size === 0) return []
        const requestedKeys = [...this.keyBySegmentId.values(), CACHE_GENERATION_KEY]

        let stored: Record<string, unknown>
        try {
            stored = await this.storageArea.get(requestedKeys)
        } catch {
            return []
        }

        const now = this.now()
        if (cacheGenerationFrom(stored) !== this.cacheGeneration) return []
        const invalidOrExpired: string[] = []
        const touched: Record<string, StoredSubtitleCacheEntry> = {}
        const hits: SubtitleCacheHit[] = []

        for (const [id, key] of this.keyBySegmentId) {
            const value = stored[key]
            if (value === undefined) continue
            if (!isStoredCacheEntry(value)
                || value.cacheGenerationAt !== this.cacheGeneration
                || hasFutureTimestamp(value, now)
                || isExpired(value, now, CACHE_TTL_MS)
                || cacheEntryBytes(key, value) > MAX_ENTRY_BYTES) {
                invalidOrExpired.push(key)
                continue
            }
            hits.push({ id, translatedText: value.translatedText })
            touched[key] = { ...value, lastAccessedAt: now }
        }

        // Cache maintenance must never turn a valid hit into a playback failure.
        try {
            if (invalidOrExpired.length) await this.storageArea.remove(invalidOrExpired)
            const touchedKeys = Object.keys(touched)
            if (touchedKeys.length) {
                await this.storageArea.set(touched)
                const generationAfterWrite = await this.storageArea.get(CACHE_GENERATION_KEY)
                if (cacheGenerationFrom(generationAfterWrite) !== this.cacheGeneration) {
                    await this.storageArea.remove(touchedKeys)
                }
            }
        } catch {
            // Ignore storage quota, shutdown and browser implementation errors.
        }
        return hits
    }

    async commit(result: SubtitleCacheCommit): Promise<void> {
        await this.commitMany([result])
    }

    async commitMany(results: SubtitleCacheCommit[]): Promise<void> {
        if (!this.enabled || results.length === 0) return
        this.commitQueue = this.commitQueue
            .then(() => this.persistMany(results))
            .catch(() => undefined)
        await this.commitQueue
    }

    private async persistMany(results: SubtitleCacheCommit[]): Promise<void> {
        const now = this.now()
        const candidates = results.flatMap(result => {
            const storageKey = this.keyBySegmentId.get(result.id)
            const translatedText = result.translatedText.trim()
            return storageKey && translatedText ? [{ storageKey, translatedText }] : []
        })
        if (!candidates.length) return

        try {
            const existing = await this.storageArea.get([
                ...candidates.map(candidate => candidate.storageKey),
                CACHE_GENERATION_KEY,
            ])
            if (cacheGenerationFrom(existing) !== this.cacheGeneration) return
            const valuesToSet: Record<string, StoredSubtitleCacheEntry> = {}
            const oversizedKeys: string[] = []

            for (const candidate of candidates) {
                const previous = existing[candidate.storageKey]
                const createdAt = isStoredCacheEntry(previous)
                    && previous.cacheGenerationAt === this.cacheGeneration
                    && !hasFutureTimestamp(previous, now)
                    && !isExpired(previous, now, CACHE_TTL_MS)
                    ? previous.createdAt
                    : now
                const entry: StoredSubtitleCacheEntry = {
                    translatedText: candidate.translatedText,
                    createdAt,
                    lastAccessedAt: now,
                    cacheGenerationAt: this.cacheGeneration,
                }
                if (cacheEntryBytes(candidate.storageKey, entry) > MAX_ENTRY_BYTES) {
                    oversizedKeys.push(candidate.storageKey)
                } else {
                    valuesToSet[candidate.storageKey] = entry
                }
            }

            if (oversizedKeys.length) await this.storageArea.remove(oversizedKeys)
            const writtenKeys = Object.keys(valuesToSet)
            if (writtenKeys.length) {
                await this.storageArea.set(valuesToSet)
                const generationAfterWrite = await this.storageArea.get(CACHE_GENERATION_KEY)
                if (cacheGenerationFrom(generationAfterWrite) !== this.cacheGeneration) {
                    await this.storageArea.remove(writtenKeys)
                    return
                }
            }
            const newEntries = Object.entries(valuesToSet)
            if (this.knownEntries === undefined || this.knownBytes === undefined) {
                const pruned = await pruneVideoSubtitleCache({ storageArea: this.storageArea, now })
                this.knownEntries = pruned.entries
                this.knownBytes = pruned.bytes
            } else {
                this.knownEntries += newEntries.length
                this.knownBytes += newEntries.reduce(
                    (total, [key, entry]) => total + cacheEntryBytes(key, entry),
                    0,
                )
                if (this.knownEntries > MAX_CACHE_ENTRIES || this.knownBytes > MAX_CACHE_BYTES) {
                    const pruned = await pruneVideoSubtitleCache({ storageArea: this.storageArea, now })
                    this.knownEntries = pruned.entries
                    this.knownBytes = pruned.bytes
                }
            }
        } catch {
            // Translation remains usable in the active session when persistence fails.
        }
    }
}

export async function createVideoSubtitleCacheSession(
    options: CreateSubtitleCacheSessionOptions,
): Promise<VideoSubtitleCacheSession> {
    const storageArea = options.storageArea || defaultStorageArea()
    const enabled = options.useCache && !(options.incognito ?? isIncognitoContext())
    if (!enabled) {
        return new VideoSubtitleCacheSession({
            enabled: false,
            preparedSegments: [],
            storageArea,
            now: options.now || Date.now,
            cacheGeneration: 0,
        })
    }

    try {
        const generationState = await storageArea.get(CACHE_GENERATION_KEY)
        const cacheGeneration = cacheGenerationFrom(generationState)
        const preparedSegments = await prepareSegments(
            options.identity,
            options.segments,
            cacheGeneration,
            options.hashText || sha256SubtitleCacheValue,
        )
        return new VideoSubtitleCacheSession({
            enabled: true,
            preparedSegments,
            storageArea,
            now: options.now || Date.now,
            cacheGeneration,
        })
    } catch {
        return new VideoSubtitleCacheSession({
            enabled: false,
            preparedSegments: [],
            storageArea,
            now: options.now || Date.now,
            cacheGeneration: 0,
        })
    }
}

export const videoSubtitleCacheInternals = {
    cacheKeyPrefix: CACHE_KEY_PREFIX,
    cacheGenerationKey: CACHE_GENERATION_KEY,
    contextSegmentsPerSide: CONTEXT_SEGMENTS_PER_SIDE,
    semanticGapSeconds: SEMANTIC_GAP_SECONDS,
}
