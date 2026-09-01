import { describe, expect, it } from 'vitest'
import { PendingConfigWrites } from '@/composables/pendingConfigWrites'

describe('PendingConfigWrites', () => {
  it('consumes local write notifications instead of retaining historical snapshots', () => {
    const writes = new PendingConfigWrites()
    writes.remember('{"theme":"dark"}')

    expect(writes.consume('{"theme":"dark"}')).toBe(true)
    expect(writes.consume('{"theme":"dark"}')).toBe(false)
  })

  it('tracks repeated identical writes independently', () => {
    const writes = new PendingConfigWrites()
    writes.remember('same')
    writes.remember('same')

    expect(writes.consume('same')).toBe(true)
    expect(writes.consume('same')).toBe(true)
    expect(writes.consume('same')).toBe(false)
  })

  it('expires unmatched writes so a later external rollback is not ignored', () => {
    let now = 1_000
    const writes = new PendingConfigWrites(() => now, 500)
    writes.remember('old snapshot')
    now += 501

    expect(writes.consume('old snapshot')).toBe(false)
  })
})
