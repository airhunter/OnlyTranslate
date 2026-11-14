// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compare, summarize, validateDecision, writeJson, hash } from '../model.mjs'
import { previewHtml } from '../preview.mjs'
import { startServer } from '../server.mjs'
import { readDrafts, groupDrafts, editDraft, clearSubmitted } from '../ui/drafts.mjs'

const snapshot = { id: 'snapshot-1', pageId: 'sample', url: 'https://example.org/story', assets: [], catalogue: { blocks: [
  { id: 'e1', text: 'An article title.', textIds: ['t1'], visible: true },
  { id: 'e2', text: 'This paragraph should be translated because it explains the main idea of the article in a complete sentence.', textIds: ['t2', 't3'], visible: true },
  { id: 'e3', text: 'Subscribe now', textIds: ['t4'], visible: true },
] } }
const run = (groups: string[][]) => ({ snapshotId: snapshot.id, targets: groups.map(textIds=>({ textIds })) })
const cleanups: (()=>Promise<unknown>)[] = []
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup()})

describe('reading review coverage and decisions',()=>{
  it('serves its UI from the tool project when corpus inputs live in another directory',async()=>{
    const folder=await mkdtemp(join(tmpdir(),'reading-tool-boundary-'))
    cleanups.push(()=>rm(folder,{recursive:true,force:true}))
    const corpus=join(folder,'corpus')
    await writeJson(join(corpus,'pages.json'),{schemaVersion:1,pages:[]})
    await writeJson(join(corpus,'release.json'),{tag:'test'})
    const app=await startServer({root:folder,port:0,dataRoot:join(folder,'data'),paths:{manifest:join(corpus,'pages.json'),release:join(corpus,'release.json'),decisions:join(corpus,'decisions')}})
    cleanups.push(()=>app.close())
    const html=await fetch(app.base+'/'),js=await fetch(app.base+'/app.js'),css=await fetch(app.base+'/style.css')
    expect([html.status,js.status,css.status]).toEqual([200,200,200])
    expect(await html.text()).toContain('识文评审台')
    expect(await js.text()).toContain('/api/')
    expect(await css.text()).toContain('.topbar')
  })
  it('treats parent/child segmentation as the same source coverage',()=>{
    const result=compare(snapshot,run([['t1','t2','t3']]),run([['t1'],['t2','t3']]))
    expect(summarize(result)).toMatchObject({added:0,removed:0})
  })
  it('detects partial paragraph loss and preserves independently repeated text positions',()=>{
    const result=compare(snapshot,run([['t1','t2','t3']]),run([['t1','t2']]))
    expect(result[1].removed).toEqual(['t3'])
  })
  it('exposes common omissions and enforces only confirmed annotations',()=>{
    const decision=validateDecision({blockId:'e2',snapshotId:snapshot.id,verdict:'translate',note:'正文'},snapshot)
    const result=compare(snapshot,run([['t1']]),run([['t1']]),[decision])
    expect(result[1]).toMatchObject({suspected:true,violation:true})
    expect(summarize(result)).toMatchObject({confirmed:1,violations:1})
  })
  it('lets a newer pending decision supersede a previously confirmed one',()=>{
    const first=validateDecision({blockId:'e2',snapshotId:snapshot.id,verdict:'translate',note:''},snapshot)
    const pending=validateDecision({blockId:'e2',snapshotId:snapshot.id,verdict:'pending',note:'待讨论'},snapshot)
    const result=compare(snapshot,run([]),run([]),[first,pending])
    expect(summarize(result)).toMatchObject({confirmed:0,violations:0})
    expect(result[1].decision?.note).toBe('待讨论')
  })
  it('never reports a version regression when the candidate has not run',()=>{
    expect(summarize(compare(snapshot,run([['t1','t2']]),null))).toMatchObject({added:0,removed:0})
  })
  it('rejects stale snapshots and invalid user decisions',()=>{
    expect(()=>compare(snapshot,{...run([]),snapshotId:'other'},run([]))).toThrow()
    expect(()=>validateDecision({blockId:'e9',snapshotId:snapshot.id,verdict:'translate',note:''},snapshot)).toThrow()
  })
  it('removes original scripts, event handlers and external navigation from previews',()=>{
    const html=previewHtml('<html><head><script>alert(1)</script></head><body><p data-ot-review-node="e1" onclick="alert(2)">Hello</p><iframe src="https://bad.example"></iframe><img src="https://bad.example/a.png"></body></html>',snapshot,'http://127.0.0.1:4188')
    expect(html).not.toContain('alert(1)')
    expect(html).not.toContain('onclick=')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('src="https://')
    expect(html).toContain('nonce="reading-review"')
  })
})

