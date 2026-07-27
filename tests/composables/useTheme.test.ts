import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('useTheme', () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockClear()
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    document.documentElement.classList.remove('dark')
  })

  it('should add dark class when updateTheme is called with dark', () => {
    const config = ref({ theme: 'light' })
    const { updateTheme } = useTheme(config)

    updateTheme('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should remove dark class when updateTheme is called with light', () => {
    document.documentElement.classList.add('dark')
    const config = ref({ theme: 'dark' })
    const { updateTheme } = useTheme(config)

    updateTheme('light')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should use system preference when updateTheme is called with auto', () => {
    // Mock matchMedia to return true (dark mode)
    const mockMatchMedia = window.matchMedia as ReturnType<typeof vi.fn>
    mockMatchMedia.mockImplementationOnce(() => ({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const config = ref({ theme: 'light' })
    const { updateTheme } = useTheme(config)

    updateTheme('auto')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should reactively follow system preference changes in auto mode', async () => {
    const mediaQuery = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList
    vi.mocked(window.matchMedia).mockReturnValueOnce(mediaQuery)
    const config = ref({ theme: 'auto' })
    const { actualTheme } = useTheme(config)

    expect(actualTheme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    Object.defineProperty(mediaQuery, 'matches', { configurable: true, value: true })
    mediaQuery.onchange?.call(mediaQuery, { matches: true } as MediaQueryListEvent)
    await nextTick()

    expect(actualTheme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
