import * as ort from 'onnxruntime-web/wasm'
import {
  getObjectDetectionPresetOptions,
  ObjectDetectionService,
  type OrtInferenceSession,
  type OrtModule,
} from 'paddleocr'
import type { PdfLayoutRegion } from './semanticLayout'

interface AnalyzeRequest {
  id: number
  type: 'analyze'
  width: number
  height: number
  buffer: ArrayBuffer
  assetBaseUrl: string
}

interface AnalyzeResponse {
  id: number
  regions?: PdfLayoutRegion[]
  elapsedMs?: number
  error?: string
}

export function startPdfLayoutModelWorker(): void {
  let detectorPromise: Promise<ObjectDetectionService> | undefined
  let detectorAssetBase = ''

  async function createDetector(assetBaseUrl: string): Promise<ObjectDetectionService> {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmPaths = assetBaseUrl
    const response = await fetch(`${assetBaseUrl}PP-DocLayout-M_infer.onnx`)
    if (!response.ok) throw new Error(`无法加载本地 PDF 版面模型：HTTP ${response.status}`)
    const model = new Uint8Array(await response.arrayBuffer())
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

  function getDetector(assetBaseUrl: string): Promise<ObjectDetectionService> {
    if (!detectorPromise || detectorAssetBase !== assetBaseUrl) {
      detectorAssetBase = assetBaseUrl
      detectorPromise = createDetector(assetBaseUrl)
    }
    return detectorPromise
  }

  self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
    const { id, type, width, height, buffer, assetBaseUrl } = event.data
    if (type !== 'analyze') return
    const startedAt = performance.now()
    try {
      const detector = await getDetector(assetBaseUrl)
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
