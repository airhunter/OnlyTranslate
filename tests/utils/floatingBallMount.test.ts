import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  animations: false,
  customProviders: [],
  disableFloatingBall: false,
  display: 1,
  floatingBallOffsetY: null,
  floatingBallPosition: 'right' as 'left' | 'right',
  service: 'google',
  token: {},
  translationScope: 'smart' as 'smart' | 'full'
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    setItem: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: vi.fn()
    }
  }
}))

vi.mock('@/entrypoints/main/trans', () => ({
  autoTranslateEnglishPage: vi.fn(),
  restoreOriginalContent: vi.fn()
}))

import { mountFloatingBall, unmountFloatingBall } from '@/entrypoints/utils/floatingBall'

describe('floating ball mounting', () => {
  beforeEach(() => {
    document.body.style.filter = 'invert(1)'
    mockConfig.disableFloatingBall = false
    mockConfig.floatingBallOffsetY = null
    mockConfig.floatingBallPosition = 'right'
  })

  afterEach(() => {
    unmountFloatingBall()
    document.body.removeAttribute('style')
  })

  it('mounts outside body-level fixed-position containing blocks', () => {
    mountFloatingBall()

    const container = document.getElementById('only-translate-floating-ball-container')

    expect(container?.parentElement).toBe(document.documentElement)
    expect(document.body.contains(container)).toBe(false)
    expect(container?.querySelector('.fr-floating-ball')).not.toBeNull()
  })
})
