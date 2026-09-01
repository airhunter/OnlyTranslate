const cachePrefix = 'flcache_'
const lastCleanedKey = 'flLastSessionTimestamp'
const cleanIntervalMs = 24 * 60 * 60 * 1000

export function cleanPageTranslationCache(target: Storage = localStorage): void {
  const keysToDelete: string[] = []
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index)
    if (key?.startsWith(cachePrefix)) keysToDelete.push(key)
  }
  keysToDelete.forEach(key => target.removeItem(key))
}

export function cleanPageTranslationCacheIfNeeded(
  target: Storage = localStorage,
  now: number = Date.now()
): void {
  const previous = Number.parseInt(target.getItem(lastCleanedKey) || '', 10)
  if (Number.isFinite(previous) && now - previous <= cleanIntervalMs) return

  cleanPageTranslationCache(target)
  target.setItem(lastCleanedKey, String(now))
}
