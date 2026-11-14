export const STORAGE_KEY = 'onlytranslate-reading-review-drafts-v1'
export const scopeKey = (pageId, snapshotId) => JSON.stringify([pageId, snapshotId])
export function readDrafts(storage) {
  try { const data = JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? data : {} }
  catch { return {} }
}
export function groupDrafts(drafts, pageId, snapshotId) { return drafts[scopeKey(pageId, snapshotId)] || {} }
export function editDraft(drafts, pageId, snapshotId, block, verdict, note) {
  const key = scopeKey(pageId, snapshotId), group = { ...drafts[key] }, existing = group[block.id]
  if (block.decision && block.decision.verdict === verdict && block.decision.note === note) delete group[block.id]
  else group[block.id] = { blockId: block.id, snapshotId, verdict, note, expectedDecisionId: existing ? existing.expectedDecisionId : block.decision?.id || null }
  const next = { ...drafts, [key]: group }
  if (!Object.keys(group).length) delete next[key]
  return next
}
export function clearSubmitted(drafts, pageId, snapshotId, submitted, saved = []) {
  const key = scopeKey(pageId, snapshotId), group = { ...drafts[key] }
  for (const item of submitted) {
    if (JSON.stringify(group[item.blockId]) === JSON.stringify(item)) delete group[item.blockId]
    else if (group[item.blockId]) {
      const result = saved.find(d=>d.blockId === item.blockId)
      if (result) group[item.blockId] = { ...group[item.blockId], expectedDecisionId: result.id }
    }
  }
  const next = { ...drafts, [key]: group }
  if (!Object.keys(group).length) delete next[key]
  return next
}
