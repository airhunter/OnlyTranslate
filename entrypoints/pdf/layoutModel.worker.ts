import * as ort from 'onnxruntime-web/wasm'
import {
  getObjectDetectionPresetOptions,
  ObjectDetectionService,
  type OrtInferenceSession,
  type OrtModule,
} from 'paddleocr'
import type { PdfLayoutRegion } from './semanticLayout'

interface InitializeRequest {
  id: number
  type: 'initialize'
  modelBuffer: ArrayBuffer
  assetBaseUrl: string
}

interface AnalyzeRequest {
  id: number
  type: 'analyze'
  width: number
  height: number
  buffer: ArrayBuffer
}

type WorkerRequest = InitializeRequest | AnalyzeRequest

interface AnalyzeResponse {
  id: number
  regions?: PdfLayoutRegion[]
  elapsedMs?: number
  error?: string
}

export function startPdfLayoutModelWorker(): void {
  let detectorPromise: Promise<ObjectDetectionService> | undefined

  async function createDetector(modelBuffer: ArrayBuffer, assetBaseUrl: string): Promise<ObjectDetectionService> {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmPaths = assetBaseUrl
    const model = new Uint8Array(modelBuffer)
    const session = await ort.InferenceSession.create(model, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      executionMode: 'sequential',
    })
    return new ObjectDetectionService(ort as unknown as OrtModule, session as unknown as OrtInferenceSession, {
      ...getObjectDetectionPresetOptions('PP-DocLayout-M'),
      threshold: 0.35,
      layoutNms: true,
    })
  }

  self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data
    if (request.type === 'initialize') {
      try {
        detectorPromise = createDetector(request.modelBuffer, request.assetBaseUrl)
        await detectorPromise
        self.postMessage({ id: request.id })
      }
      catch (error) {
        detectorPromise = undefined
        self.postMessage({
          id: request.id,
          error: error instanceof Error ? error.message : String(error),
        } satisfies AnalyzeResponse)
      }
      return
    }

    const { id, width, height, buffer } = request
    const startedAt = performance.now()
    try {
      if (!detectorPromise) throw new Error('PDF 语义排版模型尚未初始化')
      const detector = await detectorPromise
      const regions = await detector.run({ width, height, data: new Uint8Array(buffer) }) as PdfLayoutRegion[]
      const response: AnalyzeResponse = {
        id,
        regions,
        elapsedMs: Math.round(performance.now() - startedAt),
      }
      self.postMessage(response)
    }
    catch (error) {
      detectorPromise = undefined
      const response: AnalyzeResponse = {
        id,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    }
  }
}
