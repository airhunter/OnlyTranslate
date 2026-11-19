import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/entrypoints/utils/config', () => ({ config: { translationScope: 'smart', display: 1 } }))
vi.mock('@/entrypoints/utils/translateApi', () => ({ cancelAllTranslations: vi.fn(), translateText: vi.fn() }))
vi.mock('@/entrypoints/utils/icon', () => ({ insertFailedTip: vi.fn(), insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() })) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }))
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDynamicTranslationNodes } from '@/entrypoints/main/translationTarget/dynamic'
import { joshComeauProfile } from '@/entrypoints/main/siteProfiles/joshComeau'
import { invalidateContentFilterCache } from '@/entrypoints/utils/contentFilter'

const introduction='<p id="copy"><strong>Here is an explanation of the techniques used to rebuild this publication.</strong> The next article examines the implementation in detail, and you can join my newsletter to receive it.</p>'
const form='<div id="signup"><form><label>Email address</label><input type="email"><button>Subscribe</button></form><span></span></div>'
beforeEach(()=>{
  Object.defineProperty(window,'location',{value:new URL('https://www.joshwcomeau.com/css/has/'),configurable:true})
  document.body.innerHTML=`<main><article><h1>Explaining selectors</h1><p>A complete explanation provides practical examples so readers can understand the underlying implementation and reproduce the results themselves.</p>${introduction}${form}</article></main>`
  invalidateContentFilterCache(document.body);invalidateContentFilterCache(document.documentElement)
})
describe('explicit reviewed Josh article adaptation',()=>{
  it('selects the whole explanation once, while leaving the independent form out',()=>{
    const result=resolveAutoTranslationTarget('smart'),copy=document.getElementById('copy')!
    expect(result.nodes.filter(node=>node===copy)).toHaveLength(1)
    expect(result.nodes.some(node=>node.matches('form, button, input, label'))).toBe(false)
  })
  it.each(['https://www.joshwcomeau.com/css/other/','https://other.joshwcomeau.com/css/has/','https://unrelated.invalid/css/has/'])('does not expand the exception to %s',url=>{
    Object.defineProperty(window,'location',{value:new URL(url),configurable:true})
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('copy'))
  })
  it('does not expand full mode or ambiguous matching paragraphs',()=>{
    const copy=document.getElementById('copy')!
    expect(joshComeauProfile.allowTarget!(copy,{mode:'full',scope:'full',contentRoot:document.body})).toBeUndefined()
    document.querySelector('article')!.insertAdjacentHTML('beforeend',introduction.replace('id="copy"','id="second"')+form.replace('id="signup"','id="extra"'))
    expect(joshComeauProfile.supplemental!(document.body,{mode:'smart'})).toEqual([])
  })
  it.each(['form-late','paragraph-late'])('handles %s through existing profile expansion without a whole-article scan',state=>{
    const main=document.querySelector('main')!,article=document.querySelector('article')!
    document.getElementById(state==='form-late'?'signup':'copy')!.remove()
    const result=resolveAutoTranslationTarget('smart')
    if(state==='form-late')article.insertAdjacentHTML('beforeend',form)
    else document.getElementById('signup')!.insertAdjacentHTML('beforebegin',introduction)
    const root=document.querySelector(state==='form-late'?'form':'#copy')!
    const nodes=collectDynamicTranslationNodes(root,main,'smart',result.grabOptions)
    expect(nodes).toContain(document.getElementById('copy'))
    expect(new Set(nodes).size).toBe(nodes.length)
  })
  it.each(['hidden','translate="no"'])('preserves hard protection %s',attribute=>{
    document.getElementById('copy')!.outerHTML=introduction.replace('<p id="copy">','<p id="copy" '+attribute+'>')
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('copy'))
  })
})
