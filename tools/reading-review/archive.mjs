import { readFile, writeFile, mkdir, rename, link, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { hash, writeJson, validId } from './model.mjs'

export async function saveBaselineRun(folder, result, captureArtifacts) {
  const file = join(folder, 'run.json')
  // A screenshot failure must not discard already observed targets and translations.
  await writeJson(file, { ...result, status: 'incomplete', artifacts: { status: 'pending' } })
  try { await captureArtifacts() }
  catch (error) {
    await writeJson(file, { ...result, status: 'incomplete', artifacts: { status: 'failed', error: error.message } })
    throw error
  }
  await writeJson(file, { ...result, artifacts: { status: 'complete' } })
}

export async function saveCapturedSnapshot(p, pageInfo, captured, screenshot) {
  if (!validId(pageInfo.id)) throw new Error('无效页面 ID')
  // Every capture is a new rendering state, even if HTML happens to be identical.
  const id = randomUUID(), pageFolder = join(p.snapshots, pageInfo.id)
  const folder = join(pageFolder, id), staging = join(pageFolder, '.pending-' + id)
  await mkdir(pageFolder, { recursive: true }); await mkdir(p.assets, { recursive: true })
  await mkdir(staging)
  const image = await readFile(screenshot)
  const assets = []
  for (const asset of captured.assets) {
    const bytes = Buffer.from(asset.body, 'base64'), key = hash(bytes)
    const path = join(p.assets, key)
    const temporary = join(p.assets, '.pending-' + randomUUID())
    await writeFile(temporary, bytes, { flag: 'wx' })
    try { await link(temporary, path) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (hash(await readFile(path)) !== key) throw new Error('归档资源摘要不匹配，保留原文件')
    }
    finally { await unlink(temporary) }
    assets.push({ url: asset.url, type: asset.type, hash: key })
  }
  const snapshot = { schemaVersion: 1, id, pageId: pageInfo.id, createdAt: new Date().toISOString(), requestedUrl: pageInfo.url, url: captured.url, title: captured.title,
    viewport: captured.viewport, scrollY: captured.scrollY, state: captured.focused ? 'focused' : 'settled', focus: pageInfo.focus || null,
    assets, omittedAssets: captured.omitted, htmlHash: hash(captured.html), catalogue: captured.catalogue }
  await writeFile(join(staging, 'source.html'), captured.html)
  await writeFile(join(staging, 'original.png'), image)
  await writeJson(join(staging, 'snapshot.json'), snapshot)
  // The server ignores .pending-* directories. Incomplete captures remain diagnostic artifacts.
  await rename(staging, folder)
  await writeJson(join(pageFolder, 'latest.json'), { id })
  return snapshot
}
