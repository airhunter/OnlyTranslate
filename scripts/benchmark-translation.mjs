#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import process from 'node:process'
import {
  BENCHMARK_SCHEMA_VERSION,
  benchmarkReportToCsv,
  buildBenchmarkRequest,
  executeBenchmarkRequest,
  parseBenchmarkArgs,
  sanitizeLabel,
  summarizeBenchmarkRuns,
} from './translation-benchmark-lib.mjs'

const DEFAULT_TEXT = `Artificial intelligence can help people understand information written in other languages, but a useful translation must preserve meaning, tone, and context. Speed also matters: readers should see the first result quickly and should not have to wait unnecessarily for the entire page.`

const HELP = `OnlyTranslate live translation benchmark

Usage:
  pnpm benchmark:translation -- --config /path/to/only-translate-config.json [options]

Options:
  --service <id>       Service to test; repeat for multiple services (default: selected service)
  --profiles <list>    Comma-separated v1.3.0,v1.5.0,current (default: current)
  --runs <count>       Measured runs per service/profile (default: 5)
  --warmup <count>     Warm-up runs excluded from statistics (default: 1)
  --timeout-ms <ms>    Timeout for each raw request (default: 60000)
  --text <value>       Fixed source text (default: built-in English paragraph)
  --text-file <path>   Read source text from a UTF-8 file
  --target <language>  Override the exported target language
  --fast-mode          Pass the historical speed-priority request policy
  --label <value>      Label stored in the report (default: package version/profile comparison)
  --output <path>      Output basename or .json path (default: benchmark-results/...)
  --dry-run            Print redacted request policies without sending requests
  --help               Show this help

The exported configuration contains API credentials. The benchmark reads it locally and never
stores tokens, prompts, source text, response text, or endpoint query strings in its reports.
`

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function rotate(values, offset) {
  if (!values.length) return []
  const index = offset % values.length
  return [...values.slice(index), ...values.slice(0, index)]
}

function outputBasePath(value, label) {
  if (!value) return resolve('benchmark-results', `translation-${timestampForFilename()}-${sanitizeLabel(label)}`)
  const absolute = resolve(value)
  return extname(absolute) === '.json' || extname(absolute) === '.csv'
    ? absolute.slice(0, -extname(absolute).length)
    : absolute
}

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  }
  catch (error) {
    throw new Error(`Unable to read config JSON "${path}": ${error.message}`)
  }
}

async function main() {
  const options = parseBenchmarkArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(HELP)
    return
  }

  const configPath = resolve(options.configPath)
  const config = await loadJson(configPath)
  const text = options.textFile ? await readFile(resolve(options.textFile), 'utf8') : options.text || DEFAULT_TEXT
  if (!text.trim()) throw new Error('Benchmark text must not be empty')
  const services = options.services.length ? options.services : [config.service]
  const requests = []
  for (const service of services) {
    for (const profile of options.profiles) {
      requests.push(buildBenchmarkRequest(config, {
        service, profile, text, target: options.target, fastMode: options.fastMode,
      }))
    }
  }

  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(requests.map(request => request.public), null, 2)}\n`)
    return
  }

  const label = options.label || `profiles-${options.profiles.join('-vs-')}`
  const report = {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    label,
    generatedAt: new Date().toISOString(),
    configSource: basename(configPath),
    textCharacters: [...text].length,
    targetLanguage: options.target || config.to || 'zh-Hans',
    runsPerCase: options.runs,
    warmupRunsPerCase: options.warmup,
    timeoutMs: options.timeoutMs,
    note: 'The extension uses non-streaming requests; firstByteMs is the first HTTP response body byte, not the first visible translated segment.',
    results: requests.map(request => ({ ...request.public, runs: [], summary: undefined })),
  }

  const totalIterations = options.warmup + options.runs
  for (let iteration = 0; iteration < totalIterations; iteration += 1) {
    const warmup = iteration < options.warmup
    for (const request of rotate(requests, iteration)) {
      const resultIndex = requests.indexOf(request)
      const descriptor = report.results[resultIndex]
      const runNumber = warmup ? iteration + 1 : iteration - options.warmup + 1
      process.stdout.write(
        `${warmup ? 'warmup' : 'run'} ${runNumber}/${warmup ? options.warmup : options.runs} `
        + `${descriptor.service} ${descriptor.profile} ${descriptor.model} ... `,
      )
      const result = await executeBenchmarkRequest(request, { timeoutMs: options.timeoutMs })
      const normalized = {
        run: runNumber,
        warmup,
        ...result,
        headersMs: result.headersMs === undefined ? undefined : Math.round(result.headersMs * 10) / 10,
        firstByteMs: result.firstByteMs === undefined ? undefined : Math.round(result.firstByteMs * 10) / 10,
        totalMs: Math.round(result.totalMs * 10) / 10,
      }
      descriptor.runs.push(normalized)
      process.stdout.write(result.success ? `${normalized.totalMs} ms\n` : `failed (${result.errorType})\n`)
    }
  }

  for (const result of report.results) result.summary = summarizeBenchmarkRuns(result.runs)
  const basePath = outputBasePath(options.output, label)
  await mkdir(dirname(basePath), { recursive: true })
  await writeFile(`${basePath}.json`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
  await writeFile(`${basePath}.csv`, benchmarkReportToCsv(report), { mode: 0o600 })

  process.stdout.write('\nSummary (successful measured runs only)\n')
  for (const result of report.results) {
    const total = result.summary.totalMs
    process.stdout.write(
      `${result.service} ${result.profile}: `
      + (total
        ? `total p50=${total.p50} ms p95=${total.p95} ms, first-byte p50=${result.summary.firstByteMs?.p50 ?? 'n/a'} ms`
        : `no successful runs (${JSON.stringify(result.summary.errorTypes)})`)
      + '\n',
    )
  }
  process.stdout.write(`\nJSON: ${basePath}.json\nCSV:  ${basePath}.csv\n`)
}

main().catch(error => {
  process.stderr.write(`Benchmark failed: ${error.message}\n`)
  process.exitCode = 1
})
