// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { startServer } from '../server.mjs'
import { checkCorpus } from '../check.mjs'
import { fingerprintSources } from '../driver.mjs'
import { hash, writeJson } from '../model.mjs'
import { createPageReview, pageReviewState, validatePageReviews } from '../page-reviews.mjs'

const cleanup: (()=>Promise<unknown>)[]=[]
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close()})

async function fixture(){
  const folder=await mkdtemp(join(tmpdir(),'whole-reading-review-')),data=join(folder,'data'),corpus=join(folder,'corpus'),root=resolve(import.meta.dirname, '../../..')
  const html='<html><body><p>First complete sentence. <em>Second complete sentence.</em></p><a>Subscribe</a></body></html>'
  const snapshot={schemaVersion:1,id:'snapshot-1',pageId:'sample',url:'https://example.org/article',htmlHash:hash(html),assets:[],viewport:{width:1440,height:950},scrollY:0,
    catalogue:{texts:[{id:'t1',text:'First complete sentence.'},{id:'t2',text:'Second complete sentence.'},{id:'t3',text:'Subscribe'}],blocks:[{id:'e1',text:'First complete sentence. Second complete sentence.',textIds:['t1','t2'],visible:true},{id:'e2',text:'Subscribe',textIds:['t3'],visible:true}]}}
  const build={sourceHash:await fingerprintSources(root),commit:'test-commit'},bundleHash=hash('test-bundle')
  const run={id:'candidate-1',pageId:'sample',snapshotId:snapshot.id,kind:'candidate',status:'complete',createdAt:'2026-01-01',build,bundleHash,targets:[{textIds:['t1','t2']}],stats:{scannedElements:3}}
  await writeJson(join(corpus,'pages.json'),{schemaVersion:1,pages:[{id:'sample',name:'Isolated sample',url:snapshot.url}]})
  await writeJson(join(corpus,'release.json'),{tag:'test'})
  await writeJson(join(corpus,'check-policy.json'),{schemaVersion:1,annotationPolicyVersion:1,minimumConfirmed:1})
  const snapshotPath=join(data,'snapshots/sample',snapshot.id,'snapshot.json')
  await writeJson(snapshotPath,snapshot);await writeFile(join(data,'snapshots/sample',snapshot.id,'source.html'),html)
  await writeJson(join(data,'snapshots/sample/latest.json'),{id:snapshot.id})
  await writeJson(join(data,'runs/sample',run.id,'run.json'),run)
  const historyPath=join(corpus,'page-reviews/sample.json')
  const options={root,dataRoot:data,port:0,paths:{manifest:join(corpus,'pages.json'),release:join(corpus,'release.json'),decisions:join(corpus,'decisions')}}
  let app:Awaited<ReturnType<typeof startServer>>|undefined
  cleanup.push(async()=>{if(app)await app.close();await rm(folder,{recursive:true,force:true})})
  const open=async()=>app||=(await startServer(options))
  const get=async()=>{const a=await open();return(await fetch(a.base+'/api/pages/sample')).json()}
  const post=async(d:any,status='confirmed')=>{const a=await open();return fetch(a.base+'/api/page-reviews/sample',{method:'POST',headers:{'Content-Type':'application/json','X-Reading-Review':'1'},body:JSON.stringify({status,snapshotId:d.snapshot.id,runId:d.after?.id,expectedReviewId:d.pageReview.latestReviewId,inputHash:d.pageReview.inputHash,coverageHash:d.pageReview.coverageHash,contextHash:d.pageReview.contextHash})})}
  const approve=()=>createPageReview({snapshot,run,specification:1})
  const runner={build:{...build,sourceHash:hash('a-new-algorithm')},bundleHash:hash('fresh-bundle'),replay:vi.fn(async()=>({build:{...build,sourceHash:hash('a-new-algorithm')},targets:[{textIds:['t1']},{textIds:['t2']}],stats:{scannedElements:3}})),unchanged:async()=>true,close:async()=>{}}
  const checkOptions={...options,policyPath:join(corpus,'check-policy.json'),log:()=>{},createRunner:async()=>runner}
  return {folder,data,corpus,snapshot,html,snapshotPath,run,historyPath,build,bundleHash,approve,open,get,post,runner,checkOptions,
    restart:async()=>{if(app)await app.close();app=await startServer(options);return app},
    saveRun:async(targets:{textIds:string[]}[],extra={})=>writeJson(join(data,'runs/sample/candidate-2/run.json'),{...run,...extra,id:'candidate-2',createdAt:'2026-01-02',targets})}
}

