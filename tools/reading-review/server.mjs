import { createServer } from 'node:http'
import { readFile, mkdir, readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { paths, readJson, writeJson, validId, compare, summarize, validateDecision, acceptedIssuesPath, validateAcceptedIssues } from './model.mjs'
import { previewHtml, rewriteCss } from './preview.mjs'
import { loadPageReviews, pageReviewState, createPageReview, pageReviewFile } from './page-reviews.mjs'
import { replayPayload } from './replay.mjs'
import { fingerprintSources } from './driver.mjs'
import { fileURLToPath } from 'node:url'
import { extensionRoot } from './adapters/onlytranslate.mjs'

export async function startServer(options = {}) {
  const root=options.root || extensionRoot, p={...paths(root,options.dataRoot),...options.paths}
  for(const dir of [p.data,p.snapshots,p.runs,p.jobs,p.assets,p.decisions])await mkdir(dir,{recursive:true})
  const port=options.port ?? Number(process.env.ONLYTRANSLATE_REVIEW_PORT || 4188)
  const staticRoot=fileURLToPath(new URL('./ui/',import.meta.url))
  const jobs=new Map(), queue=[], pinTasks=new Map()
  let busy=false, closing=false, child=null, base, mutation=Promise.resolve()
  const mutate = work => { const next=mutation.then(work);mutation=next.catch(()=>{});return next }
  for(const file of (await readdir(p.jobs)).filter(f=>f.endsWith('.json'))){
    const job=await readJson(join(p.jobs,file))
    if(job.status==='running'||job.status==='queued'){job.status='interrupted';job.message='服务已重启，请手动重试';await writeJson(join(p.jobs,file),job)}
    jobs.set(job.id,job)
  }
  async function executeQueue(){
    if(busy||closing)return
    const id=queue.shift();if(!id)return
    busy=true
    const job=jobs.get(id);job.status='running';await writeJson(join(p.jobs,id+'.json'),job)
    const log=[]
    child=spawn(process.execPath,[fileURLToPath(new URL('./worker.mjs',import.meta.url)),job.type,job.pageId,id,...(job.snapshotId?[job.snapshotId]:[])],{cwd:root,env:{...process.env,ONLYTRANSLATE_REVIEW_DATA:p.data},windowsHide:true,stdio:['ignore','pipe','pipe']})
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.push(chunk.toString());if(log.length>100)log.shift()})
    let finished=false
    const finish=async(error)=>{
      if(finished)return
      finished=true
      let result=await readJson(join(p.jobs,id+'.json'))
      if(result.status==='running'){result={...result,status:'failed',message:error||'任务未正常结束'};await writeJson(join(p.jobs,id+'.json'),result)}
      jobs.set(id,result);busy=false;child=null;executeQueue().catch(console.error)
    }
    child.once('error',error=>finish(error.message));child.once('exit',code=>finish(code?'任务失败，见运行状态':undefined))
  }
  async function enqueue(type,pageId,snapshotId){
    if(!['capture','baseline','candidate'].includes(type))throw new Error('未知任务类型')
    const manifest=await readJson(p.manifest)
    if(!manifest.pages.some(page=>page.id===pageId))throw new Error('样本不存在')
    if(snapshotId){if(!validId(snapshotId))throw new Error('无效快照');await readJson(join(p.snapshots,pageId,snapshotId,'snapshot.json'))}
    const existing=[...jobs.values()].find(job=>job.type===type&&job.pageId===pageId&&(job.snapshotId||null)===(snapshotId||null)&&['running','queued'].includes(job.status))
    if(existing)return existing
    const job={id:randomUUID(),type,pageId,...(snapshotId?{snapshotId}:{}),status:'queued',message:'等待运行',createdAt:new Date().toISOString()}
    jobs.set(job.id,job);await writeJson(join(p.jobs,job.id+'.json'),job);queue.push(job.id)
    setImmediate(()=>executeQueue().catch(console.error));return job
  }
  async function allRuns(pageId){
    const folder=join(p.runs,pageId),items=await readdir(folder,{withFileTypes:true}).catch(()=>[])
    return (await Promise.all(items.filter(f=>f.isDirectory()&&validId(f.name)).map(async f=>{const run=await readJson(join(folder,f.name,'run.json'),null);const validation=await readJson(join(folder,f.name,'validation.json'),null);return run&&validation?.valid===false?{...run,status:'invalid',validation}:run}))).filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
  }
  async function baselineSelection(pageId,snapshotId,runs){
    if(!snapshotId)return null
    const file=join(p.snapshots,pageId,snapshotId,'comparison.json')
    if(pinTasks.has(file))return pinTasks.get(file)
    const task=(async()=>{
      let selection=await readJson(file,null)
      const latest=runs.findLast(run=>run.kind==='baseline'&&run.status==='complete')
      if(!selection?.baselineRunId&&latest){
        selection={baselineRunId:latest.id,history:[{runId:latest.id,reason:'initial-default',selectedAt:new Date().toISOString()}]}
        await writeJson(file,selection)
      }
      return selection
    })()
    pinTasks.set(file,task)
    try{return await task}finally{pinTasks.delete(file)}
  }
  async function detail(pageId,query=new URLSearchParams()){
    if(!validId(pageId))throw new Error('无效页面编号')
    const page=(await readJson(p.manifest)).pages.find(page=>page.id===pageId)
    if(!page)throw new Error('样本不存在')
    const latest=await readJson(join(p.snapshots,pageId,'latest.json'),null)
    const snapshotId=query.get('snapshot')||latest?.id
    if(snapshotId&&!validId(snapshotId))throw new Error('无效快照')
    const snapshot=snapshotId?await readJson(join(p.snapshots,pageId,snapshotId,'snapshot.json')):null
    const folders=await readdir(join(p.snapshots,pageId),{withFileTypes:true}).catch(()=>[])
    const snapshots=(await Promise.all(folders.filter(f=>f.isDirectory()&&validId(f.name)).map(async f=>{const s=await readJson(join(p.snapshots,pageId,f.name,'snapshot.json'));return{id:s.id,createdAt:s.createdAt,state:s.state}}))).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))
    const runs=(await allRuns(pageId)).filter(r=>r.snapshotId===snapshotId)
    const selection=await baselineSelection(pageId,snapshotId,runs)
    const select=(parameter,kind)=>{
      const id=query.get(parameter)
      if(id){const found=runs.find(run=>run.id===id);if(!found)throw new Error('运行不属于该快照');if(found.kind!==kind)throw new Error('运行类型与对比位置不匹配');if(found.status!=='complete')throw new Error('该运行未通过完整性校验');return found}
      if(kind==='baseline')return runs.find(run=>run.id===selection?.baselineRunId&&run.kind==='baseline'&&run.status==='complete')||null
      return runs.findLast(run=>run.kind===kind&&run.status==='complete')||null
    }
    const before=select('before','baseline'),after=select('after','candidate')
    const decisions=await readJson(join(p.decisions,pageId+'.json'),[])
    const acceptedIssues=validateAcceptedIssues(await readJson(acceptedIssuesPath(p.decisions),{schemaVersion:1,issues:[]}))
    const blocks=snapshot?compare(snapshot,before,after,decisions,acceptedIssues):[]
    const policy=await readJson(resolve(p.decisions,'../check-policy.json'),{annotationPolicyVersion:null})
    const reviewHistory=await loadPageReviews(p.decisions,pageId)
    const pageReview=pageReviewState({snapshot,run:after,history:reviewHistory,decisions,acceptedIssues,specification:policy.annotationPolicyVersion})
    const changed=new Set([...pageReview.addedTextIds,...pageReview.removedTextIds])
    return {page,snapshot,snapshots,runs,before,after,baselineSelection:selection,blocks:blocks.map(b=>({...b,pageReviewChanged:b.textIds.some(id=>changed.has(id))})),summary:summarize(blocks),decisions,pageReview}
  }
  const send=(response,status,value,type='application/json; charset=utf-8')=>{response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(type.startsWith('application/json')?JSON.stringify(value):value)}
  async function body(request){let text='';for await(const part of request){text+=part;if(text.length>2*1024*1024)throw new Error('请求过大')}return JSON.parse(text||'{}')}
  const server=createServer(async(request,response)=>{
    try{
      if(request.headers.host!==new URL(base).host)return send(response,403,{error:'仅允许本地访问'})
      const url=new URL(request.url,base),path=url.pathname
      if(request.method==='POST'){
        if(request.headers['x-reading-review']!=='1'||!request.headers['content-type']?.startsWith('application/json')||(request.headers.origin&&request.headers.origin!==base))return send(response,403,{error:'无效来源'})
        const input=await body(request)
        if(path==='/api/jobs')return send(response,202,await enqueue(input.type,input.pageId,input.snapshotId))
        if(path==='/api/candidate-all'){
          const queued=[],skipped=[]
          for(const page of (await readJson(p.manifest)).pages){const latest=await readJson(join(p.snapshots,page.id,'latest.json'),null);if(latest)queued.push(await enqueue('candidate',page.id,latest.id));else skipped.push({pageId:page.id,reason:'尚未采集'})}
          return send(response,202,{queued,skipped})
        }
        if(path==='/api/pilot'){
          const created=[]
          for(const page of (await readJson(p.manifest)).pages){
            const latest=await readJson(join(p.snapshots,page.id,'latest.json'),null)
            if(!latest){for(const type of ['capture','baseline','candidate'])created.push(await enqueue(type,page.id));continue}
            const runs=(await allRuns(page.id)).filter(r=>r.snapshotId===latest.id&&r.status==='complete')
            if(!runs.some(r=>r.kind==='baseline'))created.push(await enqueue('baseline',page.id,latest.id))
            if(!runs.some(r=>r.kind==='candidate'))created.push(await enqueue('candidate',page.id,latest.id))
          }
          return send(response,202,created)
        }
        if(path==='/api/pages')return await mutate(async()=>{
          const parsed=new URL(input.url)
          if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.href.length>2000)throw new Error('请输入有效的公开网页网址')
          if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw new Error('请输入页面名称')
          const manifest=await readJson(p.manifest),id='page-'+randomUUID().slice(0,12)
          manifest.pages.push({id,name:input.name.trim(),url:parsed.href,type:String(input.type||'文章').slice(0,20),source:String(input.source||'问题反馈').slice(0,200),addedAt:new Date().toISOString()})
          await writeJson(p.manifest,manifest);return send(response,201,{id})
        })
        const pin=/^\/api\/baseline-selection\/([^/]+)$/.exec(path)
        if(pin)return await mutate(async()=>{
          const d=await detail(pin[1],new URLSearchParams({snapshot:input.snapshotId}))
          const run=d.runs.find(run=>run.id===input.runId&&run.kind==='baseline'&&run.status==='complete')
          if(!run)throw new Error('只能固定当前快照中完整有效的发布版基线')
          const previous=d.baselineSelection
          const next={baselineRunId:run.id,history:[...(previous?.history||[]),{runId:run.id,previousRunId:previous?.baselineRunId||null,reason:'user-selection',selectedAt:new Date().toISOString()}]}
          await writeJson(join(p.snapshots,d.page.id,d.snapshot.id,'comparison.json'),next)
          return send(response,200,next)
        })
        const whole=/^\/api\/page-reviews\/([^/]+)$/.exec(path)
        if(whole)return await mutate(async()=>{
          if(!['confirmed','revoked'].includes(input.status)||!validId(input.snapshotId))throw new Error('无效整页确认请求')
          const query=new URLSearchParams({snapshot:input.snapshotId})
          let d=await detail(whole[1],query)
          if(d.snapshot?.pageId!==d.page.id)throw new Error('整页确认的快照页面身份不匹配')
          const conflict=message=>{const error=new Error(message);error.status=409;throw error}
          const verify=()=>{
            if(!Object.hasOwn(input,'expectedReviewId')||input.expectedReviewId!==d.pageReview.latestReviewId)conflict('整页确认已在其他窗口更新，请刷新后复核')
            if(input.status==='confirmed'&&(input.runId!==d.after?.id||input.inputHash!==d.pageReview.inputHash||input.coverageHash!==d.pageReview.coverageHash||input.contextHash!==d.pageReview.contextHash))conflict('页面、目标或逐块裁决已变化，请刷新后确认')
          }
          verify()
          if(input.status==='confirmed'){
            if(!d.pageReview.canConfirm)throw new Error(d.pageReview.reason)
            await replayPayload(p,d.page.id,d.snapshot,'')
            if(await fingerprintSources(root)!==d.after.build.sourceHash)conflict('识别源码已更新，请先运行当前版再确认')
            d=await detail(whole[1],query);verify()
          }
          const history=await loadPageReviews(p.decisions,d.page.id)
          const latest=history.findLast(r=>r.snapshotId===d.snapshot.id)
          if((latest?.id||null)!==input.expectedReviewId)conflict('整页确认记录已变化，请刷新后复核')
          let record
          if(input.status==='revoked'){
            if(!latest||latest.status!=='confirmed')throw new Error('当前快照没有可撤销的整页确认')
            record={...latest,id:randomUUID(),revision:(history.at(-1)?.revision||0)+1,status:'revoked',previousReviewId:latest.id,recordedAt:new Date().toISOString()}
          }else{
            const policy=await readJson(resolve(p.decisions,'../check-policy.json'))
            const acceptedIssues=validateAcceptedIssues(await readJson(acceptedIssuesPath(p.decisions),{schemaVersion:1,issues:[]}))
            record=createPageReview({snapshot:d.snapshot,run:d.after,history,decisions:d.decisions,acceptedIssues,specification:policy.annotationPolicyVersion})
          }
          await writeJson(pageReviewFile(p.decisions,d.page.id),[...history,record])
          return send(response,201,record)
        })
        const match=/^\/api\/decisions\/([^/]+)$/.exec(path)
        if(match)return await mutate(async()=>{
          const batch=Object.hasOwn(input,'decisions'),items=batch?input.decisions:[input]
          if(!Array.isArray(items)||!items.length||items.length>500)throw new Error('每次请保存 1～500 项裁决')
          if(new Set(items.map(item=>item.blockId)).size!==items.length)throw new Error('一批中不能重复保存同一文字块')
          const snapshotId=items[0].snapshotId
          if(items.some(item=>item.snapshotId!==snapshotId))throw new Error('一批裁决必须属于同一快照')
          const d=await detail(match[1],new URLSearchParams({snapshot:snapshotId}))
          const file=join(p.decisions,match[1]+'.json'),history=await readJson(file,[])
          // Validate the whole batch before a single atomic history write.
          const decisions=items.map((item,index)=>{
            const decision=validateDecision(item,d.snapshot)
            const previous=history.findLast(record=>record.snapshotId===snapshotId&&record.blockId===item.blockId)
            if(Object.hasOwn(item,'expectedDecisionId')&&item.expectedDecisionId!==(previous?.id||null)){
              const error=new Error('有裁决已在其他窗口修改。本批尚未保存，草稿保留，请重新核对。');error.status=409;throw error
            }
            return {...decision,id:randomUUID(),revision:history.length+index+1}
          })
          await writeJson(file,[...history,...decisions])
          return send(response,201,batch?{saved:decisions.length,decisions}:decisions[0])
        })
        return send(response,404,{error:'接口不存在'})
      }
      if(request.method!=='GET')return send(response,405,{error:'不支持的方法'})
      if(path==='/favicon.ico'){response.writeHead(204);return response.end()}
      if(path==='/api/state'){
        const manifest=await readJson(p.manifest),pages=[]
        for(const item of manifest.pages){const d=await detail(item.id);pages.push({...item,snapshotId:d.snapshot?.id,resourceWarnings:d.snapshot?.omittedAssets||0,summary:d.summary,pageReview:d.pageReview,before:d.before?{id:d.before.id,status:d.before.status,targets:d.before.targets.length,translation:d.before.translation}:null,after:d.after?{id:d.after.id,targets:d.after.targets.length}:null})}
        const currentJobs=await Promise.all([...jobs.keys()].map(id=>readJson(join(p.jobs,id+'.json'))))
        return send(response,200,{pages,jobs:currentJobs.reverse(),release:await readJson(p.release),dataRoot:p.data,decisionsRoot:p.decisions})
      }
      const match=/^\/api\/pages\/([^/]+)$/.exec(path)
      if(match)return send(response,200,await detail(match[1],url.searchParams))
      const preview=/^\/preview\/([^/]+)$/.exec(path)
      if(preview){
        const d=await detail(preview[1],url.searchParams)
        if(!d.snapshot)throw new Error('请先采集页面')
        let html=await readFile(join(p.snapshots,d.page.id,d.snapshot.id,'source.html'),'utf8')
        if(url.searchParams.get('translated')==='1'&&d.before)html=await readFile(join(p.runs,d.page.id,d.before.id,'translated.html'),'utf8')
        response.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-reading-review'; style-src 'unsafe-inline' ${base}; img-src ${base} data:; font-src ${base} data:; connect-src 'none'; form-action 'none'; base-uri 'none'`)
        return send(response,200,previewHtml(html,d.snapshot,base,d.blocks),'text/html; charset=utf-8')
      }
      const image=/^\/image\/([^/]+)\/(original|translated)$/.exec(path)
      if(image){const d=await detail(image[1],url.searchParams);const file=image[2]==='original'?join(p.snapshots,d.page.id,d.snapshot.id,'original.png'):join(p.runs,d.page.id,d.before.id,'translated.png');return send(response,200,await readFile(file),'image/png')}
      const asset=/^\/assets\/([a-f0-9]{64})$/.exec(path)
      if(asset){
        const page=url.searchParams.get('page'),snapshotId=url.searchParams.get('snapshot')
        if(!validId(page)||!validId(snapshotId))throw new Error('资源必须关联具体快照')
        const snapshot=await readJson(join(p.snapshots,page,snapshotId,'snapshot.json'))
        const descriptor=snapshot.assets.find(a=>a.hash===asset[1])
        if(!descriptor)return send(response,404,'missing','text/plain')
        response.setHeader('Access-Control-Allow-Origin','*')
        response.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'none'; sandbox")
        const data=await readFile(join(p.assets,asset[1]))
        return send(response,200,descriptor.type.includes('css')?rewriteCss(data.toString(),descriptor.url,snapshot.assets,base,url.search):data,descriptor.type)
      }
      const files={'/':'index.html','/app.js':'app.js','/drafts.mjs':'drafts.mjs','/style.css':'style.css'}
      if(files[path])return send(response,200,await readFile(join(staticRoot,files[path])),/\.m?js$/.test(path)?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8')
      return send(response,404,{error:'页面不存在'})
    }catch(error){console.error(error.message);return send(response,error.status===409?409:400,{error:error.message})}
  })
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept)})
  base='http://127.0.0.1:'+server.address().port
  console.log(`识文评审台 ${base}\n本地数据 ${p.data}`)
  return {server,base,paths:p,close:async()=>{closing=true;child?.kill();await new Promise(resolve=>server.close(resolve))}}
}
if(process.argv[1]===import.meta.filename){
  const app=await startServer()
  for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{await app.close();process.exit(0)})
}
