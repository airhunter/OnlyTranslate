import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { hash, validId, readJson, coverage, compare, summarize } from './model.mjs'

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const pageReviewsDir = decisionsDir => resolve(decisionsDir, '../page-reviews')
export const pageReviewFile = (decisionsDir, pageId) => join(pageReviewsDir(decisionsDir), pageId + '.json')
const selectedHash = ids => hash(JSON.stringify([...ids].sort()))
export const snapshotInputHash = snapshot => hash(JSON.stringify(snapshot))

export function reviewContextHash(pageId, snapshotId, decisions, acceptedIssues) {
  const latest = new Map(decisions.filter(d => d.snapshotId === snapshotId).map(d => [d.blockId, d]))
  const labels = [...latest.values()].sort((a,b) => a.blockId.localeCompare(b.blockId))
  const issues = acceptedIssues.filter(i => i.pageId === pageId && i.snapshotId === snapshotId).sort((a,b) => a.id.localeCompare(b.id))
  return hash(JSON.stringify([labels, issues]))
}

export function validatePageReviews(history, pageId) {
  if (!Array.isArray(history)) throw new Error('无效整页确认记录：' + pageId)
  let revision = 0
  const ids = new Set()
  for (const r of history) {
    if (r.schemaVersion !== 1 || r.scope !== 'smart' || r.pageId !== pageId || ![r.id,r.pageId,r.snapshotId,r.runId].every(validId)
      || ids.has(r.id) || !Number.isInteger(r.revision) || r.revision <= revision
      || !['confirmed','revoked'].includes(r.status) || r.reviewer !== 'user'
      || !Number.isInteger(r.specification) || r.specification < 1
      || ![r.htmlHash,r.inputHash,r.contextHash,r.coverageHash,r.sourceHash,r.bundleHash].every(digest)
      || !Array.isArray(r.selectedTextIds) || !r.selectedTextIds.every(validId)
      || new Set(r.selectedTextIds).size !== r.selectedTextIds.length || selectedHash(r.selectedTextIds) !== r.coverageHash
      || typeof r.recordedAt !== 'string' || !Number.isFinite(Date.parse(r.recordedAt))) {
      throw new Error('整页确认缺少有效身份、原文覆盖或用户记录：' + pageId)
    }
    revision = r.revision; ids.add(r.id)
  }
  return history
}

export const latestPageReviews = history => [...new Map(history.map(r => [r.snapshotId,r])).values()]

function inputs(snapshot, run, decisions, acceptedIssues, specification) {
  if (!snapshot || !run || run.status !== 'complete') throw new Error('请先运行当前版，获得有效的目标结果')
  if (run.snapshotId !== snapshot.id || run.pageId !== snapshot.pageId || !validId(run.id) || !digest(run.build?.sourceHash) || !digest(run.bundleHash)) throw new Error('当前结果缺少有效运行身份')
  if (!digest(snapshot.htmlHash) || !Array.isArray(snapshot.catalogue?.texts) || !snapshot.catalogue.texts.length) throw new Error('快照缺少可核对的原文索引')
  if (!validId(snapshot.id)||!validId(snapshot.pageId)||snapshot.catalogue.texts.some(t=>!validId(t.id)||typeof t.text!=='string')) throw new Error('快照原文身份无效')
  if (!Number.isInteger(specification) || specification < 1) throw new Error('缺少有效标注规范版本')
  const known = new Set(snapshot.catalogue.texts.map(t => t.id))
  if (known.size !== snapshot.catalogue.texts.length || !Array.isArray(run.targets)
    || run.targets.some(t => !Array.isArray(t.textIds) || !t.textIds.length || t.textIds.some(id => !known.has(id)))) {
    throw new Error('有目标无法定位到原文，不能确认整页')
  }
  const selectedTextIds = [...coverage(run)].sort()
  const labels=[...new Map(decisions.filter(d=>d.snapshotId===snapshot.id).map(d=>[d.blockId,d])).values()]
  for(const d of labels.filter(d=>d.confirmed)){
    const block=snapshot.catalogue.blocks.find(b=>b.id===d.blockId)
    if(d.specification!==specification||d.reviewer!=='user'||!block||hash(block.text)!==d.textHash)throw new Error('逐块裁决的规范或原文定位需要先复核')
  }
  const summary = summarize(compare(snapshot,null,run,decisions,acceptedIssues))
  return { selectedTextIds, sourceIds:known,inputHash:snapshotInputHash(snapshot), coverageHash:selectedHash(selectedTextIds),
    contextHash:reviewContextHash(snapshot.pageId,snapshot.id,decisions,acceptedIssues), summary }
}

