import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearBatchTranslationQueue,
  enqueueBatchTranslation
} from '@/entrypoints/utils/batchTranslateQueue'

describe('batch translation queue', () => {
  beforeEach(() => {
    clearBatchTranslationQueue()
    vi.useFakeTimers()
  })

  afterEach(() => {
    clearBatchTranslationQueue()
    vi.useRealTimers()
  })

  it('batches compatible requests after the delay', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'Hello',
      executeBatch,
      executeSingle
    })
    const second = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'World',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(39)
    expect(executeBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await expect(Promise.all([first, second])).resolves.toEqual(['译:Hello', '译:World'])
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch).toHaveBeenCalledWith(['Hello', 'World'])
    expect(executeSingle).not.toHaveBeenCalled()
  })

  it('keeps a rolling window for staggered compatible requests', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'First paragraph',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(30)

    const second = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'Second paragraph',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(30)

    const third = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'Third paragraph',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(39)
    expect(executeBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      '译:First paragraph',
      '译:Second paragraph',
      '译:Third paragraph'
    ])
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch).toHaveBeenCalledWith([
      'First paragraph',
      'Second paragraph',
      'Third paragraph'
    ])
    expect(executeSingle).not.toHaveBeenCalled()
  })

  it('uses a short 40ms rolling window by default', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'First paragraph',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(39)
    expect(executeBatch).not.toHaveBeenCalled()
    expect(executeSingle).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await expect(first).resolves.toBe('单:First paragraph')
    expect(executeSingle).toHaveBeenCalledTimes(1)
  })

  it('caps default batches at four items', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)
    const origins = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1}`)

    const results = origins.map(origin => enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin,
      executeBatch,
      executeSingle
    }))

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all(results)).resolves.toEqual(origins.map(origin => `译:${origin}`))
    expect(executeBatch).toHaveBeenCalledTimes(3)
    expect(executeBatch).toHaveBeenNthCalledWith(1, origins.slice(0, 4))
    expect(executeBatch).toHaveBeenNthCalledWith(2, origins.slice(4, 8))
    expect(executeBatch).toHaveBeenNthCalledWith(3, origins.slice(8))
    expect(executeSingle).not.toHaveBeenCalled()
  })

  it('splits article-sized paragraphs by the compact default character budget', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin.length}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin.length}`)
    const origins = Array.from({ length: 5 }, (_, index) => `${index}`.padEnd(2000, 'x'))

    const results = origins.map(origin => enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin,
      executeBatch,
      executeSingle
    }))

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all(results)).resolves.toEqual([
      '译:2000',
      '译:2000',
      '译:2000',
      '译:2000',
      '译:2000'
    ])
    expect(executeBatch).toHaveBeenCalledTimes(2)
    expect(executeBatch).toHaveBeenNthCalledWith(1, origins.slice(0, 3))
    expect(executeBatch).toHaveBeenNthCalledWith(2, origins.slice(3))
    expect(executeSingle).not.toHaveBeenCalled()
  })

  it('does not batch different compatibility keys', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({
      key: 'openai:gpt:en:zh',
      origin: 'Hello',
      executeBatch,
      executeSingle
    })
    const second = enqueueBatchTranslation({
      key: 'openai:gpt:en:ja',
      origin: 'World',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual(['单:Hello', '单:World'])
    expect(executeBatch).not.toHaveBeenCalled()
    expect(executeSingle).toHaveBeenCalledTimes(2)
  })

  it('splits groups by maxItems and maxCharacters', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const results = [
      enqueueBatchTranslation({ key: 'k', origin: 'aa', executeBatch, executeSingle }, { maxItems: 2, maxCharacters: 4 }),
      enqueueBatchTranslation({ key: 'k', origin: 'bb', executeBatch, executeSingle }, { maxItems: 2, maxCharacters: 4 }),
      enqueueBatchTranslation({ key: 'k', origin: 'cc', executeBatch, executeSingle }, { maxItems: 2, maxCharacters: 4 }),
      enqueueBatchTranslation({ key: 'k', origin: 'dddd', executeBatch, executeSingle }, { maxItems: 2, maxCharacters: 4 }),
      enqueueBatchTranslation({ key: 'k', origin: 'e', executeBatch, executeSingle }, { maxItems: 2, maxCharacters: 4 })
    ]

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all(results)).resolves.toEqual(['译:aa', '译:bb', '单:cc', '单:dddd', '单:e'])
    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch).toHaveBeenCalledWith(['aa', 'bb'])
    expect(executeSingle).toHaveBeenCalledTimes(3)
  })

  it('falls back to single requests when batch result count mismatches', async () => {
    const executeBatch = vi.fn(async () => ['only one'])
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({ key: 'k', origin: 'Hello', executeBatch, executeSingle })
    const second = enqueueBatchTranslation({ key: 'k', origin: 'World', executeBatch, executeSingle })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual(['单:Hello', '单:World'])
    expect(executeSingle).toHaveBeenCalledTimes(2)
  })

  it('falls back to single requests when batch responses alter protected inline tokens', async () => {
    const executeBatch = vi.fn(async () => [
      '打开 __ONLY_TRANSLATE_INLINE_0_changed__ 继续。',
      '世界 __ONLY_TRANSLATE_INLINE_1_xyz__'
    ])
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({
      key: 'k',
      origin: 'Open __ONLY_TRANSLATE_INLINE_0_abc__ before continuing.',
      executeBatch,
      executeSingle
    })
    const second = enqueueBatchTranslation({
      key: 'k',
      origin: 'World __ONLY_TRANSLATE_INLINE_1_xyz__',
      executeBatch,
      executeSingle
    })

    await vi.advanceTimersByTimeAsync(40)

    await expect(Promise.all([first, second])).resolves.toEqual([
      '单:Open __ONLY_TRANSLATE_INLINE_0_abc__ before continuing.',
      '单:World __ONLY_TRANSLATE_INLINE_1_xyz__'
    ])
    expect(executeSingle).toHaveBeenCalledTimes(2)
  })

  it('rejects pending items when the queue is cleared before flush', async () => {
    const executeBatch = vi.fn(async (origins: string[]) => origins.map(origin => `译:${origin}`))
    const executeSingle = vi.fn(async (origin: string) => `单:${origin}`)

    const first = enqueueBatchTranslation({ key: 'k', origin: 'Hello', executeBatch, executeSingle })
    const second = enqueueBatchTranslation({ key: 'k', origin: 'World', executeBatch, executeSingle })
    const firstResult = first.catch(error => error)
    const secondResult = second.catch(error => error)

    clearBatchTranslationQueue(new Error('cancelled'))
    await vi.advanceTimersByTimeAsync(40)

    await expect(firstResult).resolves.toMatchObject({ message: 'cancelled' })
    await expect(secondResult).resolves.toMatchObject({ message: 'cancelled' })
    expect(executeBatch).not.toHaveBeenCalled()
    expect(executeSingle).not.toHaveBeenCalled()
  })
})
