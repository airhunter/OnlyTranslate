import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PdfLayoutModelStore,
  type PdfLayoutModelDescriptor,
} from '@/entrypoints/pdf/layoutModelStore'

const descriptor: PdfLayoutModelDescriptor = {
  id: 'test-model',
  fileName: 'test.onnx',
  url: 'https://models.example/test.onnx',
  sourceUrl: 'https://models.example/',
  size: 5,
  sha256: '9372c470eeadd5ecd9c3c74c2b3cb633f8e2f2fad799250a0f70d652b6b825e4',
}

describe('PdfLayoutModelStore', () => {
  let store: PdfLayoutModelStore
  let fetcher: typeof fetch

  beforeEach(() => {
    fetcher = vi.fn(async () => new Response('model', {
      status: 200,
      headers: { 'content-length': '5' },
    })) as typeof fetch
    store = new PdfLayoutModelStore(new IDBFactory(), fetcher, descriptor)
  })

  afterEach(() => {
    store.close()
    vi.unstubAllGlobals()
  })

  it('downloads, verifies, stores, reads, and removes the optional model', async () => {
    const progress = vi.fn()
    expect(await store.getStatus()).toEqual({ installed: false, size: 5 })

    const installed = await store.download(progress)

    expect(installed).toMatchObject({ installed: true, size: 5 })
    expect(fetcher).toHaveBeenCalledWith(descriptor.url, expect.objectContaining({ cache: 'no-store' }))
    expect(progress).toHaveBeenLastCalledWith({ received: 5, total: 5, percent: 100 })
    expect(new TextDecoder().decode(await store.getModelBuffer())).toBe('model')
    expect((await store.getStatus()).installed).toBe(true)

    await store.remove()
    expect((await store.getStatus()).installed).toBe(false)
  })

  it('rejects an invalid checksum without persisting the model', async () => {
    store = new PdfLayoutModelStore(new IDBFactory(), fetcher, {
      ...descriptor,
      sha256: '0'.repeat(64),
    })

    await expect(store.download()).rejects.toThrow('校验失败')
    expect((await store.getStatus()).installed).toBe(false)
  })

  it('calls the native fetch function with its required global context', async () => {
    const nativeLikeFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response('model', {
        status: 200,
        headers: { 'content-length': '5' },
      }))
    })
    vi.stubGlobal('fetch', nativeLikeFetch)
    store = new PdfLayoutModelStore(new IDBFactory(), undefined, descriptor)

    await expect(store.download()).resolves.toMatchObject({ installed: true })
    expect(nativeLikeFetch).toHaveBeenCalledOnce()
  })
})