export function pageReviewState({snapshot,run,history=[],decisions=[],acceptedIssues=[],specification}) {
  const latest = history.findLast(r => r.snapshotId === snapshot?.id)
  const active = latest?.status === 'confirmed' ? latest : null
  const result = {state:'unreviewed',label:'未整页确认',reason:'查看本页后，确认当前选中的整页目标即可，无需逐段标注',
    canConfirm:false,canRevoke:Boolean(active),latestReviewId:latest?.id||null,review:active?{id:active.id,recordedAt:active.recordedAt,runId:active.runId,selectedCount:active.selectedTextIds.length}:null,
    addedTextIds:[],removedTextIds:[]}
  if (!active && latestPageReviews(history).some(r => r.status==='confirmed')) {
    result.state='needs-review';result.label='新快照待确认';result.reason='之前的整页确认属于其他快照，不会自动沿用'
  }
  if (latest?.status==='revoked') result.reason='已撤销本快照的整页确认，历史及逐块要求仍保留'
  let current
  try { current=inputs(snapshot,run,decisions,acceptedIssues,specification) }
  catch(error){return {...result,state:active?'needs-review':'unavailable',label:active?'待运行复核':'暂不能确认',reason:error.message}}
  Object.assign(result,{inputHash:current.inputHash,coverageHash:current.coverageHash,contextHash:current.contextHash,canConfirm:!current.summary.blockingViolations})
  if (current.summary.blockingViolations) result.reason='仍有未满足且未获接受的逐块要求，整页确认不能替代或豁免它们'
  if (active) {
    result.state='needs-review';result.label='需复核'
    if (active.inputHash!==current.inputHash || active.htmlHash!==snapshot.htmlHash) {
      result.reason='原快照内容或元数据改变，请恢复原记录或另采新快照';result.canConfirm=false
    } else if(active.selectedTextIds.some(id=>!current.sourceIds.has(id))){
      result.reason='整页确认中的原文定位失效，请先恢复有效记录';result.canConfirm=false
    } else if (active.specification!==specification) result.reason='标注规范版本变化，请按新口径复核'
    else {
      const a=new Set(active.selectedTextIds),b=new Set(current.selectedTextIds)
      result.addedTextIds=current.selectedTextIds.filter(id=>!a.has(id));result.removedTextIds=active.selectedTextIds.filter(id=>!b.has(id))
      if (active.contextHash!==current.contextHash) result.reason='逐块裁决或已接受限制已更新，请重新确认整页'
      else if (result.addedTextIds.length||result.removedTextIds.length) result.reason=`相对整页确认新增 ${result.addedTextIds.length} 个原文片段、减少 ${result.removedTextIds.length} 个，请复核变化`
      else if (!current.summary.blockingViolations) {result.state='confirmed';result.label='已人工确认';result.reason='与已确认的整页目标一致，无需重复标注'}
    }
  }
  return result
}

export function createPageReview({snapshot,run,history=[],decisions=[],acceptedIssues=[],specification}) {
  const current=inputs(snapshot,run,decisions,acceptedIssues,specification)
  const state=pageReviewState({snapshot,run,history,decisions,acceptedIssues,specification})
  if (!state.canConfirm) throw new Error(state.reason)
  return {schemaVersion:1,scope:'smart',id:randomUUID(),revision:(history.at(-1)?.revision||0)+1,pageId:snapshot.pageId,snapshotId:snapshot.id,
    htmlHash:snapshot.htmlHash,inputHash:current.inputHash,contextHash:current.contextHash,coverageHash:current.coverageHash,
    selectedTextIds:current.selectedTextIds,specification,runId:run.id,sourceHash:run.build.sourceHash,bundleHash:run.bundleHash,
    status:'confirmed',reviewer:'user',recordedAt:new Date().toISOString()}
}

export async function loadPageReviews(decisionsDir,pageId) {
  return validatePageReviews(await readJson(pageReviewFile(decisionsDir,pageId),[]),pageId)
}
