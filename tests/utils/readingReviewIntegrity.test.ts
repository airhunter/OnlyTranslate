// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { saveCapturedSnapshot } from '../../scripts/reading-review/archive.mjs'
import { prepareReleaseInputs } from '../../scripts/reading-review/release.mjs'
import { hash, readJson, validId, writeJson } from '../../scripts/reading-review/model.mjs'

const fake = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('../../scripts/reading-review/driver.mjs', () => ({ command: fake.command }))
const folders: string[] = []
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }) })

async function archiveFixture() {
  const root = await mkdtemp(join(tmpdir(), 'reading-archive-')); folders.push(root)
  const p = { root, snapshots: join(root, 'snapshots'), assets: join(root, 'assets') }
  const page = { id: 'sample', url: 'https://example.org/' }, screenshot = join(root, 'capture.png')
  await writeFile(screenshot, 'original screenshot')
  const captured = (css = 'body{color:black}') => ({ html: '<body><p>Original paragraph.</p></body>', url: page.url, title: 'Sample',
    viewport: { width: 1000, height: 800 }, scrollY: 0, focused: false, omitted: 0,
    catalogue: { texts: [{ id: 't1', text: 'Original paragraph.' }], blocks: [{ id: 'e1', text: 'Original paragraph.', textIds: ['t1'], visible: true }] },
    assets: [{ url: 'https://example.org/style.css', type: 'text/css', body: Buffer.from(css).toString('base64') }] })
  return { root, p, page, screenshot, captured }
}

it('never overwrites an older snapshot or its pinned baseline when identical HTML is recaptured', async () => {
  const f = await archiveFixture(), first = await saveCapturedSnapshot(f.p, f.page, f.captured(), f.screenshot)
  const oldFolder = join(f.p.snapshots, f.page.id, first.id), original = await readFile(join(oldFolder, 'snapshot.json'), 'utf8')
  await writeJson(join(oldFolder, 'comparison.json'), { baselineRunId: 'original-baseline' })
  await writeFile(f.screenshot, 'new screenshot')
  const changed = f.captured('body{display:none}')
  changed.viewport.width = 600; changed.catalogue.blocks[0].visible = false
  const second = await saveCapturedSnapshot(f.p, f.page, changed, f.screenshot)
  expect(second.id).not.toBe(first.id)
  expect(second.htmlHash).toBe(first.htmlHash)
  expect(await readFile(join(oldFolder, 'snapshot.json'), 'utf8')).toBe(original)
  expect(await readFile(join(oldFolder, 'original.png'), 'utf8')).toBe('original screenshot')
  expect(await readJson(join(oldFolder, 'comparison.json'))).toEqual({ baselineRunId: 'original-baseline' })
  expect((await readdir(f.p.assets)).every(name => /^[a-f0-9]{64}$/.test(name))).toBe(true)
  expect(await readJson(join(f.p.snapshots, f.page.id, 'latest.json'))).toEqual({ id: second.id })
  const third = await saveCapturedSnapshot(f.p, f.page, changed, f.screenshot)
  expect(third.id).not.toBe(second.id)
})

it('does not expose a partially archived snapshot or change latest when archiving fails', async () => {
  const f = await archiveFixture(), first = await saveCapturedSnapshot(f.p, f.page, f.captured(), f.screenshot)
  const missingImage = f.captured(); missingImage.html += '<!-- incomplete capture -->'
  await expect(saveCapturedSnapshot(f.p, f.page, missingImage, join(f.root, 'missing.png'))).rejects.toThrow()
  const broken = f.captured()
  broken.html += '<!-- interrupted resources -->'
  broken.assets.push({ url: 'https://example.org/broken.css', type: 'text/css', body: null as unknown as string })
  await expect(saveCapturedSnapshot(f.p, f.page, broken, f.screenshot)).rejects.toThrow()
  const directories = await readdir(join(f.p.snapshots, f.page.id), { withFileTypes: true })
  expect(directories.filter(item => item.isDirectory() && validId(item.name)).map(item => item.name)).toEqual([first.id])
  expect(await readJson(join(f.p.snapshots, f.page.id, 'latest.json'))).toEqual({ id: first.id })
})

it('does not overwrite an existing corrupt content-addressed resource while archiving a new snapshot', async () => {
  const f = await archiveFixture(), first = await saveCapturedSnapshot(f.p, f.page, f.captured(), f.screenshot)
  await writeFile(join(f.p.assets, first.assets[0].hash), 'corrupt bytes')
  await expect(saveCapturedSnapshot(f.p, f.page, f.captured(), f.screenshot)).rejects.toThrow('资源摘要')
  expect(await readFile(join(f.p.assets, first.assets[0].hash), 'utf8')).toBe('corrupt bytes')
  expect(await readJson(join(f.p.snapshots, f.page.id, 'latest.json'))).toEqual({ id: first.id })
})