describe('reading review local API',()=>{
  it('shows an accepted known issue separately while preserving the original verdict',async()=>{
    const folder=await mkdtemp(join(tmpdir(),'reading-review-accepted-')),data=join(folder,'data'),corpus=join(folder,'corpus')
    cleanups.push(()=>rm(folder,{recursive:true,force:true}))
    const sample={...snapshot,htmlHash:hash('snapshot-source')}
    const decision={...validateDecision({blockId:'e2',snapshotId:sample.id,verdict:'translate',note:'测试中的原裁决'},sample),id:'original-decision'}
    await writeJson(join(corpus,'pages.json'),{pages:[{id:'sample',name:'Sample',url:sample.url}]})
    await writeJson(join(corpus,'release.json'),{tag:'test'})
    await writeJson(join(corpus,'decisions/sample.json'),[decision])
    await writeJson(join(corpus,'accepted-issues.json'),{schemaVersion:1,issues:[{
      id:'known-1',revision:1,status:'accepted',pageId:'sample',snapshotId:sample.id,htmlHash:sample.htmlHash,
      blockId:'e2',textHash:decision.textHash,decisionId:decision.id,specification:1,expectedVerdict:'translate',
      acceptedSelectedTextIds:[],reviewer:'user',confirmedAt:'2026-11-14',reason:'隔离测试：允许当前已知限制'
    }]})
    await writeJson(join(data,'snapshots/sample/latest.json'),{id:sample.id})
    await writeJson(join(data,'snapshots/sample',sample.id,'snapshot.json'),sample)
    await writeJson(join(data,'runs/sample/current/run.json'),{id:'current',kind:'candidate',snapshotId:sample.id,status:'complete',createdAt:'2026-11-14',targets:[]})
    const app=await startServer({root:resolve(import.meta.dirname, '../../..'),port:0,dataRoot:data,paths:{manifest:join(corpus,'pages.json'),release:join(corpus,'release.json'),decisions:join(corpus,'decisions')}})
    cleanups.push(()=>app.close())
    const result=await(await fetch(app.base+'/api/pages/sample')).json()
    expect(result.summary).toMatchObject({confirmed:1,violations:1,acceptedIssues:1,blockingViolations:0})
    expect(result.blocks.find((block:{id:string})=>block.id==='e2')).toMatchObject({violation:true,blockingViolation:false,acceptedIssue:{id:'known-1'},decision:{verdict:'translate'}})
    expect(JSON.parse(await readFile(join(corpus,'decisions/sample.json'),'utf8'))).toEqual([decision])
  })
  it('keeps a fixed baseline, follows the latest valid candidate, and separates historical viewing from changing defaults',async()=>{
    const folder=await mkdtemp(join(tmpdir(),'reading-review-history-')),data=join(folder,'data'),corpus=join(folder,'corpus')
    cleanups.push(()=>rm(folder,{recursive:true,force:true}))
    await writeJson(join(corpus,'pages.json'),{pages:[{id:'sample',name:'Sample',url:snapshot.url}]})
    await writeJson(join(corpus,'release.json'),{tag:'test'})
    await writeJson(join(data,'snapshots/sample/latest.json'),{id:snapshot.id})
    await writeJson(join(data,'snapshots/sample',snapshot.id,'snapshot.json'),snapshot)
    const saveRun=async(id:string,kind:string,date:string)=>writeJson(join(data,'runs/sample',id,'run.json'),{id,kind,snapshotId:snapshot.id,status:'complete',createdAt:date,targets:[]})
    await saveRun('base-old','baseline','2026-01-01')
    await saveRun('base-current','baseline','2026-01-02')
    await saveRun('test-old','candidate','2026-01-01')
    const options={root:resolve(import.meta.dirname, '../../..'),port:0,dataRoot:data,paths:{manifest:join(corpus,'pages.json'),release:join(corpus,'release.json'),decisions:join(corpus,'decisions')}}
    let app=await startServer(options)
    const get=async(query='')=>(await(await fetch(app.base+'/api/pages/sample'+query)).json())
    expect((await get()).before.id).toBe('base-current')
    await saveRun('base-new','baseline','2026-01-03')
    await saveRun('test-new','candidate','2026-01-03')
    await saveRun('test-invalid','candidate','2026-01-04')
    await writeJson(join(data,'runs/sample/test-invalid/validation.json'),{valid:false})
    const normal=await get()
    expect(normal.before.id).toBe('base-current')
    expect(normal.after.id).toBe('test-new')
    expect(normal.runs).toHaveLength(6)
    const historical=await get('?before=base-old&after=test-old')
    expect(historical.before.id).toBe('base-old')
    expect((await get()).before.id).toBe('base-current')
    const response=await fetch(app.base+'/api/baseline-selection/sample',{method:'POST',headers:{'Content-Type':'application/json','X-Reading-Review':'1'},body:JSON.stringify({snapshotId:snapshot.id,runId:'base-old'})})
    expect(response.status).toBe(200)
    expect((await get()).before.id).toBe('base-old')
    const selection=JSON.parse(await readFile(join(data,'snapshots/sample',snapshot.id,'comparison.json'),'utf8'))
    expect(selection.history).toHaveLength(2)
    await app.close()
    app=await startServer(options);cleanups.push(()=>app.close())
    expect((await get()).before.id).toBe('base-old')
    expect((await get()).after.id).toBe('test-new')
  })
  it('persists a user decision with history, reloads it, and rejects cross-origin writes',async()=>{
    const folder=await mkdtemp(join(tmpdir(),'reading-review-test-')),data=join(folder,'data'),corpus=join(folder,'corpus')
    cleanups.push(()=>rm(folder,{recursive:true,force:true}))
    const page={id:'sample',name:'Sample',url:snapshot.url,type:'文章'}
    await mkdir(corpus,{recursive:true})
    await writeJson(join(corpus,'pages.json'),{pages:[page]})
    await writeJson(join(corpus,'release.json'),{tag:'test'})
    await writeJson(join(data,'snapshots/sample/latest.json'),{id:snapshot.id})
    await writeJson(join(data,'snapshots/sample',snapshot.id,'snapshot.json'),snapshot)
    const app=await startServer({root:resolve(import.meta.dirname, '../../..'),port:0,dataRoot:data,paths:{manifest:join(corpus,'pages.json'),release:join(corpus,'release.json'),decisions:join(corpus,'decisions')}})
    cleanups.push(()=>app.close())
    const headers={'Content-Type':'application/json','X-Reading-Review':'1'}
    const input={blockId:'e2',snapshotId:snapshot.id,verdict:'translate',note:'由测试模拟，未写入正式标注'}
    const response=await fetch(app.base+'/api/decisions/sample',{method:'POST',headers,body:JSON.stringify(input)})
    expect(response.status).toBe(201)
    const loaded=await(await fetch(app.base+'/api/pages/sample')).json()
    expect(loaded.summary.confirmed).toBe(1)
    expect(JSON.parse(await readFile(join(corpus,'decisions/sample.json'),'utf8'))).toHaveLength(1)
    const denied=await fetch(app.base+'/api/decisions/sample',{method:'POST',headers:{...headers,Origin:'https://foreign.example'},body:JSON.stringify(input)})
    expect(denied.status).toBe(403)
    const stale=await fetch(app.base+'/api/decisions/sample',{method:'POST',headers,body:JSON.stringify({...input,blockId:'not-in-snapshot'})})
    expect(stale.status).toBe(400)
    const batchPath=app.base+'/api/decisions/sample'
    const batch=[{...input,blockId:'e1',expectedDecisionId:null},{...input,blockId:'e3',verdict:'exclude',expectedDecisionId:null}]
    const partial=await fetch(batchPath,{method:'POST',headers,body:JSON.stringify({decisions:[batch[0],{...batch[1],blockId:'missing'}]})})
    expect(partial.status).toBe(400)
    expect(JSON.parse(await readFile(join(corpus,'decisions/sample.json'),'utf8'))).toHaveLength(1)
    const savedBatch=await fetch(batchPath,{method:'POST',headers,body:JSON.stringify({decisions:batch})})
    expect(savedBatch.status).toBe(201)
    expect((await savedBatch.json()).saved).toBe(2)
    const conflict=await fetch(batchPath,{method:'POST',headers,body:JSON.stringify({decisions:[{...input},batch[0]]})})
    expect(conflict.status).toBe(409)
    expect(JSON.parse(await readFile(join(corpus,'decisions/sample.json'),'utf8'))).toHaveLength(3)
    await writeJson(join(data,'runs/sample/invalid-run/run.json'),{id:'invalid-run',snapshotId:snapshot.id,kind:'candidate',createdAt:'2026-01-01',status:'complete',targets:[]})
    await writeJson(join(data,'runs/sample/invalid-run/validation.json'),{valid:false,reason:'测试回放身份不匹配'})
    const invalid=await fetch(app.base+'/api/pages/sample?after=invalid-run')
    expect(invalid.status).toBe(400)
    expect((await(await fetch(app.base+'/api/pages/sample')).json()).after).toBeNull()
    expect(hash('source')).toHaveLength(64)
  })
})

