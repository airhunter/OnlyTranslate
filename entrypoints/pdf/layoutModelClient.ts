import browser from 'webextension-polyfill'
import type { PdfLayoutRegion } from './semanticLayout'
import { pdfLayoutModelStore } from './layoutModelStore'

export const PDF_LAYOUT_WORKER_PATH = '/pdf-layout-model.js'

export function getPdfLayoutWorkerUrl(
  runtime: Pick<typeof browser.runtime, 'getURL'> = browser.runtime,
): string {
  return runtime.getURL(PDF_LAYOUT_WORKER_PATH)
}

interface AnalyzeResponse {
  id: number
  regions?: PdfLayoutRegion[]
  elapsedMs?: number
  error?: string
}

export interface PdfLayoutAnalysis {
  regions: PdfLayoutRegion[]
  elapsedMs: number
}

interface PendingRequest {
  resolve(value: PdfLayoutAnalysis): void
  reject(reason: Error): void
}

export class PdfLayoutModelClient {
  private worker?: Worker
  private requestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private initialization?: Promise<void>

  constructor(
    private readonly loadModel: () => Promise<ArrayBuffer> = () => pdfLayoutModelStore.getModelBuffer(),
  ) {}

  async analyze(imageData: ImageData, assetBaseUrl: string): Promise<PdfLayoutAnalysis> {
    const worker = this.getWorker()
    await this.initialize(worker, assetBaseUrl)
    const id = ++this.requestId
    const pixels = new Uint8Array(imageData.data)
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({
        id,
        type: 'analyze',
        width: imageData.width,
        height: imageData.height,
        buffer: pixels.buffer,
      }, [pixels.buffer])
    })
  }

  destroy(): void {
    this.worker?.terminate()
    this.worker = undefined
    this.initialization = undefined
    for (const request of this.pending.values()) request.reject(new Error('PDF 版面分析已取消'))
    this.pending.clear()
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(getPdfLayoutWorkerUrl(), { type: 'module' })
    worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
      const request = this.pending.get(event.data.id)
      if (!request) return
      this.pending.delete(event.data.id)
      if (event.data.error) request.reject(new Error(event.data.error))
      else request.resolve({ regions: event.data.regions ?? [], elapsedMs: event.data.elapsedMs ?? 0 })
    }
    worker.onerror = event => {
      const error = new Error(event.message || 'PDF 版面分析 Worker 运行失败')
      for (const request of this.pending.values()) request.reject(error)
      this.pending.clear()
      worker.terminate()
      if (this.worker === worker) {
        this.worker = undefined
        this.initialization = undefined
      }
    }
    worker.onmessageerror = () => worker.onerror?.(new ErrorEvent('error', {
      message: 'PDF 版面分析 Worker 消息无法解析',
    }))
    this.worker = worker
    return worker
  }

  private initialize(worker: Worker, assetBaseUrl: string): Promise<void> {
    if (this.initialization) return this.initialization
    this.initialization = (async () => {
      const modelBuffer = await this.loadModel()
      const id = ++this.requestId
      await new Promise<PdfLayoutAnalysis>((resolve, reject) => {
        this.pending.set(id, { resolve, reject })
        worker.postMessage({
          id,
          type: 'initialize',
          modelBuffer,
          assetBaseUrl,
        }, [modelBuffer])
      })
    })().catch((error) => {
      this.initialization = undefined
      throw error
    })
    return this.initialization
  }
}
