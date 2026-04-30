import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    watch: vi.fn()
  }
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ version: '0.1.0' })
    }
  }
}))

describe('useReleaseNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows no unread badge when the current version is already seen', async () => {
    const { storage } = await import('@wxt-dev/storage')
    vi.mocked(storage.getItem).mockImplementation(async (key: string) => {
      if (key === 'local:releaseNotesInitialized') return true
      if (key === 'local:lastSeenReleaseNotesVersion') return '0.1.0'
      return undefined
    })

    const { useReleaseNotes } = await import('../../composables/useReleaseNotes')
    const { hasUnreadReleaseNotes, loadReleaseNotesState } = useReleaseNotes()

    await loadReleaseNotesState()

    expect(hasUnreadReleaseNotes.value).toBe(false)
  })

  it('shows unread badge when the stored seen version is older', async () => {
    const { storage } = await import('@wxt-dev/storage')
    vi.mocked(storage.getItem).mockImplementation(async (key: string) => {
      if (key === 'local:releaseNotesInitialized') return true
      if (key === 'local:lastSeenReleaseNotesVersion') return '0.0.9'
      return undefined
    })

    const { useReleaseNotes } = await import('../../composables/useReleaseNotes')
    const { hasUnreadReleaseNotes, loadReleaseNotesState } = useReleaseNotes()

    await loadReleaseNotesState()

    expect(hasUnreadReleaseNotes.value).toBe(true)
  })

  it('marks current release notes as seen', async () => {
    const { storage } = await import('@wxt-dev/storage')
    const { useReleaseNotes } = await import('../../composables/useReleaseNotes')
    const { hasUnreadReleaseNotes, markCurrentReleaseNotesAsSeen } = useReleaseNotes()

    hasUnreadReleaseNotes.value = true
    await markCurrentReleaseNotesAsSeen()

    expect(storage.setItem).toHaveBeenCalledWith('local:releaseNotesInitialized', true)
    expect(storage.setItem).toHaveBeenCalledWith('local:lastSeenReleaseNotesVersion', '0.1.0')
    expect(hasUnreadReleaseNotes.value).toBe(false)
  })
})
