import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { capture, replay } from './browser.mjs'

const samples = {
  'devin-changelog': {
    url: 'https://docs.devin.ai/desktop/changelog',
    ready: 'h1',
    scrollToEnd: true,
    probes: [],
    exclusions: []
  },
  'josh-css-has': {
    url: 'https://www.joshwcomeau.com/css/has/',
    ready: 'aside p',
    probes: ['Intended audience', 'This blog post is intended for developers', 'You might be wondering about the performance implications'],
    exclusions: ['It appears that your browser does not support the']
  },
  'teapaw-home': {
    url: 'https://teapaw.org/',
    ready: 'main .landing-page',
    probes: ['Profiles and RSS are fast again', 'Search requires a check'],
    exclusions: ['This month 51% Donate', '$154.60 of $300', 'Resets November 23 (UTC)']
  },
  'lil-log-home': {
    url: 'https://lilianweng.github.io/',
    ready: 'main',
    probes: [],
    exclusions: []
  },
  'ziggit-topic': {
    url: 'https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822',
    ready: '.topic-post .cooked p',
    focus: { anchor: '#post_6', content: '#post_6 .cooked p' },
    probes: ['This is effectively the same, its just that zig is exporting'],
    exclusions: ['Powered by Discourse', 'May 31']
  }
}

const hash = value => createHash('sha256').update(value).digest('hex')
const json = value => JSON.stringify(value, null, 2) + '\n'
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

async function run(session, source) {
  const dir = await mkdtemp(join(tmpdir(), 'onlytranslate-reading-audit-'))
  const file = join(dir, 'run.js')
  try {
    await writeFile(file, source)
    const prefix = process.platform === 'win32'
      ? [process.execPath, join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js')]
      : ['npx']
    const [command, ...args] = prefix
    const output = execFileSync(command, [
      ...args, '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=' + session,
      'run-code', '--filename', file
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 })
    const result = /### Result\s*\r?\n([\s\S]*?)\r?\n### Ran Playwright code/.exec(output)
    if (!result) throw new Error(output.slice(0, 1500))
    return JSON.parse(result[1])
  } finally {
    await rm(file, { force: true })
    await rmdir(dir)
  }
}

async function buildCollector(file) {
  const { build } = await import('vite')
  const revision = git('rev-parse', 'HEAD')
  const sourceDirty = Boolean(git('status', '--porcelain', '--', 'entrypoints'))
  const diff = execFileSync('git', ['diff', '--binary', 'HEAD', '--', 'entrypoints'])
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'entrypoints').split('\n').filter(Boolean)
  const sourceHash = hash(json({
    gitDiffHash: hash(diff),
    untracked: await Promise.all(untracked.map(async path => [path, hash(await readFile(path))]))
  }))
  await build({
    configFile: false,
    resolve: { alias: { '@': resolve('.') } },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __AUDIT_REVISION__: JSON.stringify(revision),
      __AUDIT_SOURCE_DIRTY__: JSON.stringify(sourceDirty),
      __AUDIT_GIT_DIFF_HASH__: JSON.stringify(hash(diff)),
      __AUDIT_SOURCE_HASH__: JSON.stringify(sourceHash)
    },
    build: {
      outDir: dirname(resolve(file)),
      emptyOutDir: false,
      copyPublicDir: false,
      lib: {
        entry: 'scripts/smart-reading-audit/collector.ts',
        name: 'OnlyTranslateReadingAudit',
        formats: ['iife'],
        fileName: () => basename(file)
      }
    }
  })
}

