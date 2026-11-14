import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { paths, readJson, writeJson, hash, validId } from './model.mjs'
import { browserConfig, openBrowser, runBrowser, closeBrowser, command, buildCollector, fingerprintSources } from './driver.mjs'
import { installCatalogue } from './catalogue.mjs'
import { replayPayload as loadReplayPayload, replayCode } from './replay.mjs'
import { saveCapturedSnapshot, saveBaselineRun } from './archive.mjs'
import { prepareReleaseInputs } from './release.mjs'
import { translationCoverage } from './completion.mjs'
import { extensionRoot } from './adapters/onlytranslate.mjs'

const root = extensionRoot
const p = paths(root)
const completionRuleHash = hash(await readFile(new URL('./completion.mjs', import.meta.url)))
const [action, pageId, jobId, requestedSnapshot] = process.argv.slice(2)
if (!['capture', 'baseline', 'candidate'].includes(action) || !validId(pageId) || !validId(jobId)) throw new Error('无效任务')
if(requestedSnapshot&&!validId(requestedSnapshot))throw new Error('无效快照编号')
const jobPath = join(p.jobs, jobId + '.json')
const progress = async message => { console.log(message); const job = await readJson(jobPath); await writeJson(jobPath, { ...job, message, updatedAt: new Date().toISOString() }) }
const pageInfo = (await readJson(p.manifest)).pages.find(page=>page.id === pageId)
if (!pageInfo) throw new Error('样本不存在')

async function capturePage() {
  const browser = await browserConfig(p, null, 'capture')
  await openBrowser(browser)
  try {
    await progress('正在加载页面、滚动并归档资源')
    const screenshot = join(p.data, 'capture-' + jobId + '.png')
    const captured = await runBrowser(browser, `async page => {
      const tab = await page.context().newPage(), assets = new Map(), tasks = [];
      let bytes = 0, omitted = 0;
      tab.on('response', response => {
        if (!['stylesheet','image','font'].includes(response.request().resourceType()) || !response.ok()) return;
        tasks.push((async()=>{try { const body=await response.body(); if(body.length>6000000 || bytes+body.length>35000000){omitted++;return;} bytes+=body.length; assets.set(response.url(),{url:response.url(),type:response.headers()['content-type']||'application/octet-stream',body:body.toString('base64')}); }catch{omitted++;}})());
      });
      try {
        const response=await tab.goto(${JSON.stringify(pageInfo.url)},{waitUntil:'domcontentloaded',timeout:45000});
        if(!response?.ok()) throw new Error('HTTP '+response?.status());
        await tab.locator(${JSON.stringify(pageInfo.ready || 'body')}).first().waitFor({state:'visible',timeout:20000});
        const title=await tab.title(); if(/^(?:just a moment|access denied|attention required|verify|request for access)/i.test(title)) throw new Error('采集到访问验证页');
        await tab.waitForTimeout(1200);
        let bottom=false;
        for(let i=0;i<160;i++){bottom=await tab.evaluate(()=>{if(scrollY+innerHeight>=document.documentElement.scrollHeight-3)return true;scrollBy(0,innerHeight*.8);return false;}); if(bottom)break;await tab.waitForTimeout(120);}
        if(!bottom)throw new Error('未到达页面底部，快照不完整');
        ${pageInfo.focus ? `await tab.locator(${JSON.stringify(pageInfo.focus)}).scrollIntoViewIfNeeded({timeout:15000});await tab.waitForTimeout(1200);` : 'await tab.evaluate(()=>scrollTo(0,0));'}
        let previous='',stable=0;
        for(let i=0;i<30;i++){const state=await tab.evaluate(()=>JSON.stringify([document.body.innerText.length,document.documentElement.scrollHeight]));stable=state===previous?stable+1:0;previous=state;if(stable>=4)break;await tab.waitForTimeout(400);}
        if(stable<4)throw new Error('页面尚未稳定');
        const catalogue=await tab.evaluate(${installCatalogue.toString()});
        const html=await tab.content(), scrollY=await tab.evaluate(()=>window.scrollY);
        await tab.screenshot({path:${JSON.stringify(screenshot)},fullPage:true,animations:'disabled',timeout:30000});
        await Promise.all(tasks);
        return {html,catalogue,title,url:tab.url(),scrollY,viewport:tab.viewportSize(),assets:[...assets.values()],omitted,focused:${Boolean(pageInfo.focus)}};
      }finally{await tab.close();}
    }`)
    const snapshot = await saveCapturedSnapshot(p, pageInfo, captured, screenshot)
    await progress(`快照已保存：${snapshot.catalogue.blocks.length} 个文字块，${snapshot.assets.length} 项资源`)
    return { snapshotId: snapshot.id, pageId }
  } finally { await closeBrowser(browser) }
}

