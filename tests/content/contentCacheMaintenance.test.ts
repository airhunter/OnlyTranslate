import { beforeEach, describe, expect, it } from 'vitest'
import {
  cleanPageTranslationCache,
  cleanPageTranslationCacheIfNeeded
} from '@/entrypoints/content/contentCacheMaintenance'

describe('content cache maintenance', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes only page translation cache entries', () => {
    localStorage.setItem('flcache_one', '1')
    localStorage.setItem('unrelated', '2')

    cleanPageTranslationCache()

    expect(localStorage.getItem('flcache_one')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('2')
  })

  it('runs at most once during the maintenance interval', () => {
    cleanPageTranslationCacheIfNeeded(localStorage, 1_000)
    localStorage.setItem('flcache_recent', 'value')

    cleanPageTranslationCacheIfNeeded(localStorage, 2_000)

    expect(localStorage.getItem('flcache_recent')).toBe('value')
  })
})