describe('reading review decision drafts',()=>{
  it('retains multiple choices and notes when switching blocks and restoring browser storage',()=>{
    let drafts=editDraft({},'sample','snapshot-1',{id:'e1'},'translate','第一项备注')
    drafts=editDraft(drafts,'sample','snapshot-1',{id:'e2'},'exclude','第二项备注')
    drafts=editDraft(drafts,'sample','snapshot-1',{id:'e1'},'either','修改第一项')
    const restored=readDrafts({getItem:()=>JSON.stringify(drafts)})
    const group=groupDrafts(restored,'sample','snapshot-1')
    expect(Object.keys(group)).toHaveLength(2)
    expect(group.e1).toMatchObject({verdict:'either',note:'修改第一项'})
    expect(group.e2.note).toBe('第二项备注')
  })
  it('isolates snapshots and only clears the exact choices submitted',()=>{
    let drafts=editDraft({},'sample','snapshot-1',{id:'e1'},'translate','提交前')
    const submitted=Object.values(groupDrafts(drafts,'sample','snapshot-1'))
    drafts=editDraft(drafts,'sample','snapshot-2',{id:'e1'},'exclude','另一个快照')
    drafts=editDraft(drafts,'sample','snapshot-1',{id:'e1'},'translate','提交时又修改了')
    drafts=clearSubmitted(drafts,'sample','snapshot-1',submitted,[{blockId:'e1',id:'saved-id'}])
    expect(groupDrafts(drafts,'sample','snapshot-1').e1).toMatchObject({note:'提交时又修改了',expectedDecisionId:'saved-id'})
    expect(groupDrafts(drafts,'sample','snapshot-2').e1.note).toBe('另一个快照')
  })
  it('removes a draft when reverted to the saved decision and preserves its expected revision',()=>{
    const block={id:'e1',decision:{id:'original-id',verdict:'translate',note:'原备注'}}
    let drafts=editDraft({},'sample','snapshot-1',block,'exclude','改动')
    expect(groupDrafts(drafts,'sample','snapshot-1').e1.expectedDecisionId).toBe('original-id')
    drafts=editDraft(drafts,'sample','snapshot-1',block,'translate','原备注')
    expect(groupDrafts(drafts,'sample','snapshot-1')).toEqual({})
  })
})
