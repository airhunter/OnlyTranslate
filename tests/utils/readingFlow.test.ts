import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/entrypoints/utils/config', () => ({ config: { translationScope: 'smart', display: 1 } }))
vi.mock('@/entrypoints/utils/translateApi', () => ({ cancelAllTranslations: vi.fn(), translateText: vi.fn() }))
vi.mock('@/entrypoints/utils/icon', () => ({ insertFailedTip: vi.fn(), insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() })) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }))
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDynamicTranslationNodes } from '@/entrypoints/main/translationTarget/dynamic'
import { getReadingPurposeDecision } from '@/entrypoints/main/translationTarget/readingEvidence'
import { createScanContext, invalidateScanCache } from '@/entrypoints/main/translationTarget/scanContext'
import { getReadingBlockTargets } from '@/entrypoints/main/translationTarget/readingBlocks'
import { invalidateContentFilterCache, hasPromotionalCallToAction } from '@/entrypoints/utils/contentFilter'

const prose='Before changing the settings, save a local copy of the working configuration so another administrator can reproduce the result later.'
const wrap=(text:string,depth:number)=>'<div>'.repeat(depth)+text+'</div>'.repeat(depth)
beforeEach(()=>{
  document.body.innerHTML='';document.title=''
  Object.defineProperty(window,'location',{value:new URL('https://independent-review.invalid/workshop'),configurable:true})
  invalidateContentFilterCache(document.body);invalidateContentFilterCache(document.documentElement)
})

