import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RELEASE_NOTES_INIT_KEY,
  RELEASE_NOTES_SEEN_VERSION_KEY,
  findReleaseNoteByVersion,
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

  it('finds the current version release note', () => {
    const note = findReleaseNoteByVersion('0.1.0')
    expect(note?.title).toBe('首个商店版本')
    expect(note?.items.length).toBeGreaterThan(0)
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
