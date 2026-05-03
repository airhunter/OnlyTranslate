import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.hoisted(() => vi.fn())
const mockEnqueueTranslation = vi.hoisted(() => vi.fn((task: () => Promise<string>) => task()))
const mockStorageSetItem = vi.hoisted(() => vi.fn())
const mockCacheLocalGet = vi.hoisted(() => vi.fn())
const mockCacheLocalSet = vi.hoisted(() => vi.fn())
const mockResolveTranslationDirection = vi.hoisted(() => vi.fn())
const mockConfig = vi.hoisted(() => ({
  count: 0,
  useCache: true
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: mockSendMessage
    }
  }
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    setItem: mockStorageSetItem
  }
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/cache', () => ({
  cache: {
    localGet: mockCacheLocalGet,
    localSet: mockCacheLocalSet
  }
}))

vi.mock('@/entrypoints/utils/translateQueue', () => ({
  enqueueTranslation: mockEnqueueTranslation,
  clearTranslationQueue: vi.fn()
}))

vi.mock('@/entrypoints/utils/translationDirection', () => ({
  resolveTranslationDirection: mockResolveTranslationDirection
}))

import { translateText } from '../../entrypoints/utils/translateApi'
import { resolveTranslationDirection } from '../../entrypoints/utils/translationDirection'

describe('translateText', () => {
  beforeEach(() => {
    mockConfig.count = 0
    vi.clearAllMocks()
  })

  it('returns blank text without sending a translation request', async () => {
    await expect(translateText('   ', 'Reddit')).resolves.toBe('   ')

    expect(resolveTranslationDirection).not.toHaveBeenCalled()
    expect(mockEnqueueTranslation).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockCacheLocalGet).not.toHaveBeenCalled()
    expect(mockStorageSetItem).not.toHaveBeenCalled()
  })

  it('normalizes nullish input to an empty result without sending a request', async () => {
    await expect(translateText(null as unknown as string, 'Reddit')).resolves.toBe('')

    expect(resolveTranslationDirection).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('passes per-request service without changing global config', async () => {
    mockResolveTranslationDirection.mockReturnValue({
      shouldTranslate: true,
      sourceLang: 'en',
      targetLang: 'zh-Hans'
    })
    mockSendMessage.mockResolvedValue('你好')

    await expect(translateText('hello', 'Reddit', { service: 'deepL', useCache: false })).resolves.toBe('你好')

    expect(mockSendMessage).toHaveBeenCalledWith({
      context: 'Reddit',
      origin: 'hello',
      sourceLang: 'en',
      targetLang: 'zh-Hans',
      service: 'deepL'
    })
  })
})
