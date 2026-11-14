import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'

export const hash = value => createHash('sha256').update(value).digest('hex')
export const normalize = text => text.replace(/\s+/g, ' ').trim()
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/.test(value) && !value.includes('..')
export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error }
}
export async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true })
  const temporary = path + '.' + randomUUID() + '.tmp'
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n')
  await rename(temporary, path)
}
export async function jsonFiles(dir) {
  try { return (await readdir(dir)).filter(file => file.endsWith('.json')) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
export const acceptedIssuesPath = decisionsDir => resolve(decisionsDir, '../accepted-issues.json')
export function validateAcceptedIssues(document) {
  if (document?.schemaVersion !== 1 || !Array.isArray(document.issues)) throw new Error('无效的已接受问题记录')
  const latest = new Map(), digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
  for (const issue of document.issues) {
    const previous = latest.get(issue.id)
    if (![issue.id, issue.pageId, issue.snapshotId, issue.blockId, issue.decisionId].every(validId)
        || !['accepted', 'revoked'].includes(issue.status) || issue.reviewer !== 'user'
        || !Number.isInteger(issue.revision) || issue.revision < 1 || (previous && issue.revision <= previous.revision)
        || !Number.isInteger(issue.specification) || issue.specification < 1
        || !['translate', 'exclude'].includes(issue.expectedVerdict)
        || !digest(issue.textHash) || !digest(issue.htmlHash)
        || typeof issue.reason !== 'string' || !issue.reason.trim() || issue.reason.length > 2000
        || typeof issue.confirmedAt !== 'string' || !Number.isFinite(Date.parse(issue.confirmedAt))
        || !Array.isArray(issue.acceptedSelectedTextIds) || !issue.acceptedSelectedTextIds.every(validId)
        || new Set(issue.acceptedSelectedTextIds).size !== issue.acceptedSelectedTextIds.length) {
      throw new Error('已接受问题缺少有效的用户确认、原因或精确绑定')
    }
    latest.set(issue.id, issue)
  }
  return [...latest.values()]
}
export function coverage(run) { return new Set((run?.targets ?? []).flatMap(target => target.textIds)) }
export function compare(snapshot, before, after, decisions = [], acceptedIssues = []) {
  for (const run of [before, after]) if (run && run.snapshotId !== snapshot.id) throw new Error('运行与快照不匹配')
  const a = coverage(before || after), b = coverage(after || before)
  const latest = new Map(decisions.filter(d => d.snapshotId === snapshot.id).map(d => [d.blockId, d]))
  return snapshot.catalogue.blocks.map(block => {
    const oldIds = block.textIds.filter(id => a.has(id)), newIds = block.textIds.filter(id => b.has(id))
    const removed = oldIds.filter(id => !b.has(id)), added = newIds.filter(id => !a.has(id))
    const label = latest.get(block.id)
    const state = added.length && removed.length ? 'changed' : added.length ? 'added' : removed.length ? 'removed' : newIds.length ? 'same' : 'unselected'
    const selected = new Set(newIds).size
    const violation = label?.confirmed && label.verdict === 'translate' ? selected < block.textIds.length : label?.confirmed && label.verdict === 'exclude' ? selected > 0 : false
    const acceptedIssue = violation ? acceptedIssues.find(issue => issue.status === 'accepted'
      && issue.pageId === snapshot.pageId && issue.snapshotId === snapshot.id && issue.htmlHash === snapshot.htmlHash
      && issue.blockId === block.id && issue.decisionId === label.id && issue.specification === label.specification
      && issue.expectedVerdict === label.verdict && issue.textHash === label.textHash && issue.textHash === hash(block.text)
      && issue.acceptedSelectedTextIds.length === newIds.length
      && issue.acceptedSelectedTextIds.every(id => newIds.includes(id))) ?? null : null
    return { ...block, state, oldSelected: oldIds.length, newSelected: newIds.length, added, removed, decision: label ?? null, violation,
      acceptedIssue, blockingViolation: Boolean(violation && !acceptedIssue),
      suspected: block.visible && state === 'unselected' && block.text.length >= 80 && /[.!?。！？]/.test(block.text) }
  })
}
export function summarize(blocks) {
  return { added: blocks.filter(b=>b.added.length).length, removed: blocks.filter(b=>b.removed.length).length,
    suspected: blocks.filter(b=>b.suspected).length, confirmed: blocks.filter(b=>b.decision?.confirmed).length,
    violations: blocks.filter(b=>b.violation).length, acceptedIssues: blocks.filter(b=>b.acceptedIssue).length,
    blockingViolations: blocks.filter(b=>b.violation && !b.acceptedIssue).length, totalBlocks: blocks.length }
}
export function validateDecision(input, snapshot) {
  const block = snapshot.catalogue.blocks.find(block=>block.id === input.blockId)
  if (!block || input.snapshotId !== snapshot.id) throw new Error('标注不属于当前快照')
  if (!['translate', 'exclude', 'either', 'pending'].includes(input.verdict)) throw new Error('无效裁决')
  if (typeof input.note !== 'string' || input.note.length > 2000) throw new Error('备注最多 2000 字')
  return { blockId: block.id, snapshotId: snapshot.id, textHash: hash(block.text), verdict: input.verdict,
    note: input.note, confirmed: input.verdict !== 'pending', specification: 1, reviewer: 'user', updatedAt: new Date().toISOString() }
}
export function paths(root, dataRoot = process.env.ONLYTRANSLATE_REVIEW_DATA || resolve(root, '../OnlyTranslate-review-data')) {
  return { root, data: resolve(dataRoot), manifest: join(root, 'tests/corpus/pages.json'), release: join(root, 'tests/corpus/release.json'),
    decisions: join(root, 'tests/corpus/decisions'), snapshots: join(dataRoot, 'snapshots'), runs: join(dataRoot, 'runs'), jobs: join(dataRoot, 'jobs'), assets: join(dataRoot, 'assets') }
}
