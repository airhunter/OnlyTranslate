import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.hoisted(() => vi.fn())
const mockEnqueueTranslation = vi.hoisted(() => vi.fn((task: () => Promise<string>) => task()))
const mockStorageSetItem = vi.hoisted(() => vi.fn())
const mockCacheLocalGet = vi.hoisted(() => vi.fn())
const mockCacheLocalSet = vi.hoisted(() => vi.fn())
const mockResolveTranslationDirection = vi.hoisted(() => vi.fn())
const mockConfig = vi.hoisted(() => ({
  count: 0,
  useCache: true,
  service: 'openai',
  model: {
    openai: 'gpt-5-mini'
  } as Record<string, string>,
  customModel: {} as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    protocol?: 'openai' | 'anthropic'
    url: string
    token: string
    model: string
    customModel: string
    name: string
  }>,
  style: 1,
  system_role: {} as Record<string, string>,
  user_role: {} as Record<string, string>
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

import {
  cacheTranslationResult,
  cancelAllTranslations,
  canUseBatchTranslationForCurrentConfig,
  isRetryableTranslationError,
  translateText,
} from '../../entrypoints/utils/translateApi'
import { resolveTranslationDirection } from '../../entrypoints/utils/translationDirection'

describe('translateText', () => {
  beforeEach(() => {
    mockConfig.count = 0
    mockConfig.useCache = true
    mockConfig.service = 'openai'
    mockConfig.model = {
      openai: 'gpt-5-mini'
    }
    mockConfig.customModel = {}
    mockConfig.customProviders = []
    mockConfig.style = 1
    mockConfig.system_role = {}
    mockConfig.user_role = {}
    mockEnqueueTranslation.mockImplementation((task: () => Promise<string>) => task())
    mockCacheLocalGet.mockReturnValue(null)
    mockResolveTranslationDirection.mockReturnValue({
      shouldTranslate: true,
      sourceLang: 'en',
      targetLang: 'zh-Hans'
    })
    mockSendMessage.mockResolvedValue('译文')
    vi.clearAllMocks()
    vi.useRealTimers()
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
      .mockRejectedValueOnce(new Error('network failure'))
      .mockRejectedValueOnce(new Error('network failure again'))
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

  it('retries only transient transport and upstream failures', () => {
    expect(isRetryableTranslationError(new Error('Translation failed: 400 Bad Request'))).toBe(false)
    expect(isRetryableTranslationError(new Error('Translation failed: 401 Unauthorized'))).toBe(false)
    expect(isRetryableTranslationError(new Error('Translation failed: 429 Too Many Requests'))).toBe(true)
    expect(isRetryableTranslationError(new Error('Translation failed: 503 Service Unavailable'))).toBe(true)
    expect(isRetryableTranslationError(new Error('Failed to fetch'))).toBe(true)
    expect(isRetryableTranslationError(new Error('翻译请求超时'))).toBe(true)
    expect(isRetryableTranslationError(new Error('Unexpected translation response'))).toBe(false)
  })

  it('does not retry a deterministic bad-request failure', async () => {
    mockSendMessage.mockRejectedValue(new Error('Translation failed: 400 Bad Request'))

    await expect(translateText('Invalid request', 'Example', {
      maxRetries: 3,
      retryDelay: 1,
      useCache: false
    })).rejects.toThrow('400 Bad Request')

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })

  it('caps request-timeout retries at one attempt', async () => {
    vi.useFakeTimers()
    mockSendMessage.mockRejectedValue(new Error('Translation request timed out'))

    const translation = translateText('Timeout request', 'Example', {
      maxRetries: 3,
      retryDelay: 100,
      useCache: false
    })
    const rejection = expect(translation).rejects.toThrow('timed out')

    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('does not batch by default', async () => {
    const first = translateText('Hello', 'Example', { useCache: false })
    const second = translateText('World', 'Example', { useCache: false })

    await expect(Promise.all([first, second])).resolves.toEqual(['译文', '译文'])

    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      origin: 'Hello'
    }))
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      origin: 'World'
    }))
    expect(mockSendMessage.mock.calls.some(([message]) => message.type === 'BATCH_TRANSLATION')).toBe(false)
  })

  it('can bypass cache reads and writes for a transactional translation', async () => {
    mockCacheLocalGet.mockReturnValue('旧缓存')
    mockSendMessage.mockResolvedValue('新译文')

    await expect(translateText('Hello', 'Example', { useCache: false })).resolves.toBe('新译文')

    expect(mockCacheLocalGet).not.toHaveBeenCalled()
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ origin: 'Hello' }))
    expect(mockCacheLocalSet).not.toHaveBeenCalled()
  })

  it('commits a staged translation to the current translation cache', () => {
    cacheTranslationResult('Hello', '新译文')

    expect(mockCacheLocalSet).toHaveBeenCalledWith('Hello', '新译文', 'zh-Hans')
  })

  it('forwards fast mode only when explicitly requested', async () => {
    await translateText('Fast subtitle', 'Video title', {
      fastMode: true,
      useCache: false
    })

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'Fast subtitle',
      context: 'Video title',
      fastMode: true
    }))
  })

  it('batches concurrent supported AI requests when allowBatch is true', async () => {
    vi.useFakeTimers()
    mockSendMessage.mockResolvedValueOnce(['你好', '世界'])

    const first = translateText('Hello', 'Example', { allowBatch: true })
    const second = translateText('World', 'Example', { allowBatch: true })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual(['你好', '世界'])
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      context: 'Example',
      sourceLang: 'en',
      targetLang: 'zh-Hans'
    }))
    expect(mockCacheLocalSet).toHaveBeenCalledWith('Hello', '你好', 'zh-Hans')
    expect(mockCacheLocalSet).toHaveBeenCalledWith('World', '世界', 'zh-Hans')
  })

  it('keeps ordinary batching disabled for Anthropic-compatible custom providers', () => {
    mockConfig.service = 'custom_anthropic'
    mockConfig.customProviders = [{
      id: 'custom_anthropic',
      name: 'Anthropic gateway',
      protocol: 'anthropic',
      url: 'https://gateway.example',
      token: '',
      model: '自定义模型',
      customModel: 'claude-test',
    }]

    expect(canUseBatchTranslationForCurrentConfig(true)).toBe(false)
  })

  it('does not batch cache hits', async () => {
    vi.useFakeTimers()
    mockCacheLocalGet.mockImplementation((origin: string) => origin === 'Hello' ? '缓存译文' : null)
    mockSendMessage.mockImplementation(async (message: { type?: string }) => (
      message.type === 'TRANSLATION_DIAGNOSTIC_CACHE_HIT' ? { success: true } : '世界'
    ))

    const first = translateText('Hello', 'Example', { allowBatch: true })
    const second = translateText('World', 'Example', { allowBatch: true })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual(['缓存译文', '世界'])
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'World'
    }))
  })

  it('does not batch when the current AI prompt is customized', async () => {
    mockConfig.user_role = {
      openai: 'Custom prompt {{origin}}'
    }

    const first = translateText('Hello', 'Example', { allowBatch: true, useCache: false })
    const second = translateText('World', 'Example', { allowBatch: true, useCache: false })

    await expect(Promise.all([first, second])).resolves.toEqual(['译文', '译文'])
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage.mock.calls.some(([message]) => message.type === 'BATCH_TRANSLATION')).toBe(false)
  })

  it('does not batch when the current AI system prompt is customized', async () => {
    mockConfig.system_role = {
      openai: 'Custom system prompt'
    }

    const first = translateText('Hello', 'Example', { allowBatch: true, useCache: false })
    const second = translateText('World', 'Example', { allowBatch: true, useCache: false })

    await expect(Promise.all([first, second])).resolves.toEqual(['译文', '译文'])
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage.mock.calls.some(([message]) => message.type === 'BATCH_TRANSLATION')).toBe(false)
  })

  it('falls back to single translations when a batch request fails', async () => {
    vi.useFakeTimers()
    mockSendMessage
      .mockRejectedValueOnce(new Error('bad batch'))
      .mockResolvedValueOnce('你好')
      .mockResolvedValueOnce('世界')

    const first = translateText('Hello', 'Example', { allowBatch: true, useCache: false })
    const second = translateText('World', 'Example', { allowBatch: true, useCache: false })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual(['你好', '世界'])
    expect(mockSendMessage).toHaveBeenCalledTimes(3)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'BATCH_TRANSLATION'
    }))
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      origin: 'Hello'
    }))
    expect(mockSendMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({
      origin: 'World'
    }))
  })
})
