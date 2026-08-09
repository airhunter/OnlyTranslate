import { describe, expect, it } from 'vitest'
import {
  benchmarkReportToCsv,
  buildBenchmarkRequest,
  executeBenchmarkRequest,
  parseBenchmarkArgs,
  summarizeBenchmarkRuns,
} from '../../scripts/translation-benchmark-lib.mjs'

function exportedConfig(overrides: Record<string, unknown> = {}) {
  return {
    on: true,
    service: 'deepseek',
    from: 'auto',
    to: 'zh-Hans',
    display: 1,
    token: { deepseek: 'secret-deepseek-key' },
    model: { deepseek: 'deepseek-chat' },
    customModel: {},
    proxy: {},
    system_role: {},
    user_role: {},
    thinking: {},
    customProviders: [],
    ...overrides,
  }
}

describe('translation benchmark arguments', () => {
  it('accepts repeatable services and version profiles', () => {
    expect(parseBenchmarkArgs([
      '--config', 'config.json',
      '--service', 'deepseek',
      '--service', 'custom_bailian',
      '--profiles', 'v1.3.0,v1.5.0,current',
      '--runs', '3',
      '--warmup', '0',
    ])).toMatchObject({
      configPath: 'config.json',
      services: ['deepseek', 'custom_bailian'],
      profiles: ['v1.3.0', 'v1.5.0', 'current'],
      runs: 3,
      warmup: 0,
    })
  })

  it('requires a config and rejects unknown profiles', () => {
    expect(() => parseBenchmarkArgs([])).toThrow('--config is required')
    expect(() => parseBenchmarkArgs(['--config', 'a.json', '--profiles', 'v1.4.0'])).toThrow('Unsupported profile')
  })

  it('replaces the default profile when --profile is used', () => {
    expect(parseBenchmarkArgs([
      '--config', 'config.json', '--profile', 'v1.3.0', '--profile', 'v1.5.0',
    ]).profiles).toEqual(['v1.3.0', 'v1.5.0'])
  })
})

describe('translation benchmark request profiles', () => {
  const bailianConfig = exportedConfig({
    service: 'custom_bailian',
    token: {},
    model: {},
    customProviders: [{
      id: 'custom_bailian',
      name: 'Bailian',
      protocol: 'openai',
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      token: 'secret-bailian-key',
      model: '自定义模型',
      customModel: 'qwen3.6-flash',
    }],
  })

  it('reproduces the Bailian/Qwen policy difference across versions', () => {
    const policies = ['v1.3.0', 'v1.5.0', 'current'].map(profile => {
      const request = buildBenchmarkRequest(bailianConfig, { profile, text: 'Hello' })
      expect(request.body).not.toContain('secret-bailian-key')
      expect(request.public).not.toHaveProperty('endpoint')
      expect(JSON.stringify(request.public)).not.toContain('secret-bailian-key')
      return request.public.requestPolicy
    })

    expect(policies[0]).toMatchObject({ reasoning_effort: 'none' })
    expect(policies[1]).not.toHaveProperty('reasoning_effort')
    expect(policies[1]).not.toHaveProperty('enable_thinking')
    expect(policies[2]).toMatchObject({ enable_thinking: false })
  })

  it('keeps secrets only in the private request headers', () => {
    const request = buildBenchmarkRequest(exportedConfig(), { profile: 'current', text: 'Hello' })
    expect(request.headers.Authorization).toBe('Bearer secret-deepseek-key')
    expect(request.public).toEqual(expect.objectContaining({
      service: 'deepseek', model: 'deepseek-chat', endpointHost: 'api.deepseek.com',
    }))
    expect(JSON.stringify(request.public)).not.toContain('secret')
  })
})

describe('translation benchmark measurement and reporting', () => {
  it('measures a valid response without exposing response text', async () => {
    const request = buildBenchmarkRequest(exportedConfig(), { profile: 'current', text: 'Hello' })
    const result = await executeBenchmarkRequest(request, {
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: '你好，这是私密译文' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    })

    expect(result).toMatchObject({ success: true, httpStatus: 200 })
    expect(result.firstByteMs).toBeTypeOf('number')
    expect(result.totalMs).toBeTypeOf('number')
    expect(JSON.stringify(result)).not.toContain('私密译文')
  })

  it('excludes warmups and failures from latency percentiles', () => {
    const summary = summarizeBenchmarkRuns([
      { warmup: true, success: true, totalMs: 999, firstByteMs: 900, headersMs: 800 },
      { warmup: false, success: true, totalMs: 100, firstByteMs: 80, headersMs: 50 },
      { warmup: false, success: true, totalMs: 200, firstByteMs: 160, headersMs: 100 },
      { warmup: false, success: false, totalMs: 300, errorType: 'rate_limit' },
    ])
    expect(summary).toMatchObject({
      measuredRuns: 3,
      successCount: 2,
      failureCount: 1,
      errorTypes: { rate_limit: 1 },
      totalMs: { min: 100, p50: 150, max: 200 },
    })
  })

  it('classifies a 200 response without translated content as a parse failure', async () => {
    const request = buildBenchmarkRequest(exportedConfig(), { profile: 'current', text: 'Hello' })
    const result = await executeBenchmarkRequest(request, {
      fetchImpl: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    })
    expect(result).toMatchObject({ success: false, httpStatus: 200, errorType: 'response_parse' })
  })

  it('writes run-level CSV without request or response content', () => {
    const csv = benchmarkReportToCsv({
      label: 'comparison, august',
      results: [{
        service: 'deepseek', model: 'deepseek-chat', protocol: 'openai', profile: 'current', fastMode: false,
        runs: [{ run: 1, warmup: false, success: true, httpStatus: 200, totalMs: 123 }],
      }],
    })
    expect(csv).toContain('"comparison, august"')
    expect(csv).toContain('deepseek-chat')
    expect(csv).not.toContain('Authorization')
  })
})
