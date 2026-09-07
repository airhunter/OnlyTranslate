import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { writeFile } from 'node:fs/promises'

const [label, mode = 'smart'] = process.argv.slice(2)
if (!label || !/^[a-z0-9-]+$/.test(label) || !['smart', 'full', 'dynamic', 'more', 'expand', 'compare'].includes(mode)) throw new Error('Usage: node scripts/shadow-audit/run.mjs <label> [smart|full|dynamic|more|expand|compare]')
const npx = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js')
const { stdout } = await promisify(execFile)(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', 'shadow-prototype', 'run-code', '--filename', `output/playwright/shadow-audit/run-${mode}.js`], { maxBuffer: 16 * 1024 * 1024, timeout: 180000 })
await writeFile(`output/playwright/shadow-audit/${label}-${mode}.log`, stdout)
const match = stdout.match(/### Result\s*\n([\s\S]*?)\n### Ran Playwright code/)
if (!match) throw new Error(stdout.slice(0, 2000))
const result = JSON.parse(match[1])
await writeFile(`output/playwright/shadow-audit/${label}-${mode}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(mode === 'compare'
  ? result
  : ['dynamic', 'more', 'expand'].includes(mode)
  ? { url: result.url, stats: result.stats, beforeTargets: result.beforeTargets, afterTargets: result.afterTargets, expectedNew: result.expectedNew.length, missedNew: result.missedNew.length, observedRoots: result.observedRoots, connectedRoots: result.connectedRoots }
  : { url: result.url, mode, rounds: result.rounds.map(r => ({ baselineMs: r.baseline.ms, baselineTargets: r.baseline.targets.length, roots: r.discovery.roots, discoveryMs: r.discovery.activeMs, discoveryMaxSliceMs: r.discovery.maxSliceMs, shadowMs: r.shadow.activeMs, maxRootMs: r.shadow.maxRootMs, addedTargets: r.shadow.targets.length, unchanged: r.baselineUnchanged })), longTasks: result.longTasks }, null, 2))