const replayPayload=(snapshot,bundle)=>loadReplayPayload(p,pageId,snapshot,bundle)

async function prepareRelease() {
  const inputs = await prepareReleaseInputs(p)
  const bundle = await buildCollector(p, inputs.source, inputs.build, join(inputs.folder, 'collector.js'))
  return { ...inputs, bundle }
}

async function baseline(snapshot) {
  await progress('核验发布包并准备发布版识别采集器')
  const {release,extension,build,bundle}=await prepareRelease()
  const browser=await browserConfig(p,extension)
  await openBrowser(browser)
  const runId='release-'+Date.now()+'-'+randomUUID().slice(0,6), runFolder=join(p.runs,pageId,runId)
  await mkdir(runFolder,{recursive:true})
  try {
    const payload=await replayPayload(snapshot,bundle)
    await progress('发布版正在真实翻译，等待全部目标处理完成')
    const initial=await runBrowser(browser,`async page=>{
      const ctx=page.context();const worker=ctx.serviceWorkers().find(w=>w.url().startsWith('chrome-extension:'))||await ctx.waitForEvent('serviceworker',{timeout:15000});
      const settings=${JSON.stringify(release.settings)};
      const actualVersion=await worker.evaluate(async settings=>{const data=await chrome.storage.local.get('config');const previous=typeof data.config==='string'?JSON.parse(data.config):{};await chrome.storage.local.set({config:JSON.stringify({...previous,...settings})});return chrome.runtime.getManifest().version;},settings);
      if('v'+actualVersion!==${JSON.stringify(release.tag)})throw new Error('运行中的扩展版本不一致');
      ${replayCode(payload)}
      const result=await page.evaluate(()=>window.collectReadingReview());
      await page.getByTestId('floating-ball-trigger').waitFor({state:'visible',timeout:20000});
      await page.getByTestId('floating-ball-trigger').click();
      await page.waitForTimeout(1500);
      return {...result,actualVersion};
    }`)
    let observation, covered, stable=0
    const started=Date.now()
    while(Date.now()-started<240000){
      observation=await runBrowser(browser,`async page=>{
        await page.waitForTimeout(1000);
        return await page.evaluate(()=>{
          const state=window.__readingReview;
          const items=state.nodes.map((node,index)=>({id:'target-'+index,attempted:node.hasAttribute('data-fr-translated'),translation:[...node.querySelectorAll('.only-translate-bilingual-text')].map(n=>n.textContent).join('\\n')}));
          const hosts=[...document.querySelectorAll('[data-fr-translated="true"]')];
          const unexpectedTargets=hosts.filter(node=>!state.nodes.includes(node)).map((node,index)=>({...state.recordTarget(node,state.nodes.length+index),translation:[...node.querySelectorAll('.only-translate-bilingual-text')].map(n=>n.textContent).join('\\n')}));
          return {items,unexpectedTargets,unexpectedHosts:unexpectedTargets.length,actualHosts:hosts.length,pending:document.querySelectorAll('.only-translate-loading').length,failures:document.querySelectorAll('.only-translate-failure,.only-translate-retry-wrapper').length,inserted:document.querySelectorAll('.only-translate-bilingual-text').length,attempted:items.filter(i=>i.attempted).length};
        });
      }`)
      covered=translationCoverage(initial.targets,observation)
      const done=covered.coverageComplete&&observation.pending===0
      stable=done?stable+1:0
      await progress(`实翻 ${observation.attempted}/${initial.targets.length}，原文覆盖 ${covered.coveredTargets}/${initial.targets.length}，译文 ${observation.inserted}，处理中 ${observation.pending}，失败 ${observation.failures}`)
      if(stable>=3)break
    }
    const complete=stable>=3&&observation.failures===0
    const sourceTexts=new Map(snapshot.catalogue.texts.map(text=>[text.id,text.text]))
    const observedTargets=observation.unexpectedTargets.filter(target=>target.textIds.length).map(target=>({...target,text:target.textIds.map(id=>sourceTexts.get(id)||'').join(' '),observedText:target.text}))
    const result={schemaVersion:1,id:runId,pageId,snapshotId:snapshot.id,createdAt:new Date().toISOString(),kind:'baseline',build:initial.build,bundleHash:hash(bundle),status:complete?'complete':'incomplete',actualVersion:initial.actualVersion,
      targets:[...initial.targets.map((target,i)=>({...target,...observation.items[i],translationStatus:observation.items[i].translation?'inserted':'processed-without-insert'})),...observedTargets],elapsedMs:initial.elapsedMs,stats:initial.stats,
      translation:{service:release.settings.service,targetLanguage:release.settings.to,elapsedMs:Date.now()-started,expected:initial.targets.length,actualHosts:observation.actualHosts,unexpectedHosts:observation.unexpectedHosts,attempted:observation.attempted,...covered,completionRule:'source-coverage-v1',completionRuleHash,inserted:observation.inserted,pending:observation.pending,failures:observation.failures,complete}}
    await saveBaselineRun(runFolder,result,async()=>{
      const html=await runBrowser(browser,'async page=>({html:await page.content()})')
      await writeFile(join(runFolder,'translated.html'),html.html)
      await progress('保存实翻页面及全页截图，目标和译文记录已落盘')
      try { await runBrowser(browser,`async page=>{await page.screenshot({path:${JSON.stringify(join(runFolder,'translated.png'))},fullPage:true,animations:'disabled',timeout:60000});return true;}`) }
      catch(error) { throw new Error('全页实翻截图失败，目标及译文已保留：'+error.message) }
    })
    if(!complete)throw new Error('实翻未完整完成，已保留运行结果，不能作为合格基线')
    return {runId,pageId,snapshotId:snapshot.id}
  }finally{await closeBrowser(browser)}
}

