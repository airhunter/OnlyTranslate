export interface PdfLayoutModelDescriptor {
  id: string
  fileName: string
  url: string
  sourceUrl: string
  size: number
  sha256: string
}

export interface PdfLayoutModelStatus {
  installed: boolean
  size: number
  downloadedAt?: number
}

export interface PdfLayoutModelDownloadProgress {
  received: number
  total: number
  percent: number
}

interface PdfLayoutModelRecord {
  id: string
  buffer: ArrayBuffer
  size: number
  sha256: string
  downloadedAt: number
}

export const PDF_LAYOUT_MODEL: PdfLayoutModelDescriptor = {
  id: 'pp-doclayout-m-2026-08',
  fileName: 'PP-DocLayout-M_infer.onnx',
  url: 'https://huggingface.co/X3ZvaWQ/paddleocr-js-onnx/resolve/main/pp_doclayout_m/PP-DocLayout-M_infer.onnx',
  sourceUrl: 'https://huggingface.co/X3ZvaWQ/paddleocr-js-onnx/tree/main/pp_doclayout_m',
  size: 23_496_395,
  sha256: 'c5032bdae772887e9de4d2e955c05c42ac7f38c8c8eb6bdc1b4560dc5cf1c786',
}

const DATABASE_NAME = 'onlytranslate-pdf-layout-models'
const DATABASE_VERSION = 1
const STORE_NAME = 'models'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('PDF 版面模型存储操作失败'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('PDF 版面模型存储事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('PDF 版面模型存储事务已取消'))
  })
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', buffer))
}

export class PdfLayoutModelStore {
  private databasePromise?: Promise<IDBDatabase>
  private downloadPromise?: Promise<PdfLayoutModelStatus>

  constructor(
    private readonly indexedDb: IDBFactory | undefined = globalThis.indexedDB,
    private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
    readonly descriptor: PdfLayoutModelDescriptor = PDF_LAYOUT_MODEL,
  ) {}

  async getStatus(): Promise<PdfLayoutModelStatus> {
    const record = await this.getRecord()
    if (!this.isCurrentRecord(record)) return { installed: false, size: this.descriptor.size }
    return { installed: true, size: record.size, downloadedAt: record.downloadedAt }
  }

  async getModelBuffer(): Promise<ArrayBuffer> {
    const record = await this.getRecord()
    if (!this.isCurrentRecord(record)) throw new Error('PDF 语义排版模型尚未下载')
    const buffer = record.buffer.slice(0)
    if (buffer.byteLength !== this.descriptor.size) {
      await this.remove()
      throw new Error('PDF 语义排版模型已损坏，请重新下载')
    }
    return buffer
  }

  download(
    onProgress?: (progress: PdfLayoutModelDownloadProgress) => void,
    signal?: AbortSignal,
  ): Promise<PdfLayoutModelStatus> {
    if (this.downloadPromise) return this.downloadPromise
    this.downloadPromise = this.downloadModel(onProgress, signal)
      .finally(() => {
        this.downloadPromise = undefined
      })
    return this.downloadPromise
  }

  async remove(): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(this.descriptor.id)
    await transactionDone(transaction)
  }

  close(): void {
    void this.databasePromise?.then(database => database.close())
    this.databasePromise = undefined
  }

  private async downloadModel(
    onProgress?: (progress: PdfLayoutModelDownloadProgress) => void,
    signal?: AbortSignal,
  ): Promise<PdfLayoutModelStatus> {
    const response = await this.fetcher(this.descriptor.url, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`PDF 语义排版模型下载失败：HTTP ${response.status}`)

    const declaredSize = Number(response.headers.get('content-length')) || this.descriptor.size
    if (declaredSize !== this.descriptor.size) throw new Error('PDF 语义排版模型大小与预期不一致')

    const model = new Uint8Array(this.descriptor.size)
    let received = 0
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value?.byteLength) continue
        received += value.byteLength
        if (received > this.descriptor.size) throw new Error('PDF 语义排版模型大小超过预期')
        model.set(value, received - value.byteLength)
        onProgress?.({
          received,
          total: this.descriptor.size,
          percent: Math.min(100, Math.round(received / this.descriptor.size * 100)),
        })
      }
    }
    else {
      const buffer = await response.arrayBuffer()
      received = buffer.byteLength
      if (received <= this.descriptor.size) model.set(new Uint8Array(buffer))
      onProgress?.({ received, total: this.descriptor.size, percent: 100 })
    }

    if (received !== this.descriptor.size) throw new Error('PDF 语义排版模型下载不完整')
    const modelBuffer = model.buffer
    const hash = await sha256(modelBuffer)
    if (hash !== this.descriptor.sha256) throw new Error('PDF 语义排版模型校验失败，请重试')

    const record: PdfLayoutModelRecord = {
      id: this.descriptor.id,
      buffer: modelBuffer,
      size: modelBuffer.byteLength,
      sha256: hash,
      downloadedAt: Date.now(),
    }
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    await transactionDone(transaction)
    return { installed: true, size: record.size, downloadedAt: record.downloadedAt }
  }

  private async getRecord(): Promise<PdfLayoutModelRecord | undefined> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    return requestResult(transaction.objectStore(STORE_NAME).get(this.descriptor.id))
  }

  private isCurrentRecord(record: PdfLayoutModelRecord | undefined): record is PdfLayoutModelRecord {
    return Boolean(
      record
      && record.size === this.descriptor.size
      && record.sha256 === this.descriptor.sha256,
    )
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    const indexedDb = this.indexedDb
    if (!indexedDb) return Promise.reject(new Error('当前环境不支持 PDF 版面模型存储'))
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('无法打开 PDF 版面模型存储'))
      request.onblocked = () => reject(new Error('PDF 版面模型存储正被其他页面占用'))
    })
    return this.databasePromise
  }
}

export const pdfLayoutModelStore = new PdfLayoutModelStore()
