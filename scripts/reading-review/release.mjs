import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { readJson, hash, validId } from './model.mjs'
import { command } from './driver.mjs'

export async function prepareReleaseInputs(p) {
  const release = await readJson(p.release), zip = join(p.root, '.output', release.asset)
  if (!validId(release.tag) || !/^[a-f0-9]{40}$/.test(release.commit)) throw new Error('无效发布身份')
  const bytes = await readFile(zip).catch(() => { throw new Error('缺少发布包：' + zip) })
  if (hash(bytes) !== release.sha256) throw new Error('发布包摘要与锁定版本不一致')
  const commit = (await command('git', ['rev-parse', release.tag + '^{commit}'], { cwd: p.root })).trim()
  if (commit !== release.commit) throw new Error('发布源码提交与锁定版本不一致')
  // Never reuse mutable, same-version extracted directories as evidence of release identity.
  const base = join(p.root, 'output/reading-review-build')
  await mkdir(base, { recursive: true })
  const folder = await mkdtemp(join(base, release.tag + '-verified-'))
  const extension = join(folder, 'extension'), source = join(folder, 'source')
  await mkdir(extension); await mkdir(source)
  const verifiedZip = join(folder, 'release.zip')
  await writeFile(verifiedZip, bytes)
  await command('tar', ['-xf', verifiedZip, '-C', extension])
  const manifest = await readJson(join(extension, 'manifest.json'))
  if ('v' + manifest.version !== release.tag) throw new Error('发布包版本不匹配')
  const archive = join(folder, 'source.zip')
  await command('git', ['archive', '--format=zip', '--output=' + archive, commit], { cwd: p.root })
  const sourceArchiveHash = hash(await readFile(archive))
  await command('tar', ['-xf', archive, '-C', source])
  const sourcePackage = await readJson(join(source, 'package.json'))
  if ('v' + sourcePackage.version !== release.tag) throw new Error('发布源码版本不匹配')
  const build = { kind: 'release', tag: release.tag, commit, assetHash: release.sha256, sourceArchiveHash, settings: release.settings }
  return { release, folder, extension, source, build }
}