it('keeps approval across new builds and parent/child segmentation without inventing block labels',async()=>{
  const f=await fixture(),review=f.approve()
  const state=pageReviewState({snapshot:f.snapshot,run:{...f.run,id:'candidate-2',build:{sourceHash:hash('new-code')},targets:[{textIds:['t2']},{textIds:['t1']},{textIds:['t1']}]},history:[review],specification:1})
  expect(state.state).toBe('confirmed')
  expect(state.addedTextIds).toEqual([])
  await writeJson(f.historyPath,[review])
  const report=await checkCorpus(f.checkOptions)
  expect(report).toMatchObject({ok:true,confirmed:0,confirmedPages:1,pageReviewsSatisfied:1,pageReviewViolations:0})
  await expect(readFile(join(f.corpus,'decisions/sample.json'))).rejects.toMatchObject({code:'ENOENT'})
})

it.each([{groups:[['t1']]},{groups:[['t1','t2','t3']]}])('blocks a changed approved target set: %j',async({groups})=>{
  const f=await fixture();await writeJson(f.historyPath,[f.approve()])
  f.runner.replay.mockResolvedValue({...await f.runner.replay(),targets:groups.map(textIds=>({textIds}))})
  const report=await checkCorpus(f.checkOptions)
  expect(report).toMatchObject({ok:false,confirmedPages:1,pageReviewViolations:1})
  expect(report.pages[0].pageReview.changes.length).toBeGreaterThan(0)
})

it('persists confirmation, rejects stale clicks, and exposes only changed blocks after a later run',async()=>{
  const f=await fixture(),first=await f.get()
  expect(first.pageReview).toMatchObject({state:'unreviewed',canConfirm:true})
  expect((await f.post(first)).status).toBe(201)
  expect((await f.get()).pageReview.state).toBe('confirmed')
  expect((await f.post(first)).status).toBe(409)
  expect(JSON.parse(await readFile(f.historyPath,'utf8'))).toHaveLength(1)
  await f.restart()
  expect((await f.get()).pageReview.state).toBe('confirmed')
  const current=await f.get()
  await f.saveRun([{textIds:['t1','t2','t3']}])
  expect((await f.post(current)).status).toBe(409)
  const changed=await f.get()
  expect(changed.pageReview).toMatchObject({state:'needs-review',addedTextIds:['t3'],removedTextIds:[]})
  expect(changed.blocks.filter((b:any)=>b.pageReviewChanged).map((b:any)=>b.id)).toEqual(['e2'])
  expect((await f.post(changed)).status).toBe(201)
  expect((await f.get()).pageReview.state).toBe('confirmed')
  expect(JSON.parse(await readFile(f.historyPath,'utf8'))).toHaveLength(2)
})

it('serializes competing confirmation writes and supports explicit revocation without editing block decisions',async()=>{
  const f=await fixture(),d=await f.get()
  const responses=await Promise.all([f.post(d),f.post(d)])
  expect(responses.map(r=>r.status).sort()).toEqual([201,409])
  const confirmed=await f.get()
  expect((await f.post(confirmed,'revoked')).status).toBe(201)
  expect((await f.get()).pageReview.state).toBe('unreviewed')
  const history=JSON.parse(await readFile(f.historyPath,'utf8'))
  expect(history.map((r:any)=>r.status)).toEqual(['confirmed','revoked'])
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
})

it('rejects invalid, incomplete, stale-source and unmapped runs instead of approving cached guesses',async()=>{
  const f=await fixture()
  await f.saveRun([{textIds:[]}])
  expect((await f.get()).pageReview.canConfirm).toBe(false)
  await f.saveRun([{textIds:['unknown']}])
  expect((await f.get()).pageReview.canConfirm).toBe(false)
  await f.saveRun([{textIds:['t1']}],{build:{sourceHash:hash('stale-code')}})
  expect((await f.post(await f.get())).status).toBe(409)
  await f.saveRun([{textIds:['t1']}],{status:'incomplete'})
  expect((await f.get()).after.id).toBe('candidate-1')
  await writeJson(join(f.data,'runs/sample/candidate-1/validation.json'),{valid:false})
  expect((await f.get()).pageReview.canConfirm).toBe(false)
})

it('does not approve corrupted snapshots and does not relabel an active approval after metadata changes',async()=>{
  const f=await fixture(),d=await f.get()
  await writeFile(join(f.data,'snapshots/sample',f.snapshot.id,'source.html'),'changed')
  expect((await f.post(d)).status).toBe(400)
  await writeFile(join(f.data,'snapshots/sample',f.snapshot.id,'source.html'),f.html)
  await f.post(await f.get())
  await writeJson(f.snapshotPath,{...f.snapshot,viewport:{width:1000,height:700}})
  const altered=await f.get()
  expect(altered.pageReview).toMatchObject({state:'needs-review',canConfirm:false})
  expect((await f.post(altered)).status).toBe(400)
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
})

