export const BENCHMARK_SCHEMA_VERSION: number
export const BENCHMARK_PROFILES: string[]

export interface BenchmarkCliOptions {
  profiles: string[]
  services: string[]
  runs: number
  warmup: number
  timeoutMs: number
  fastMode: boolean
  dryRun: boolean
  help?: boolean
  configPath?: string
  text?: string
  textFile?: string
  target?: string
  label?: string
  output?: string
}

export interface PublicBenchmarkRequest {
  service: string
  model: string
  protocol: 'openai' | 'gemini' | 'anthropic'
  profile: string
  endpointHost: string
  fastMode: boolean
  requestPolicy: Record<string, unknown>
}

export interface BenchmarkRequest {
  endpoint: string
  headers: Record<string, string>
  body: string
  public: PublicBenchmarkRequest
}

export interface BenchmarkRun {
  run?: number
  warmup?: boolean
  success: boolean
  httpStatus?: number
  headersMs?: number
  firstByteMs?: number
  totalMs: number
  responseBytes?: number
  errorType?: string
}

export function parseBenchmarkArgs(argv: string[]): BenchmarkCliOptions
export function buildBenchmarkRequest(
  config: Record<string, unknown>,
  options: { service?: string; profile?: string; text: string; target?: string; fastMode?: boolean },
): BenchmarkRequest
export function extractRequestPolicy(payload: Record<string, unknown>): Record<string, unknown>
export function executeBenchmarkRequest(
  request: BenchmarkRequest,
  options?: {
    fetchImpl?: typeof fetch
    timeoutMs?: number
    now?: () => number
  },
): Promise<BenchmarkRun>
export function summarizeBenchmarkRuns(runs: BenchmarkRun[]): Record<string, any>
export function benchmarkReportToCsv(report: any): string
export function sanitizeLabel(label: string): string
