import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hash } from './model.mjs'
import { installCatalogue } from './catalogue.mjs'

export async function replayPayload(p, pageId, snapshot, bundle) {
  const html = await readFile(join(p.snapshots, pageId, snapshot.id, 'source.html'), 'utf8')
  if (hash(html) !== snapshot.htmlHash) throw new Error('快照内容摘要不匹配，停止回放')
  const assets = await Promise.all(snapshot.assets.map(async asset=>{
    const bytes = await readFile(join(p.assets,asset.hash))
    if (hash(bytes) !== asset.hash) throw new Error('归档资源摘要不匹配')
    return { ...asset, body: bytes.toString('base64') }
  }))
  return { ...snapshot, html, assets, bundle }
}

export function replayCode(payload, verifyCatalogue = false) {
  return `const sample=${JSON.stringify(payload)};
    await page.unrouteAll({behavior:'wait'});
    const assets=new Map(sample.assets.map(a=>[a.url,a]));
    const url=new URL(sample.url);url.hash='';
    await page.route('**/*',async route=>{const req=route.request(),asset=assets.get(req.url());if(req.isNavigationRequest()&&req.frame()===page.mainFrame()&&req.url()===url.href)await route.fulfill({contentType:'text/html; charset=utf-8',headers:{'x-onlytranslate-review-snapshot':sample.id,'content-security-policy':"script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'"},body:sample.html});else if(asset)await route.fulfill({contentType:asset.type,body:Buffer.from(asset.body,'base64')});else await route.abort();});
    await page.setViewportSize(sample.viewport);const replayResponse=await page.goto(sample.url,{waitUntil:'load',timeout:30000});
    if(replayResponse?.headers()['x-onlytranslate-review-snapshot']!==sample.id)throw new Error('回放身份校验失败，可能被站点缓存接管');
    await page.evaluate(y=>scrollTo(0,y),sample.scrollY);
    const catalogue=await page.evaluate(${installCatalogue.toString()});
    ${verifyCatalogue ? "const anchors=c=>[c.texts,c.blocks.map(b=>[b.id,b.text,b.textIds])];if(JSON.stringify(anchors(catalogue))!==JSON.stringify(anchors(sample.catalogue)))throw new Error('回放原文定位与快照不一致');" : ''}
    await page.evaluate(sample.bundle);`
}