describe('structural reading relationships without template-specific selectors',()=>{
  it('drops stale descendant visibility in constant time when a mutation exceeds the invalidation walk limit',()=>{
    document.body.innerHTML=`<section><p>${prose}</p>${'<span></span>'.repeat(2100)}<div><a href="/support">Donate</a></div></section>`
    const region=document.querySelector('section')!,context=createScanContext()
    expect(hasPromotionalCallToAction(region)).toBe(true)
    region.hidden=true;invalidateScanCache(context,region)
    expect(hasPromotionalCallToAction(region)).toBe(false)
    region.hidden=false;invalidateScanCache(context,region)
    expect(hasPromotionalCallToAction(region)).toBe(true)
  })
  it.each(['hidden','aria-hidden="true"','style="display:none"'])('ignores a donation control hidden by %s',attribute=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><h3>Community notes</h3><p id="copy">${prose}</p><div ${attribute}><a href="/support">Donate</a></div></section>`
    expect(getReadingPurposeDecision(document.getElementById('copy')!,createScanContext()).policy).toBe('keep')
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(document.getElementById('copy'))
  })
  it('uses a control complete visible label without hidden old copy',()=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><h3>Community support</h3><p id="copy">${prose}</p><a href="/support"><span>Do</span><em>nate</em><span hidden>Deprecated information</span></a></section>`
    expect(getReadingPurposeDecision(document.getElementById('copy')!,createScanContext()).policy).toBe('skip-self')
  })
  it('refreshes visible control evidence when an ancestor becomes hidden',()=>{
    document.body.innerHTML=`<section><p>${prose}</p><div id="controls"><a href="/support">Donate</a></div></section>`
    const region=document.querySelector('section')!,controls=document.getElementById('controls')!,context=createScanContext()
    expect(hasPromotionalCallToAction(region)).toBe(true)
    controls.hidden=true;invalidateScanCache(context,controls)
    expect(hasPromotionalCallToAction(region)).toBe(false)
  })
  it.each(['<div class="card"><section><p>'+prose+'</p></section></div>',
    '<div class="card"><aside><p>'+prose+'</p></aside></div>',
    '<blockquote><section><p>'+prose+'</p></section></blockquote>',
    '<div class="card"><form></form></div><ol><li>'+prose+'</li></ol>'])('does not borrow aggregated text or skip an unexplained support box: %s',support=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><div><p id="lead">Consider this approach</p></div>${support}</section>`
    const lead=document.getElementById('lead')!
    expect(getReadingBlockTargets(lead,createScanContext())).not.toContain(lead)
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(lead)
  })
  it.each(['<form></form>','<section></section>','<div><section></section></div>','<div><form></form></div>'])('does not skip the empty boundary %s to borrow a later list',boundary=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><p id="lead">Consider this approach</p>${boundary}<ol><li>${prose}</li></ol></section>`
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('lead'))
  })
  it.each(['section','aside'])('does not borrow from a wrapped independent %s',tag=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><p id="lead">Consider this approach</p><div><${tag}><p>${prose}</p></${tag}></div></section>`
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('lead'))
  })
  it('recomputes a relationship after a new sibling splits a former wrapper',()=>{
    document.body.innerHTML=`<section><div><p id="lead">Consider this approach</p></div><ol><li>${prose}</li></ol></section>`
    const lead=document.getElementById('lead')!,context=createScanContext()
    expect(getReadingBlockTargets(lead,context)).toContain(lead)
    const sibling=document.createElement('p');sibling.textContent='Unrelated';lead.parentElement!.append(sibling)
    invalidateScanCache(context,sibling)
    expect(getReadingBlockTargets(lead,context)).toEqual(getReadingBlockTargets(lead,createScanContext()))
  })
  it('bounds a wide region and does not cache incomplete compound evidence',()=>{
    document.body.innerHTML='<div>'+Array.from({length:1000},()=>'<p>'+prose+'</p>').join('')+'<a href="/trial">Start your free trial</a></div>'
    const context=createScanContext({supplementalBudget:0}),copy=document.querySelector('p')!
    getReadingPurposeDecision(copy,context)
    expect(context.stats.budgetExceeded).toBe(true)
    expect(context.stats.budgetDeferredReadingSubtrees).toBeGreaterThan(0)
    expect(context.readingCompounds.has(copy.parentElement!)).toBe(false)
  })
  it.each(['Donate','Donate now'])('treats the complete independent action %s as module purpose without site naming',action=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section><h3>Community support</h3><p id="amount">Contributions help us keep public equipment available throughout the next season.</p><a href="/support">${action}</a></section>`
    expect(getReadingPurposeDecision(document.getElementById('amount')!,createScanContext()).policy).toBe('skip-self')
  })
  it.each(['How to donate','donate documentation','donation goal'])('retains informational prose and the link %s',label=>{
    document.body.innerHTML=`<main><article><h1>Community guide</h1><p id="copy">${prose} The guide explains how to donate materials, and the <a href="/documentation">${label}</a> provides further context for the process.</p></article></main>`
    expect(hasPromotionalCallToAction(document.getElementById('copy')!)).toBe(false)
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(document.getElementById('copy'))
  })
  it.each([0,1,3,10])('preserves a list introduction across %i neutral wrappers, initially and dynamically',depth=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><section>${wrap('<p id="lead">Consider this approach</p>',depth)}${wrap('<ol><li>'+prose+'</li></ol>',depth)}</section>`
    const lead=document.getElementById('lead')!,result=resolveAutoTranslationTarget('smart')
    expect(result.nodes).toContain(lead)
    expect(collectDynamicTranslationNodes(lead,result.contentRoot,'smart',result.grabOptions)).toContain(lead)
  })
  it.each([0,1,3,10])('does not let %i wrappers hide the promotion in the same module',depth=>{
    document.body.innerHTML=`<main><p>${prose}</p></main><div><h3>Workspace plans</h3>${wrap('<p id="offer">Our complete package gives every member extra templates and personal support throughout the year, with a special discount available today.</p>',depth)}<a href="/plans">Start your free trial</a></div>`
    const offer=document.getElementById('offer')!,result=resolveAutoTranslationTarget('smart')
    expect(getReadingPurposeDecision(offer,createScanContext()).policy).toBe('skip-self')
    expect(result.nodes.some(node=>node===offer||node.contains(offer))).toBe(false)
    expect(collectDynamicTranslationNodes(offer,result.contentRoot,'smart',result.grabOptions).some(node=>node===offer||node.contains(offer))).toBe(false)
  })
  it.each(['section','aside','div role="note"','div contenteditable="true"'])('keeps the independent %s boundary around list context',tag=>{
    const name=tag.split(' ')[0]
    document.body.innerHTML=`<main><p>${prose}</p></main><section><${tag}><p id="lead">Consider this approach</p></${name}><ol><li>${prose}</li></ol></section>`
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('lead'))
  })
  it('does not borrow a signup module to exclude preceding independent article prose',()=>{
    document.body.innerHTML=`<main><article><h1>Shared equipment</h1><div><p id="copy">${prose}</p></div><form><input type="email"><button>Subscribe</button></form></article></main>`
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(document.getElementById('copy'))
  })
  it('recognises one CTA across inline formatting, but never assembles it across independent links',()=>{
    document.body.innerHTML=`<section><p id="copy">${prose} <a href="/symbols">sign</a> <a href="/prepositions">in</a> are separate dictionary entries.</p><p id="cta">${prose} <a href="/account"><span>sign </span><strong>in</strong></a></p></section>`
    expect(hasPromotionalCallToAction(document.getElementById('copy')!)).toBe(false)
    expect(hasPromotionalCallToAction(document.getElementById('cta')!)).toBe(true)
  })
  it('bounds deep relationships without caching a partial result as complete',()=>{
    document.body.innerHTML=wrap('<p id="copy">'+prose+'</p>',100)
    const copy=document.getElementById('copy')!,context=createScanContext({supplementalBudget:5})
    getReadingPurposeDecision(copy,context)
    expect(context.stats.budgetExceeded).toBe(true)
    expect(context.stats.budgetDeferredReadingSubtrees).toBeGreaterThan(0)
    expect(context.budgetUsage.supplemental).toBeLessThanOrEqual(5)
  })
  it('invalidates the logical carrier when a wrapper becomes a semantic module',()=>{
    document.body.innerHTML=`<section><div><p id="lead">Consider this approach</p></div><ol><li>${prose}</li></ol></section>`
    const copy=document.getElementById('lead')!,layout=document.querySelector('section > div')!,context=createScanContext()
    expect(getReadingBlockTargets(copy,context)).toContain(copy)
    layout.setAttribute('role','note');invalidateScanCache(context,layout)
    expect(getReadingBlockTargets(copy,context)).not.toContain(copy)
  })
})
