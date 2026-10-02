import { describe, expect, it, vi } from 'vitest'

const mockFranc = vi.hoisted(() => vi.fn())

vi.mock('franc-min', () => ({ franc: mockFranc }))

import { detectlang } from '@/entrypoints/utils/common'

describe('detectlang target language codes', () => {
  it.each([
    ['spa', 'es'],
    ['deu', 'de'],
    ['por', 'pt'],
    ['ita', 'it'],
    ['ind', 'id'],
  ])('normalizes %s to %s for translation direction', (detected, expected) => {
    mockFranc.mockReturnValue(detected)
    expect(detectlang('sample')).toBe(expected)
  })
})