it('requires review of a new snapshot but still checks the previously confirmed historical snapshot',async()=>{
  const f=await fixture();await writeJson(f.historyPath,[f.approve()])
  const other={...f.snapshot,id:'snapshot-2'}
  await writeJson(join(f.data,'snapshots/sample/snapshot-2/snapshot.json'),other)
  await writeFile(join(f.data,'snapshots/sample/snapshot-2/source.html'),f.html)
  await writeJson(join(f.data,'snapshots/sample/latest.json'),{id:other.id})
  await f.saveRun([{textIds:['t1','t2']}],{snapshotId:other.id})
  expect((await f.get()).pageReview).toMatchObject({state:'needs-review',label:'新快照待确认'})
  const report=await checkCorpus(f.checkOptions)
  expect(report.ok).toBe(true)
  expect(report.pages[0].snapshotId).toBe(f.snapshot.id)
  await rm(f.snapshotPath)
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
})

it('keeps accepted unmet verdicts and blocks stale review context rather than using page approval as a waiver',async()=>{
  const f=await fixture()
  const decision={id:'decision-1',snapshotId:f.snapshot.id,blockId:'e2',textHash:hash('Subscribe'),verdict:'translate',confirmed:true,reviewer:'user',specification:1,note:'test'}
  await writeJson(join(f.corpus,'decisions/sample.json'),[decision])
  expect((await f.get()).pageReview.canConfirm).toBe(false)
  const issue={id:'issue-1',pageId:'sample',snapshotId:f.snapshot.id,blockId:'e2',decisionId:decision.id,specification:1,expectedVerdict:'translate',htmlHash:f.snapshot.htmlHash,textHash:decision.textHash,acceptedSelectedTextIds:[],status:'accepted',revision:1,reviewer:'user',confirmedAt:'2026-11-14',reason:'isolated test acceptance'}
  await writeJson(join(f.corpus,'accepted-issues.json'),{schemaVersion:1,issues:[issue]})
  expect((await f.post(await f.get())).status).toBe(201)
  expect(await checkCorpus(f.checkOptions)).toMatchObject({ok:true,confirmed:1,confirmedPages:1,violations:1,acceptedIssues:1})
  expect(JSON.parse(await readFile(join(f.corpus,'decisions/sample.json'),'utf8'))).toEqual([decision])
  await writeJson(join(f.corpus,'accepted-issues.json'),{schemaVersion:1,issues:[issue,{...issue,status:'revoked',revision:2}]})
  expect((await f.get()).pageReview.state).toBe('needs-review')
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
})

it('supports an explicitly reviewed empty target set without allowing empty or unknown source indexes',async()=>{
  const f=await fixture();await f.saveRun([])
  expect((await f.post(await f.get())).status).toBe(201)
  f.runner.replay.mockResolvedValue({...await f.runner.replay(),targets:[]})
  expect(await checkCorpus(f.checkOptions)).toMatchObject({ok:true,confirmedPages:1})
  f.runner.replay.mockResolvedValue({...await f.runner.replay(),targets:[{textIds:['t1']}]})
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
})

it('rejects corrupt approval history and fails closed when review files change during a build',async()=>{
  const f=await fixture(),review=f.approve()
  expect(()=>validatePageReviews([{...review,selectedTextIds:['unknown']}],'sample')).toThrow('整页确认')
  await writeJson(f.historyPath,[review])
  const original=f.runner.replay.getMockImplementation()!
  f.runner.replay.mockImplementation(async()=>{await writeJson(f.historyPath,[review,{...review,id:'second-review',revision:2}]);return original()})
  expect((await checkCorpus(f.checkOptions)).errors.join(' ')).toContain('发生变化')
})

it('rejects cross-origin confirmation and makes block-policy changes require a fresh page review',async()=>{
  const f=await fixture(),d=await f.get(),app=await f.open()
  const denied=await fetch(app.base+'/api/page-reviews/sample',{method:'POST',headers:{'Content-Type':'application/json','X-Reading-Review':'1',Origin:'https://foreign.example'},body:JSON.stringify({status:'confirmed',snapshotId:f.snapshot.id})})
  expect(denied.status).toBe(403)
  expect((await f.post(d)).status).toBe(201)
  await writeJson(join(f.corpus,'decisions/sample.json'),[{id:'decision-new',snapshotId:f.snapshot.id,blockId:'e1',textHash:hash(f.snapshot.catalogue.blocks[0].text),verdict:'translate',confirmed:true,reviewer:'user',specification:1,note:'new user decision'}])
  expect((await f.get()).pageReview.state).toBe('needs-review')
  expect((await checkCorpus(f.checkOptions)).ok).toBe(false)
  expect((await f.post(await f.get())).status).toBe(201)
  expect((await checkCorpus(f.checkOptions)).ok).toBe(true)
})
