import { Window } from 'happy-dom'

export function previewHtml(source, snapshot, base, states = []) {
  const context = `?page=${encodeURIComponent(snapshot.pageId)}&snapshot=${encodeURIComponent(snapshot.id)}`
  const assets = new Map(snapshot.assets.map(asset => [asset.url, `${base}/assets/${asset.hash}${context}`]))
  const resource = raw => {
    if (!raw || raw.startsWith('data:')) return raw
    try { return assets.get(new URL(raw, snapshot.url).href) || 'data:,' } catch { return 'data:,' }
  }
  const clean = source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<link\b[^>]*>/gi, tag => /rel\s*=\s*["']?(?:preload|prefetch|modulepreload)/i.test(tag) ? '' : tag)
  const window = new Window({ url: snapshot.url, settings: { disableCSSFileLoading: true, disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } })
  try {
    window.document.write(clean)
    const document = window.document
    document.querySelectorAll('script, base, iframe, object, embed, meta[http-equiv]').forEach(node => node.remove())
    document.querySelectorAll('*').forEach(element => {
      for (const attr of [...element.attributes]) if (/^on/i.test(attr.name) || ['integrity', 'srcset', 'formaction', 'autofocus'].includes(attr.name)) element.removeAttribute(attr.name)
      for (const attr of ['src', 'poster']) if (element.hasAttribute(attr)) element.setAttribute(attr, resource(element.getAttribute(attr)))
      if (element.matches('link')) element.setAttribute('href', resource(element.getAttribute('href')))
      if (element.hasAttribute('style')) element.setAttribute('style', rewriteCss(element.getAttribute('style'), snapshot.url, snapshot.assets, base, context))
    })
    document.querySelectorAll('style').forEach(style=>{style.textContent = rewriteCss(style.textContent,snapshot.url,snapshot.assets,base,context)})
    const style = document.createElement('style')
    style.textContent = `[data-review-state="same"]{outline:1px solid #16a16a66;outline-offset:2px}[data-review-state="added"]{outline:2px solid #2563eb;background-color:#dbeafe33}[data-review-state="removed"]{outline:2px solid #d97706;background-color:#fef3c733}[data-review-violation="true"]{outline:3px solid #dc2626!important}[data-review-suspected="true"]{outline:1px dashed #64748b}[data-review-focus="true"]{outline:4px solid #7c3aed!important;outline-offset:4px}html{scroll-behavior:auto!important}`
    document.head.append(style)
    const script = document.createElement('script')
    script.setAttribute('nonce', 'reading-review')
    // Only this app-owned script executes. Original scripts, handlers and navigation are disabled.
    script.textContent = `const blocks=${JSON.stringify(states).replaceAll('<','\\u003c')};const ids=new Set(blocks.map(b=>b.id));
      for(const block of blocks){const el=document.querySelector('[data-ot-review-node="'+block.id+'"]');if(el){el.dataset.reviewState=block.state;el.dataset.reviewViolation=String(block.violation);el.dataset.reviewSuspected=String(block.suspected);}}
      addEventListener('click',event=>{event.preventDefault();event.stopPropagation();let el=event.target;while(el&&!ids.has(el.getAttribute?.('data-ot-review-node')))el=el.parentElement;if(el)parent.postMessage({kind:'reading-review-select',id:el.getAttribute('data-ot-review-node')},'*');},true);
      addEventListener('submit',e=>e.preventDefault(),true);
      addEventListener('message',event=>{if(event.source!==parent||event.data?.kind!=='reading-review-focus')return;document.querySelectorAll('[data-review-focus]').forEach(el=>el.removeAttribute('data-review-focus'));const el=document.querySelector('[data-ot-review-node="'+CSS.escape(event.data.id)+'"]');if(el){el.dataset.reviewFocus='true';el.scrollIntoView({block:'center'});}});`
    document.body.append(script)
    return '<!doctype html>\n' + document.documentElement.outerHTML
  } finally { window.happyDOM.abort() }
}

export function rewriteCss(css, sourceUrl, assets, base, context = '') {
  const map = new Map(assets.map(a=>[a.url,`${base}/assets/${a.hash}${context}`]))
  const url = raw => { if(raw.startsWith('data:') || raw.startsWith('#'))return raw;try{return map.get(new URL(raw,sourceUrl).href)||'data:,'}catch{return 'data:,'} }
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(_,q,value)=>`url("${url(value)}")`).replace(/@import\s+(['"])(.*?)\1/g,(_,q,value)=>`@import "${url(value)}"`)
}
