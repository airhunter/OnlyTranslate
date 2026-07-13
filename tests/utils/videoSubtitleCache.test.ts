import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('webextension-polyfill', () => ({
    default: {
        extension: { inIncognitoContext: false },
        storage: { local: {} },
    },
}))

import {
    clearVideoSubtitleCache,
    createVideoSubtitleCacheSession,
    normalizeSubtitleCacheEndpoint,
    pruneVideoSubtitleCache,
    sha256SubtitleCacheValue,
    videoSubtitleCacheDefaults,
    videoSubtitleCacheInternals,
    type SubtitleCacheIdentity,
    type SubtitleCacheStorageArea,
} from '@/entrypoints/video/cache'

class MemoryStorage implements SubtitleCacheStorageArea {
    data: Record<string, unknown> = {}
    getCalls = 0
    setCalls = 0
    removeCalls = 0

    async get(keys: null | string | string[] = null): Promise<Record<string, unknown>> {
        this.getCalls++
        if (keys === null) return { ...this.data }
        const requested = typeof keys === 'string' ? [keys] : keys
        return Object.fromEntries(requested
            .filter(key => key in this.data)
            .map(key => [key, this.data[key]]))
    }

    async set(items: Record<string, unknown>): Promise<void> {
        this.setCalls++
        Object.assign(this.data, items)
    }

    async remove(keys: string | string[]): Promise<void> {
        this.removeCalls++
        for (const key of typeof keys === 'string' ? [keys] : keys) delete this.data[key]
    }

    cacheKeys(): string[] {
        return Object.keys(this.data).filter(key => key.startsWith(videoSubtitleCacheInternals.cacheKeyPrefix))
    }
}

const baseIdentity: SubtitleCacheIdentity = {
    trackKey: 'youtube:secret-video:en:asr',
    title: 'Private video title',
    sourceLanguage: 'en',
    targetLanguage: 'zh-Hans',
    segmenterVersion: 2,
    contextVersion: 1,
    promptVersion: 'subtitle-context-v1',
    mode: 'structured',
    service: 'openai',
    model: 'gpt-5-mini',
    endpoint: 'HTTPS://API.Example.com:443/v1/chat/completions/?api_key=secret#fragment',
    fastMode: true,
    promptFingerprint: 'private-prompt-fingerprint',
}

const baseSegments = [
    { id: 's1', start: 10, end: 12, sourceText: 'Before context' },
    { id: 's2', start: 12.1, end: 14, sourceText: 'Target sentence' },
    { id: 's3', start: 14.1, end: 16, sourceText: 'After context' },
]

async function createSession(options: {
    storage: MemoryStorage
    identity?: SubtitleCacheIdentity
    segments?: typeof baseSegments
    useCache?: boolean
    incognito?: boolean
    now?: () => number
}) {
    return createVideoSubtitleCacheSession({
        identity: options.identity || baseIdentity,
        segments: options.segments || baseSegments,
        useCache: options.useCache ?? true,
        incognito: options.incognito ?? false,
        storageArea: options.storage,
        now: options.now,
    })
}

