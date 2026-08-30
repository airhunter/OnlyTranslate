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
  to: 'zh-Hans',
  token: {
    openai: 'test-token'
  } as Record<string, string>,
  newApiUrl: '',
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
  analyzeSelectionText,
  cacheTranslationResult,
  cancelAllTranslations,
  canUseBatchTranslationForCurrentConfig,
  isExtensionContextInvalidatedError,
  isRetryableTranslationError,
  simulateNextRuntimeUnavailableForDebug,
  translateText,
} from '../../entrypoints/utils/translateApi'
import { resolveTranslationDirection } from '../../entrypoints/utils/translationDirection'

describe('translateApi', () => {
  beforeEach(() => {
    mockConfig.count = 0
    mockConfig.useCache = true
    mockConfig.service = 'openai'
    mockConfig.to = 'zh-Hans'
    mockConfig.token = {
      openai: 'test-token'
    }
    mockConfig.newApiUrl = ''
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

  it('sends a selection analysis request with an isolated prompt and parses the result', async () => {
    mockSendMessage.mockResolvedValue(JSON.stringify({
      kind: 'term',
      term: 'behind',
      pronunciation: '/bɪˈhaɪnd/',
      partOfSpeech: 'preposition',
      definition: '在……后面',
      contextualMeaning: '表示某个现象背后的原因',
      example: 'the reasons behind the change',
      difficulty: 'A2',
      notes: ['也可表示支持某人'],
    }))

    await expect(analyzeSelectionText({
      text: 'behind',
      surroundingContext: "Behind Britain's Digital ID Laws",
      pageTitle: 'Example article',
    })).resolves.toMatchObject({
      kind: 'term',
      term: 'behind',
      contextualMeaning: '表示某个现象背后的原因',
    })

    expect(mockEnqueueTranslation).toHaveBeenCalledWith(expect.any(Function), { priority: 'high' })
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SELECTION_ANALYSIS',
      origin: 'behind',
      context: 'Example article',
      sourceLang: 'auto',
      targetLang: 'zh-Hans',
      prompt: expect.objectContaining({
        responseFormat: 'json',
        system: expect.stringContaining('language-learning assistant'),
        user: expect.stringContaining("Behind Britain's Digital ID Laws"),
      }),
    }))
    expect(mockCacheLocalGet).not.toHaveBeenCalled()
    expect(mockCacheLocalSet).not.toHaveBeenCalled()
    expect(mockStorageSetItem).not.toHaveBeenCalled()
  })

  it('requires a configured AI service before analyzing a selection', async () => {
    mockConfig.service = 'google'

    await expect(analyzeSelectionText({ text: 'behind' })).rejects.toBeInstanceOf(Error)

    expect(mockEnqueueTranslation).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
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

  it('cancels only the translation call associated with an abort signal', async () => {
    const resolvers: Array<(value: string) => void> = []
    mockSendMessage.mockImplementation(() => new Promise(resolve => {
      resolvers.push(resolve)
    }))

    const sharedTranslation = translateText('Same text', 'Example', { useCache: false })
    const controller = new AbortController()
    const scopedTranslation = translateText('Same text', 'Example', {
      signal: controller.signal,
      useCache: false
    })

    expect(mockSendMessage).toHaveBeenCalledTimes(2)

    const scopedRejection = expect(scopedTranslation).rejects.toMatchObject({
      name: 'TranslationCancelledError'
    })
    controller.abort()
    await scopedRejection

    resolvers[0]('保留的共享译文')
    resolvers[1]('应被丢弃的划词译文')

    await expect(sharedTranslation).resolves.toBe('保留的共享译文')
  })

  it('does not send or retry a translation after its signal is aborted', async () => {
    vi.useFakeTimers()
    mockSendMessage.mockRejectedValueOnce(new Error('network failure'))
    const controller = new AbortController()

    const translation = translateText('Abort retry', 'Example', {
      maxRetries: 3,
      retryDelay: 100,
      signal: controller.signal,
      useCache: false
    })
    const rejection = expect(translation).rejects.toMatchObject({
      name: 'TranslationCancelledError'
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    controller.abort()
    await rejection
    await vi.advanceTimersByTimeAsync(1000)

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('rejects an already-aborted call before entering the translation queue', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(translateText('Do not send', 'Example', {
      signal: controller.signal,
      useCache: false
    })).rejects.toMatchObject({
      name: 'TranslationCancelledError'
    })

    expect(mockEnqueueTranslation).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
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

  it('recognizes extension runtime failures that require a page refresh', () => {
    expect(isExtensionContextInvalidatedError(new Error('Extension context invalidated.'))).toBe(true)
    expect(isExtensionContextInvalidatedError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true)
    expect(isExtensionContextInvalidatedError(new TypeError("Cannot read properties of undefined (reading 'sendMessage')"))).toBe(false)
    expect(isExtensionContextInvalidatedError(new TypeError("Cannot read properties of undefined (reading 'runtime')"))).toBe(false)
    expect(isExtensionContextInvalidatedError(new Error('Failed to fetch'))).toBe(false)
  })

  it('reports an invalidated extension context when the runtime messenger is unavailable', async () => {
    const runtime = (await import('webextension-polyfill')).default.runtime as unknown as {
      sendMessage?: typeof mockSendMessage
    }
    const originalSendMessage = runtime.sendMessage
    runtime.sendMessage = undefined

    try {
      await expect(translateText('Unavailable runtime', 'Example', {
        maxRetries: 0,
        useCache: false
      })).rejects.toThrow('Extension context invalidated')
    } finally {
      runtime.sendMessage = originalSendMessage
    }
  })

  it('supports simulating one unavailable runtime message for manual regression testing', async () => {
    simulateNextRuntimeUnavailableForDebug()

    await expect(translateText('Simulated unavailable runtime', 'Example', {
      maxRetries: 0,
      useCache: false
    })).rejects.toThrow('Extension context invalidated')
    expect(mockSendMessage).not.toHaveBeenCalled()

    await expect(translateText('Runtime available again', 'Example', {
      maxRetries: 0,
      useCache: false
    })).resolves.toBe('译文')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
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

    expect(mockCacheLocalSet).toHaveBeenCalledWith('Hello', '新译文', 'zh-Hans', { scene: 'other' })
  })

  it('forwards fast mode only when explicitly requested', async () => {
    await translateText('Fast subtitle', 'Video title', {
      fastMode: true,
      useCache: false
    })

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'Fast subtitle',
      context: 'Video title',
      promptContext: { scene: 'other', title: 'Video title' },
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
    const promptContext = { scene: 'other', title: 'Example' }
    expect(mockCacheLocalSet).toHaveBeenCalledWith('Hello', '你好', 'zh-Hans', promptContext)
    expect(mockCacheLocalSet).toHaveBeenCalledWith('World', '世界', 'zh-Hans', promptContext)
  })

  it('normalizes and forwards structured selection context', async () => {
    await translateText('bank', {
      scene: 'selection',
      title: ` ${'T'.repeat(350)} `,
      surroundingText: ` ${'C'.repeat(1700)} `,
    }, { useCache: false })

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'bank',
      context: 'T'.repeat(120),
      promptContext: {
        scene: 'selection',
        title: 'T'.repeat(120),
        surroundingText: 'C'.repeat(1600),
      },
    }))
  })

  it('returns a single AI translation response without an envelope protocol', async () => {
    mockSendMessage.mockResolvedValue('事实会腐坏，但程序不会。')

    await expect(translateText('Facts rot, procedures do not.', {
      scene: 'webpage',
      title: 'The model is deliberately getting dumber',
    }, { useCache: false })).resolves.toBe('事实会腐坏，但程序不会。')
  })

  it('keeps non-envelope JSON returned by an AI service intact', async () => {
    const translatedJson = '{"name":"示例","status":"正常"}'
    mockSendMessage.mockResolvedValue(translatedJson)

    await expect(translateText('{"name":"Example","status":"ok"}', {
      scene: 'webpage',
      title: 'JSON API guide',
    }, { useCache: false })).resolves.toBe(translatedJson)
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
