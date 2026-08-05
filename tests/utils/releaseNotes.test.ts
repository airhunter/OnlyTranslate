import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RELEASE_NOTES_INIT_KEY,
  RELEASE_NOTES_SEEN_VERSION_KEY,
  findReleaseNoteByVersion,
  releaseNoteLocales,
  releaseNotes,
  syncReleaseNotesInstallState
} from '../../entrypoints/utils/releaseNotes'

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

describe('release notes utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('finds a localized release note for the requested locale', () => {
    const note = findReleaseNoteByVersion('0.5.1', 'en-US')
    expect(note?.locale).toBe('en-US')
    expect(note?.title).toBe('Multilingual Release Notes')
    expect(note?.items.length).toBe(3)
  })

  it('normalizes locale variants before resolving release notes', () => {
    const note = findReleaseNoteByVersion('0.5.1', 'zh_Hant_HK')
    expect(note?.locale).toBe('zh-TW')
    expect(note?.title).toBe('更新說明支援多語言')
  })

  it('falls back to simplified Chinese when localized content is missing', () => {
    const note = findReleaseNoteByVersion('0.4.0', 'ja-JP')
    expect(note?.locale).toBe('zh-CN')
    expect(note?.title).toBe('识文内容结构优化')
  })

  it('keeps the latest release note localized for every supported locale', () => {
    const latest = releaseNotes[0]
    expect(latest.version).toBe('1.6.0')

    for (const locale of releaseNoteLocales) {
      const localizedNote = latest.notes[locale]
      expect(localizedNote?.title).toBeTruthy()
      expect(localizedNote?.items.length).toBeGreaterThanOrEqual(3)
      expect(localizedNote?.items.length).toBeLessThanOrEqual(5)
    }
  })

  it('marks the current version as seen on fresh install', async () => {
    const { storage } = await import('@wxt-dev/storage')

    await syncReleaseNotesInstallState('install', '0.1.0')

    expect(storage.setItem).toHaveBeenCalledWith(RELEASE_NOTES_INIT_KEY, true)
    expect(storage.setItem).toHaveBeenCalledWith(RELEASE_NOTES_SEEN_VERSION_KEY, '0.1.0')
  })

  it('initializes update flow without overriding seen version', async () => {
    const { storage } = await import('@wxt-dev/storage')
    vi.mocked(storage.getItem).mockResolvedValue(undefined)

    await syncReleaseNotesInstallState('update', '0.1.0')

    expect(storage.getItem).toHaveBeenCalledWith(RELEASE_NOTES_INIT_KEY)
    expect(storage.setItem).toHaveBeenCalledWith(RELEASE_NOTES_INIT_KEY, true)
    expect(storage.setItem).not.toHaveBeenCalledWith(RELEASE_NOTES_SEEN_VERSION_KEY, '0.1.0')
  })
})