describe('video subtitle persistent cache', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('uses SHA-256 keys without storing source identity in plaintext', async () => {
        expect(await sha256SubtitleCacheValue('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        )
        const storage = new MemoryStorage()
        const session = await createSession({ storage })

        await session.commit({ id: 's2', translatedText: '目标译文' })

        const [key] = storage.cacheKeys()
        expect(key).toMatch(/^onlytranslate:video-subtitle:v1:[a-f0-9]{64}$/)
        expect(key).not.toContain('secret-video')
        expect(key).not.toContain('Target sentence')
        expect(key).not.toContain('api_key')
        expect(JSON.stringify(storage.data[key])).not.toContain('Private video title')
        expect(storage.data[key]).toEqual({
            translatedText: '目标译文',
            createdAt: expect.any(Number),
            lastAccessedAt: expect.any(Number),
            cacheGenerationAt: 0,
        })
    })

    it('hydrates translations across sessions and only updates LRU access time', async () => {
        const storage = new MemoryStorage()
        let now = 1_000
        const first = await createSession({ storage, now: () => now })
        await first.commit({ id: 's2', translatedText: '目标译文' })
        const key = storage.cacheKeys()[0]

        now = 2_000
        const second = await createSession({ storage, now: () => now })
        expect(await second.hydrate()).toEqual([{ id: 's2', translatedText: '目标译文' }])
        expect(storage.data[key]).toEqual({
            translatedText: '目标译文',
            createdAt: 1_000,
            lastAccessedAt: 2_000,
            cacheGenerationAt: 0,
        })
    })

    it('bypasses all hashing and storage when cache is disabled or context is incognito', async () => {
        for (const options of [
            { useCache: false, incognito: false },
            { useCache: true, incognito: true },
        ]) {
            const storage = new MemoryStorage()
            const hashText = vi.fn(async () => 'hash')
            const session = await createVideoSubtitleCacheSession({
                identity: baseIdentity,
                segments: baseSegments,
                storageArea: storage,
                hashText,
                ...options,
            })
            expect(session.enabled).toBe(false)
            expect(await session.hydrate()).toEqual([])
            await session.commit({ id: 's2', translatedText: '不会保存' })
            expect(hashText).not.toHaveBeenCalled()
            expect(storage.getCalls).toBe(0)
            expect(storage.setCalls).toBe(0)
        }
    })

    it('expires after 30 days from creation even when an earlier hit updated LRU', async () => {
        const storage = new MemoryStorage()
        let now = 1_000
        const first = await createSession({ storage, now: () => now })
        await first.commit({ id: 's2', translatedText: '目标译文' })

        now += videoSubtitleCacheDefaults.ttlMs - 1
        const beforeExpiry = await createSession({ storage, now: () => now })
        expect(await beforeExpiry.hydrate()).toHaveLength(1)

        now = 1_000 + videoSubtitleCacheDefaults.ttlMs
        const expired = await createSession({ storage, now: () => now })
        expect(await expired.hydrate()).toEqual([])
        expect(storage.cacheKeys()).toEqual([])
    })

    it('misses when any runtime identity field or nearby context changes', async () => {
        const storage = new MemoryStorage()
        const first = await createSession({ storage })
        await first.commit({ id: 's2', translatedText: '目标译文' })

        expect(await (await createSession({
            storage,
            identity: {
                ...baseIdentity,
                endpoint: 'https://api.example.com/v1/chat/completions?api_key=rotated-secret',
            },
        })).hydrate()).toContainEqual({ id: 's2', translatedText: '目标译文' })

        const variants: SubtitleCacheIdentity[] = [
            { ...baseIdentity, trackKey: 'other-track' },
            { ...baseIdentity, title: 'Other title' },
            { ...baseIdentity, sourceLanguage: 'fr' },
            { ...baseIdentity, targetLanguage: 'ja' },
            { ...baseIdentity, segmenterVersion: 3 },
            { ...baseIdentity, contextVersion: 2 },
            { ...baseIdentity, promptVersion: 'v2' },
            { ...baseIdentity, mode: 'direct' },
            { ...baseIdentity, service: 'claude' },
            { ...baseIdentity, model: 'other-model' },
            { ...baseIdentity, endpoint: 'https://other.example/v1' },
            { ...baseIdentity, endpoint: 'https://api.example.com/v1/chat/completions?api-version=2026-01-01' },
            { ...baseIdentity, fastMode: false },
            { ...baseIdentity, promptFingerprint: 'other-prompt' },
        ]
        for (const identity of variants) {
            expect(await (await createSession({ storage, identity })).hydrate()).toEqual([])
        }

        const changedContext = baseSegments.map(segment => segment.id === 's1'
            ? { ...segment, sourceText: 'Different nearby context' }
            : segment)
        expect(await (await createSession({ storage, segments: changedContext })).hydrate()).toEqual([])
    })

    it('limits context fingerprints to six neighbours in the same semantic interval', async () => {
        const storage = new MemoryStorage()
        const segments = Array.from({ length: 15 }, (_, index) => ({
            id: `s${index}`,
            start: index * 0.5,
            end: index * 0.5 + 0.4,
            sourceText: `line ${index}`,
        }))
        const first = await createSession({ storage, segments })
        await first.commit({ id: 's7', translatedText: '中间译文' })

        const outsideWindow = segments.map((segment, index) => index === 0
            ? { ...segment, sourceText: 'changed outside six neighbours' }
            : segment)
        expect(await (await createSession({ storage, segments: outsideWindow })).hydrate())
            .toContainEqual({ id: 's7', translatedText: '中间译文' })

        const insideWindow = segments.map((segment, index) => index === 1
            ? { ...segment, sourceText: 'changed inside six neighbours' }
            : segment)
        expect(await (await createSession({ storage, segments: insideWindow })).hydrate())
            .not.toContainEqual({ id: 's7', translatedText: '中间译文' })
    })

    it('does not fingerprint source context across a non-speech marker', async () => {
        const storage = new MemoryStorage()
        const segments = [
            { id: 'before', start: 0, end: 1, sourceText: 'Earlier dialogue' },
            { id: 'marker', start: 1, end: 2, sourceText: '[Music]' },
            { id: 'target', start: 2, end: 3, sourceText: 'Current dialogue' },
            { id: 'after', start: 3, end: 4, sourceText: 'Following dialogue' },
        ]
        const first = await createSession({ storage, segments })
        await first.commit({ id: 'target', translatedText: 'cached target' })

        const changedAcrossMarker = segments.map(segment => segment.id === 'before'
            ? { ...segment, sourceText: 'Unrelated earlier scene' }
            : segment)
        expect(await (await createSession({ storage, segments: changedAcrossMarker })).hydrate())
            .toContainEqual({ id: 'target', translatedText: 'cached target' })
    })

    it('does not persist an entry larger than 16 KiB', async () => {
        const storage = new MemoryStorage()
        const session = await createSession({ storage })
        await session.commit({ id: 's2', translatedText: '译'.repeat(20 * 1024) })
        expect(storage.cacheKeys()).toEqual([])
    })

    it('removes expired and corrupt records, then trims least recently used records', async () => {
        const storage = new MemoryStorage()
        const prefix = videoSubtitleCacheInternals.cacheKeyPrefix
        storage.data = {
            config: { keep: true },
            [`${prefix}expired`]: { translatedText: 'old', createdAt: 0, lastAccessedAt: 0, cacheGenerationAt: 0 },
            [`${prefix}broken`]: { translatedText: '', createdAt: 100, lastAccessedAt: 100, cacheGenerationAt: 0 },
            [`${prefix}future`]: { translatedText: 'future', createdAt: 901, lastAccessedAt: 901, cacheGenerationAt: 0 },
            [`${prefix}a`]: { translatedText: 'a', createdAt: 100, lastAccessedAt: 100, cacheGenerationAt: 0 },
            [`${prefix}b`]: { translatedText: 'b', createdAt: 200, lastAccessedAt: 200, cacheGenerationAt: 0 },
            [`${prefix}c`]: { translatedText: 'c', createdAt: 300, lastAccessedAt: 300, cacheGenerationAt: 0 },
            [`${prefix}d`]: { translatedText: 'd', createdAt: 400, lastAccessedAt: 400, cacheGenerationAt: 0 },
        }

        const result = await pruneVideoSubtitleCache({
            storageArea: storage,
            now: 900,
            limits: {
                ...videoSubtitleCacheDefaults,
                ttlMs: 900,
                maxEntries: 3,
                targetEntries: 2,
                maxBytes: Number.MAX_SAFE_INTEGER,
                targetBytes: Number.MAX_SAFE_INTEGER,
            },
        })

        expect(result.entries).toBe(2)
        expect(result.removed).toBe(5)
        expect(result.nextExpiryAt).toBe(1_200)
        expect(storage.cacheKeys().sort()).toEqual([`${prefix}c`, `${prefix}d`])
        expect(storage.data.config).toEqual({ keep: true })
    })

    it('also trims to the byte low-water mark when the 4 MiB analogue is exceeded', async () => {
        const storage = new MemoryStorage()
        const prefix = videoSubtitleCacheInternals.cacheKeyPrefix
        for (let index = 0; index < 5; index++) {
            storage.data[`${prefix}${index}`] = {
                translatedText: 'x'.repeat(100),
                createdAt: index + 1,
                lastAccessedAt: index + 1,
                cacheGenerationAt: 0,
            }
        }

        const result = await pruneVideoSubtitleCache({
            storageArea: storage,
            now: 100,
            limits: {
                ...videoSubtitleCacheDefaults,
                maxBytes: 500,
                targetBytes: 300,
                maxEntries: 100,
                targetEntries: 100,
            },
        })
        expect(result.bytes).toBeLessThanOrEqual(300)
        expect(storage.cacheKeys()).toHaveLength(result.entries)
        expect(storage.cacheKeys()).not.toContain(`${prefix}0`)
    })

    it('clears only video subtitle cache records', async () => {
        const storage = new MemoryStorage()
        const prefix = videoSubtitleCacheInternals.cacheKeyPrefix
        storage.data = {
            'local:config': 'keep',
            flcache_page: 'keep',
            [`${prefix}one`]: { translatedText: '一', createdAt: 1, lastAccessedAt: 1 },
            [`${prefix}two`]: { translatedText: '二', createdAt: 1, lastAccessedAt: 1 },
        }
        expect(await clearVideoSubtitleCache(storage)).toBe(2)
        expect(storage.data).toEqual({
            'local:config': 'keep',
            flcache_page: 'keep',
            [videoSubtitleCacheInternals.cacheGenerationKey]: expect.any(Number),
        })
    })

    it('prevents a session created before clear from repopulating the cache', async () => {
        const storage = new MemoryStorage()
        const staleSession = await createSession({ storage })

        await clearVideoSubtitleCache(storage)
        await staleSession.commit({ id: 's2', translatedText: 'stale translation' })

        expect(storage.cacheKeys()).toEqual([])
        const freshSession = await createSession({ storage })
        expect(await freshSession.hydrate()).toEqual([])
    })

    it('removes a stale write when clear happens between generation check and storage set', async () => {
        const storage = new MemoryStorage()
        const staleSession = await createSession({ storage })
        const originalSet = storage.set.bind(storage)
        let clearInjected = false
        storage.set = vi.fn(async items => {
            const writesSubtitle = Object.keys(items)
                .some(key => key.startsWith(videoSubtitleCacheInternals.cacheKeyPrefix))
            if (writesSubtitle && !clearInjected) {
                clearInjected = true
                await clearVideoSubtitleCache(storage)
            }
            await originalSet(items)
        })

        await staleSession.commit({ id: 's2', translatedText: 'stale translation' })

        expect(clearInjected).toBe(true)
        expect(storage.cacheKeys()).toEqual([])
    })

    it('scans for stale writes after advancing the clear generation', async () => {
        const storage = new MemoryStorage()
        const prefix = videoSubtitleCacheInternals.cacheKeyPrefix
        const originalSet = storage.set.bind(storage)
        let staleWriteInjected = false
        storage.set = vi.fn(async items => {
            await originalSet(items)
            if (videoSubtitleCacheInternals.cacheGenerationKey in items && !staleWriteInjected) {
                staleWriteInjected = true
                storage.data[`${prefix}late-old-generation`] = {
                    translatedText: 'stale translation',
                    createdAt: 1,
                    lastAccessedAt: 1,
                    cacheGenerationAt: 0,
                }
            }
        })

        expect(await clearVideoSubtitleCache(storage)).toBe(1)
        expect(staleWriteInjected).toBe(true)
        expect(storage.cacheKeys()).toEqual([])
    })

    it('normalizes endpoints while retaining only non-sensitive routing parameters', () => {
        expect(normalizeSubtitleCacheEndpoint(baseIdentity.endpoint))
            .toBe('https://api.example.com/v1/chat/completions')
        expect(normalizeSubtitleCacheEndpoint('https://user:pass@Example.com:443/'))
            .toBe('https://example.com')
        expect(normalizeSubtitleCacheEndpoint(
            'https://Example.com/openai?api-version=2026-01-01&api_key=secret',
        )).toBe('https://example.com/openai?api-version=2026-01-01')
    })

    it('treats storage and hashing failures as cache misses without breaking playback', async () => {
        const storage = new MemoryStorage()
        storage.get = vi.fn(async () => { throw new Error('storage unavailable') })
        const session = await createSession({ storage })
        expect(await session.hydrate()).toEqual([])
        await expect(session.commit({ id: 's2', translatedText: '仍可显示' })).resolves.toBeUndefined()

        const hashFailure = await createVideoSubtitleCacheSession({
            identity: baseIdentity,
            segments: baseSegments,
            useCache: true,
            incognito: false,
            storageArea: new MemoryStorage(),
            hashText: async () => { throw new Error('hash unavailable') },
        })
        expect(hashFailure.enabled).toBe(false)
    })
})