async function releaseFixture() {
  const root = await mkdtemp(join(tmpdir(), 'reading-release-')); folders.push(root)
  const release = { tag: 'v1.0.0', commit: 'a'.repeat(40), asset: 'published.zip', sha256: hash('verified zip'), settings: {} }
  const p = { root, release: join(root, 'release.json') }
  await mkdir(join(root, '.output')); await writeFile(join(root, '.output', release.asset), 'verified zip'); await writeJson(p.release, release)
  const control = { failSourceExtraction: false, commit: release.commit }
  fake.command.mockReset().mockImplementation(async (name: string, args: string[]) => {
    if (name === 'git' && args[0] === 'rev-parse') return control.commit
    if (name === 'git' && args[0] === 'archive') {
      await writeFile(args.find(value => value.startsWith('--output='))!.slice(9), 'source archive from ' + args.at(-1)); return ''
    }
    if (name === 'tar') {
      const folder = args[args.indexOf('-C') + 1]
      await mkdir(folder, { recursive: true })
      if (folder.endsWith('extension')) {
        await writeJson(join(folder, 'manifest.json'), { version: '1.0.0' }); await writeFile(join(folder, 'background.js'), 'trusted extension')
      } else {
        await writeJson(join(folder, 'package.json'), { version: '1.0.0' })
        if (control.failSourceExtraction) throw new Error('interrupted extraction')
        await writeFile(join(folder, 'recognizer.ts'), 'trusted recognizer')
      }
      return ''
    }
    throw new Error('Unexpected command: ' + name)
  })
  return { root, p, release, control }
}

it('rebuilds release inputs from verified archives instead of trusting a same-version cached directory', async () => {
  const f = await releaseFixture(), cached = join(f.root, 'output/reading-review-build', f.release.tag)
  await writeJson(join(cached, 'extension/manifest.json'), { version: '1.0.0' })
  await writeFile(join(cached, 'extension/background.js'), 'changed extension')
  await writeJson(join(cached, 'source/package.json'), { version: '1.0.0' })
  await writeFile(join(cached, 'source/recognizer.ts'), 'changed recognizer')
  const inputs = await prepareReleaseInputs(f.p)
  expect(inputs.folder).not.toBe(cached)
  expect(await readFile(join(inputs.extension, 'background.js'), 'utf8')).toBe('trusted extension')
  expect(await readFile(join(inputs.source, 'recognizer.ts'), 'utf8')).toBe('trusted recognizer')
  expect(await readFile(join(cached, 'source/recognizer.ts'), 'utf8')).toBe('changed recognizer')
  expect(fake.command.mock.calls.some(([name, args]) => name === 'git' && args[0] === 'archive' && args.at(-1) === f.release.commit)).toBe(true)
  const unpack = fake.command.mock.calls.find(([name, args]) => name === 'tar' && args.at(-1) === inputs.extension)![1]
  expect(unpack[1]).not.toBe(join(f.root, '.output', f.release.asset))
  expect(hash(await readFile(unpack[1]))).toBe(f.release.sha256)
})

it('does not reuse partially extracted release inputs on retry', async () => {
  const f = await releaseFixture()
  f.control.failSourceExtraction = true
  await expect(prepareReleaseInputs(f.p)).rejects.toThrow('interrupted extraction')
  const failedFolder = fake.command.mock.calls.find(([name, args]) => name === 'tar' && args.at(-1).endsWith('source'))![1].at(-1)
  f.control.failSourceExtraction = false
  const retried = await prepareReleaseInputs(f.p)
  expect(retried.source).not.toBe(failedFolder)
  expect(await readFile(join(retried.source, 'recognizer.ts'), 'utf8')).toBe('trusted recognizer')
})

it('rejects altered ZIP bytes and a moved release tag before extracting release inputs', async () => {
  const f = await releaseFixture()
  await writeFile(join(f.root, '.output', f.release.asset), 'altered zip')
  await expect(prepareReleaseInputs(f.p)).rejects.toThrow('发布包摘要')
  expect(fake.command).not.toHaveBeenCalled()
  await writeFile(join(f.root, '.output', f.release.asset), 'verified zip')
  f.control.commit = 'b'.repeat(40)
  await expect(prepareReleaseInputs(f.p)).rejects.toThrow('发布源码提交')
  expect(fake.command.mock.calls.some(([name]) => name === 'tar')).toBe(false)
})
