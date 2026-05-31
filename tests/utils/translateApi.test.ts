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

import { cancelAllTranslations, translateText } from '../../entrypoints/utils/translateApi'
import { resolveTranslationDirection } from '../../entrypoints/utils/translationDirection'

describe('translateText', () => {
  beforeEach(() => {
    mockConfig.count = 0
    mockEnqueueTranslation.mockImplementation((task: () => Promise<string>) => task())
    mockCacheLocalGet.mockReturnValue(null)
    mockResolveTranslationDirection.mockReturnValue({
      shouldTranslate: true,
      sourceLang: 'en',
      targetLang: 'zh-Hans'
    })
    mockSendMessage.mockResolvedValue('译文')
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

  it('deduplicates concurrent identical translation requests', async () => {
    let resolveMessage!: (value: string) => void
    mockSendMessage.mockReturnValue(new Promise(resolve => {
      resolveMessage = resolve
    }))

    const first = translateText('Hello world', 'Example')
    const second = translateText('Hello world', 'Example')

    expect(mockEnqueueTranslation).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    resolveMessage('你好，世界')

    await expect(Promise.all([first, second])).resolves.toEqual(['你好，世界', '你好，世界'])
  })

  it('cancels an active translation result after cancelAllTranslations is called', async () => {
    let resolveMessage!: (value: string) => void
    mockSendMessage.mockReturnValue(new Promise(resolve => {
      resolveMessage = resolve
    }))

    const translation = translateText('Cancel me', 'Example')
    cancelAllTranslations()
    resolveMessage('不要写入页面')

    await expect(translation).rejects.toMatchObject({
      name: 'TranslationCancelledError'
    })
  })

  it('uses exponential backoff between retries', async () => {
    vi.useFakeTimers()
    mockSendMessage
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockRejectedValueOnce(new Error('temporary failure again'))
      .mockResolvedValueOnce('最终译文')

    const translation = translateText('Retry me', 'Example', {
      maxRetries: 2,
      retryDelay: 100,
      useCache: false
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(99)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(199)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect(mockSendMessage).toHaveBeenCalledTimes(3)

    await expect(translation).resolves.toBe('最终译文')
    vi.useRealTimers()
  })
})