async function captureSample(session, name, outDir) {
  const sample = samples[name]
  if (!sample) throw new Error('Unknown sample: ' + name)
  await mkdir(outDir, { recursive: true })
  const screenshot = resolve(outDir, name + '-full.png')
  const snapshot = await run(session, `async page => {
    const tab = await page.context().newPage();
    try {
      await tab.setViewportSize({ width: 1440, height: 950 });
      return await (${capture})(tab, ${JSON.stringify(sample)}, ${JSON.stringify(screenshot)});
    } finally { await tab.close(); }
  }`)
  snapshot.name = name
  snapshot.requestedUrl = sample.url
  snapshot.probes = sample.probes
  snapshot.exclusions = sample.exclusions
  const { html, initial, focused, ...metadata } = snapshot
  for (const [stage, state] of Object.entries({ initial, focused })) {
    if (!state) continue
    const { html: stageHtml, ...stageState } = state
    await writeFile(join(outDir, name + '-' + stage + '.html'), stageHtml)
    metadata[stage] = stageState
  }
  await writeFile(join(outDir, name + '.html'), html)
  await writeFile(join(outDir, name + '.snapshot.json'), json(metadata))
  console.log(json({ name, url: metadata.url, initial: metadata.initial, focused: metadata.focused, final: metadata.final }))
}

async function collectSnapshot(session, snapshotFile, bundleFile, resultFile, stage) {
  if (!snapshotFile.endsWith('.snapshot.json')) throw new Error('Expected a .snapshot.json file')
  if (!['initial', 'focused', 'final'].includes(stage)) throw new Error('Expected initial, focused, or final stage')
  const metadata = JSON.parse(await readFile(snapshotFile, 'utf8'))
  if (!metadata[stage]) throw new Error('This sample has no ' + stage + ' capture')
  const stem = snapshotFile.slice(0, -'.snapshot.json'.length)
  const html = await readFile(stem + (stage === 'final' ? '.html' : '-' + stage + '.html'), 'utf8')
  const snapshot = {
    url: metadata.url,
    viewport: metadata.viewport,
    scrollY: metadata[stage].scrollY ?? 0,
    stylesheets: metadata.stylesheets,
    html
  }
  const bundle = await readFile(bundleFile, 'utf8')
  const probes = [...metadata.probes, ...metadata.exclusions]
  const variants = await run(session, `async page => {
    const results = [];
    for (const enabled of [true, false]) {
      const tab = await page.context().newPage();
      try { results.push(await (${replay})(tab, ${JSON.stringify(snapshot)}, ${JSON.stringify(bundle)}, ${JSON.stringify(probes)}, enabled)); }
      finally { await tab.close(); }
    }
    return results;
  }`)
  await writeFile(resultFile, json({
    name: metadata.name,
    stage,
    snapshotHash: hash(JSON.stringify(snapshot)),
    bundleHash: hash(bundle),
    exclusions: metadata.exclusions,
    variants
  }))
  console.log(json(variants.map(({ revision, siteProfilesEnabled, targets, stats, probes }) =>
    ({ revision, siteProfilesEnabled, targets: targets.length, stats, probes }))))
}

function diffResults(before, after) {
  if (before.snapshotHash !== after.snapshotHash) throw new Error('Cannot compare different snapshots')
  const key = target => JSON.stringify([target.path, target.textHash])
  const changes = before.variants.map(previous => {
    const current = after.variants.find(variant => variant.siteProfilesEnabled === previous.siteProfilesEnabled)
    if (!current) throw new Error('No matching profile variant')
    const oldTargets = new Set(previous.targets.map(key))
    const newTargets = new Set(current.targets.map(key))
    return {
      siteProfilesEnabled: previous.siteProfilesEnabled,
      beforeRevision: previous.revision,
      afterRevision: current.revision,
      beforeSourceHash: previous.sourceHash ?? null,
      afterSourceHash: current.sourceHash ?? null,
      beforeGitDiffHash: previous.gitDiffHash ?? null,
      afterGitDiffHash: current.gitDiffHash ?? null,
      beforeStats: previous.stats,
      afterStats: current.stats,
      removed: previous.targets.filter(target => !newTargets.has(key(target))),
      added: current.targets.filter(target => !oldTargets.has(key(target)))
    }
  })
  return { snapshotHash: before.snapshotHash, beforeBundleHash: before.bundleHash, afterBundleHash: after.bundleHash, changes }
}

