import { describe, expect, it } from 'vitest'
import { hasActiveTextSelection } from '@/entrypoints/utils/selection'

describe('selection utilities', () => {
    it('detects non-empty active selections', () => {
        const selection = {
            rangeCount: 1,
            toString: () => ' selected text ',
        } as Selection

        expect(hasActiveTextSelection(selection)).toBe(true)
    })

    it('ignores empty or missing selections', () => {
        expect(hasActiveTextSelection(null)).toBe(false)
        expect(hasActiveTextSelection({ rangeCount: 0, toString: () => 'text' } as Selection)).toBe(false)
        expect(hasActiveTextSelection({ rangeCount: 1, toString: () => '   ' } as Selection)).toBe(false)
    })
})

