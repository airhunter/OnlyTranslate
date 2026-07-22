import browser from 'webextension-polyfill'
import { cache } from '@/entrypoints/utils/cache'

interface SubtitleCacheClearResponse {
  success?: boolean
  error?: string
}

export interface TranslationCacheClearResult {
  clearedPageTabs: number
  videoSubtitleEntries: number
}

/** Clears shared extension caches and page-origin caches in currently open tabs. */
export async function clearTranslationCache(): Promise<TranslationCacheClearResult> {
  cache.clean()

  const [tabs, subtitleResponse] = await Promise.all([
    browser.tabs.query({}),
    browser.runtime.sendMessage({ type: 'CLEAR_VIDEO_SUBTITLE_CACHE' }),
  ])

  const subtitleResult = subtitleResponse as SubtitleCacheClearResponse & { removed?: number }
  if (!subtitleResult?.success) {
    throw new Error(subtitleResult?.error || 'Failed to clear video subtitle cache')
  }

  const pageResults = await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return false
    try {
      await browser.tabs.sendMessage(tab.id, { message: 'clearCache' })
      return true
    } catch {
      // Internal, restricted, or unloaded tabs do not have a content script cache.
      return false
    }
  }))

  return {
    clearedPageTabs: pageResults.filter(Boolean).length,
    videoSubtitleEntries: Number(subtitleResult.removed) || 0,
  }
}