async function compare(beforeFile, afterFile, resultFile) {
  const [before, after] = await Promise.all([beforeFile, afterFile].map(async file => JSON.parse(await readFile(file, 'utf8'))))
  const result = diffResults(before, after)
  await writeFile(resultFile, json(result))
  console.log(json(result.changes.map(({ siteProfilesEnabled, removed, added }) =>
    ({ siteProfilesEnabled, removed: removed.length, added: added.length }))))
}

async function readFixtures() {
  const dir = 'tests/fixtures/translation-target'
  return Promise.all((await readdir(dir)).filter(name => name.endsWith('.json')).sort().map(async file => {
    const fixture = JSON.parse(await readFile(join(dir, file), 'utf8'))
    return { ...fixture, id: file.slice(0, -5), fixtureFile: join(dir, fixture.html) }
  }))
}

async function captureCorpus(session, outDir) {
  await mkdir(outDir, { recursive: true })
  const urls = [...new Set((await readFixtures()).map(fixture => fixture.url))]
  const manifest = []
  const eligible = urls.filter(url => {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const reason = /(?:^|\.)(?:x\.com|twitter\.com|reddit\.com|threads\.net|threads\.com)$/.test(host)
      ? 'login-or-platform-gate' : host.endsWith('.example') ? 'synthetic-fixture-url' : null
    if (reason) manifest.push({ url, status: 'skipped', reason })
    return !reason
  })
  const manifestFile = join(outDir, 'manifest.json')
  await writeFile(manifestFile, json({ requested: urls.length, pages: manifest }))
  for (let offset = 0; offset < eligible.length; offset += 6) {
    const batch = eligible.slice(offset, offset + 6)
    const captured = await run(session, `async page => {
      const capture = ${capture};
      return Promise.all(${JSON.stringify(batch)}.map(async url => {
        const tab = await page.context().newPage();
        try {
          await tab.setViewportSize({ width: 1440, height: 950 });
          const data = await capture(tab, { url, ready: 'body', scrollToEnd: true, probes: [], corpus: true });
          return { requestedUrl: url, data };
        } catch (error) { return { requestedUrl: url, error: String(error).split('\\n')[0] }; }
        finally { await tab.close(); }
      }));
    }`)
    for (const { requestedUrl: url, data, error } of captured) {
      if (!data) {
        manifest.push({ url, status: 'failed', reason: error })
        continue
      }
      const name = hash(url).slice(0, 16)
      const { html, ...metadata } = data
      await writeFile(join(outDir, name + '.html'), html)
      await writeFile(join(outDir, name + '.snapshot.json'), json({ ...metadata, name, requestedUrl: url, probes: [], exclusions: [] }))
      manifest.push({ url, finalUrl: metadata.url, name, status: 'captured' })
    }
    await writeFile(manifestFile, json({ requested: urls.length, pages: manifest }))
    console.log(`Corpus capture ${manifest.length}/${urls.length}`)
  }
}

