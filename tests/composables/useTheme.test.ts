import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
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
})