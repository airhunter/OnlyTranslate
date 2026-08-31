import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.hoisted(() => vi.fn())

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
      sendMessage: mockSendMessage
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
    mockSendMessage.mockReset()
    window.history.replaceState({}, '', '/')
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

  it('opens the PDF reader instead of translating a direct PDF document', async () => {
    window.history.replaceState({}, '', '/paper.pdf')
    mountFloatingBall()

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="floating-ball-trigger"]')
    trigger?.click()

    await vi.waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'openPdfReader',
      sourceUrl: new URL('/paper.pdf', window.location.href).toString()
    }))
  })

  it('opens the unified reading library from the expanded toolbar', async () => {
    mountFloatingBall()

    document.querySelector<HTMLButtonElement>('[data-testid="floating-ball-more-trigger"]')?.click()
    await vi.waitFor(() => expect(document.querySelector('[data-testid="floating-toolbar-reading"]')).not.toBeNull())
    document.querySelector<HTMLButtonElement>('[data-testid="floating-toolbar-reading"]')?.click()

    await vi.waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith({ type: 'openEbookLibrary' }))
  })
})