async function compareCorpus(session, beforeBundle, afterBundle, outDir, liveDir) {
  await mkdir(outDir, { recursive: true })
  const [beforeCode, afterCode] = await Promise.all([beforeBundle, afterBundle].map(file => readFile(file, 'utf8')))
  if (hash(beforeCode) === hash(afterCode)) throw new Error('Corpus comparison requires distinct bundles')
  const cases = liveDir
    ? (JSON.parse(await readFile(join(liveDir, 'manifest.json'), 'utf8'))).pages.filter(page => page.status === 'captured')
    : (await readFixtures()).filter(fixture => fixture.scope === 'smart')
  const summary = []
  for (let offset = 0; offset < cases.length; offset += 5) {
    const batch = await Promise.all(cases.slice(offset, offset + 5).map(async item => {
      if (liveDir) {
        const metadata = JSON.parse(await readFile(join(liveDir, item.name + '.snapshot.json'), 'utf8'))
        const html = await readFile(join(liveDir, item.name + '.html'), 'utf8')
        return { id: item.name, url: item.url, snapshot: { url: metadata.url, viewport: metadata.viewport, scrollY: metadata.final.scrollY, stylesheets: metadata.stylesheets, html } }
      }
      const html = await readFile(item.fixtureFile, 'utf8')
      return { id: item.id, url: item.url, snapshot: { url: item.url, viewport: { width: 1440, height: 950 }, scrollY: 0, stylesheets: [], html } }
    }))
    const result = await run(session, `async page => {
      const replay = ${replay}, bundles = ${JSON.stringify([beforeCode, afterCode])};
      return Promise.all(${JSON.stringify(batch)}.map(async item => {
        const pair = [];
        try {
          for (const code of bundles) {
            const variants = [];
            for (const enabled of [true, false]) {
              const tab = await page.context().newPage();
              try { variants.push(await replay(tab, item.snapshot, code, [], enabled)); }
              finally { await tab.close(); }
            }
            pair.push(variants);
          }
          return { pair };
        } catch (error) { return { error: String(error).split('\\n')[0] }; }
      }));
    }`)
    for (const [index, item] of batch.entries()) {
      const { pair, error } = result[index]
      if (!pair) { summary.push({ id: item.id, url: item.url, error }); continue }
      const snapshotHash = hash(JSON.stringify(item.snapshot))
      const before = { snapshotHash, bundleHash: hash(beforeCode), variants: pair[0] }
      const after = { snapshotHash, bundleHash: hash(afterCode), variants: pair[1] }
      const diff = diffResults(before, after)
      await writeFile(join(outDir, item.id + '.baseline.targets.json'), json(before))
      await writeFile(join(outDir, item.id + '.candidate.targets.json'), json(after))
      await writeFile(join(outDir, item.id + '.diff.json'), json(diff))
      summary.push({
        id: item.id, url: item.url,
        variants: diff.changes.map(change => ({
          profiles: change.siteProfilesEnabled, added: change.added.length, removed: change.removed.length,
          scannedBefore: change.beforeStats?.scannedElements, scannedAfter: change.afterStats?.scannedElements,
          budgetExceeded: change.afterStats?.budgetExceeded, deferredSubtrees: change.afterStats?.budgetDeferredReadingSubtrees
        }))
      })
    }
    await writeFile(join(outDir, 'summary.json'), json(summary))
    console.log(`Corpus comparison ${summary.length}/${cases.length}`)
  }
}

const [action, ...args] = process.argv.slice(2)
if (action === 'build' && args.length === 1) await buildCollector(args[0])
else if (action === 'capture' && args.length === 3) await captureSample(...args)
else if (action === 'collect' && args.length >= 4 && args.length <= 5) {
  const [session, snapshot, bundle, result, stage = 'final'] = args
  await collectSnapshot(session, snapshot, bundle, result, stage)
} else if (action === 'compare' && args.length === 3) await compare(...args)
else if (action === 'capture-corpus' && args.length === 2) await captureCorpus(...args)
else if (action === 'compare-corpus' && (args.length === 4 || args.length === 5)) await compareCorpus(...args)
else throw new Error(`Usage:
  node scripts/smart-reading-audit/audit.mjs build <bundle.js>
  node scripts/smart-reading-audit/audit.mjs capture <live-session> <${Object.keys(samples).join('|')}> <output-dir>
  node scripts/smart-reading-audit/audit.mjs collect <offline-session> <file.snapshot.json> <bundle.js> <result.json> [initial|focused|final]
  node scripts/smart-reading-audit/audit.mjs compare <before.json> <after.json> <diff.json>
  node scripts/smart-reading-audit/audit.mjs capture-corpus <live-session> <output-dir>
  node scripts/smart-reading-audit/audit.mjs compare-corpus <offline-session> <baseline.js> <candidate.js> <output-dir> [live-snapshot-dir]`)