async function candidate(snapshot) {
  await progress('构建当前源码的识别采集器，不修改识别算法')
  const commit=(await command('git',['rev-parse','HEAD'],{cwd:root})).trim(), diff=await command('git',['diff','HEAD','--','entrypoints'],{cwd:root})
  const sourceHash=await fingerprintSources(root)
  const build={kind:'candidate',commit,sourceDiffHash:hash(diff),sourceHash}
  const file=join(root,'output/reading-review-build/candidate/collector.js'),bundle=await buildCollector(p,root,build,file)
  const browser=await browserConfig(p);await openBrowser(browser)
  try{
    const payload=await replayPayload(snapshot,bundle)
    const result=await runBrowser(browser,`async page=>{${replayCode(payload)}return await page.evaluate(()=>window.collectReadingReview());}`)
    const id='candidate-'+Date.now()+'-'+randomUUID().slice(0,6)
    await writeJson(join(p.runs,pageId,id,'run.json'),{schemaVersion:1,id,pageId,snapshotId:snapshot.id,kind:'candidate',createdAt:new Date().toISOString(),status:'complete',bundleHash:hash(bundle),...result})
    return {runId:id,pageId,snapshotId:snapshot.id}
  }finally{await closeBrowser(browser)}
}

try {
  await mkdir(p.jobs,{recursive:true})
  let result
  if(action==='capture') result=await capturePage()
  else {
    const latest=requestedSnapshot?{id:requestedSnapshot}:await readJson(join(p.snapshots,pageId,'latest.json'))
    const snapshot=await readJson(join(p.snapshots,pageId,latest.id,'snapshot.json'))
    result=action==='baseline'?await baseline(snapshot):await candidate(snapshot)
  }
  await writeJson(jobPath,{...await readJson(jobPath),status:'complete',message:'完成',result,finishedAt:new Date().toISOString()})
}catch(error){
  console.error(error.stack)
  await writeJson(jobPath,{...await readJson(jobPath),status:'failed',message:error.message,finishedAt:new Date().toISOString()})
  process.exitCode=1
}
