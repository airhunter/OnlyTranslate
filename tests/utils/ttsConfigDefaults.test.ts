import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  watch: vi.fn(),
}))

vi.mock('@wxt-dev/storage', () => ({ storage: mockStorage }))

describe('saved speech engine preferences', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('storage', mockStorage)
    mockStorage.setItem.mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['missing', 'edge'],
    ['system', 'system'],
    ['edge', 'edge'],
  ])('uses %s preferences consistently in content and settings', async (storedEngine, expected) => {
    const saved = { on: true, service: 'microsoft', from: 'auto', to: 'zh-Hans' }
    mockStorage.getItem.mockResolvedValue(JSON.stringify({
      ...saved,
      ...(storedEngine !== 'missing' ? { ttsEngine: storedEngine } : {}),
    }))

    const contentConfig = await import('@/entrypoints/utils/config')
    await contentConfig.configReady
    expect(contentConfig.config.ttsEngine).toBe(expected)

    const { useConfig } = await import('@/composables/useConfig')
    const settings = useConfig()
    await settings.loadConfig()
    expect(settings.config.value.ttsEngine).toBe(expected)
  })
})
