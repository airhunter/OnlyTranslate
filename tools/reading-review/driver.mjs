import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { hash } from './model.mjs'
import { collectorEntry } from './adapters/onlytranslate.mjs'
const execute = promisify(execFile)
export const command = async (name, args, options = {}) => (await execute(name, args, { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024, timeout: 300000, ...options })).stdout
export async function browserConfig(p, extension, purpose = 'replay') {
  const folder = join(p.root, 'output/playwright/reading-review')
  await mkdir(folder, { recursive: true })
  const cache = join(homedir(), 'AppData/Local/ms-playwright')
  let executablePath = process.env.ONLYTRANSLATE_REVIEW_CHROMIUM
  if (!executablePath) {
    const versions = (await readdir(cache)).filter(name => /^chromium-\d+$/.test(name)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]))
    if (!versions.length) throw new Error('请先安装 Playwright Chromium，或设置 ONLYTRANSLATE_REVIEW_CHROMIUM')
    executablePath = join(cache, versions[0], 'chrome-win64/chrome.exe')
  }
  const name = 'rr-' + hash(p.data).slice(0, 7) + (extension ? '-release' : purpose === 'capture' ? '-capture' : purpose.startsWith('build-check-') ? '-' + purpose : '-replay')
  const path = join(folder, name + '.config.json')
  await writeFile(path, JSON.stringify({ outputDir: folder, browser: { browserName: 'chromium', isolated: false,
    launchOptions: { executablePath, channel: 'chromium', headless: true, args: extension ? [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] : [] },
    contextOptions: { viewport: { width: 1440, height: 950 }, locale: 'zh-CN', ...(extension ? {} : { serviceWorkers: 'block' }) } } }))
  return { name, path, folder }
}
async function cli(browser, args) {
  return command(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'), '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=' + browser.name, ...args], { timeout: 360000 })
}
export async function openBrowser(browser) { await cli(browser, ['open', 'about:blank', '--config', browser.path]) }
export async function runBrowser(browser, code) {
  const file = join(browser.folder, hash(code).slice(0, 16) + '.js')
  await writeFile(file, code)
  const output = await cli(browser, ['run-code', '--filename', file])
  const found = /### Result\s*\r?\n([\s\S]*?)\r?\n### Ran Playwright code/.exec(output)
  if (!found) throw new Error(output.slice(0, 1800))
  return JSON.parse(found[1])
}
export async function closeBrowser(browser) { await cli(browser, ['close']).catch(()=>{}) }
export async function fingerprintSources(root) {
  const files=[...new Set((await command('git',['ls-files','--cached','--others','--exclude-standard','--','entrypoints'],{cwd:root})).trim().split(/\r?\n/).filter(Boolean))].sort()
  return hash(JSON.stringify(await Promise.all(files.map(async file=>{
    try{return[file,hash(await readFile(join(root,file)))]}catch(error){if(error.code==='ENOENT')return[file,null];throw error}
  }))))
}
export async function buildCollector(p, sourceRoot, metadata, output) {
  const { build } = await import('vite')
  if (sourceRoot !== p.root) {
    await mkdir(join(sourceRoot, '.wxt'), { recursive: true })
    await writeFile(join(sourceRoot, '.wxt/tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler' } }))
  }
  const entry = join(dirname(output), 'reading-review-entry.ts')
  const collector = await readFile(collectorEntry, 'utf8')
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(entry, collector)
  await build({ configFile: false, resolve: { alias: { '@': sourceRoot } }, define: { 'process.env.NODE_ENV': JSON.stringify('production'), __REVIEW_BUILD__: JSON.stringify({ ...metadata, collectorHash: hash(collector) }) }, build: { outDir: dirname(output), emptyOutDir: false, copyPublicDir: false, lib: { entry, name: 'ReadingReview', formats: ['iife'], fileName: () => output.split(/[\\/]/).pop() } } })
  return await readFile(output, 'utf8')
}
