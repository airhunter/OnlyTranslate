import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('@/entrypoints/utils/config', () => ({ config: { translationScope: 'smart', display: 1 } }))
vi.mock('@/entrypoints/utils/translateApi', () => ({ cancelAllTranslations: vi.fn(), translateText: vi.fn() }))
vi.mock('@/entrypoints/utils/icon', () => ({ insertFailedTip: vi.fn(), insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() })) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }))
import { getReadingPurposeDecision, getReadingProseEvidence } from '@/entrypoints/main/translationTarget/readingEvidence'
import { getReadingBlockTargets } from '@/entrypoints/main/translationTarget/readingBlocks'
import { createScanContext, invalidateScanCache, resetScanBudget } from '@/entrypoints/main/translationTarget/scanContext'
import * as scans from '@/entrypoints/main/translationTarget/scanContext'
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDynamicTranslationNodes } from '@/entrypoints/main/translationTarget/dynamic'
import { decideTranslationTarget } from '@/entrypoints/main/translationTarget/decision'
import { invalidateContentFilterCache } from '@/entrypoints/utils/contentFilter'
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier'
import { cleanupDirectTextTargets, DIRECT_TEXT_TARGET_ATTR, getTranslatableText } from '@/entrypoints/main/dom'
import { siteProfiles } from '@/entrypoints/main/siteProfiles'
import { supplementalCompatFn } from '@/entrypoints/main/compat'
import type { SiteProfile } from '@/entrypoints/main/siteProfiles/types'

const first = 'Keep a local copy of the working configuration so every administrator can inspect the settings before the next upgrade.'
const second = 'Record changes in a shared log so another volunteer can reproduce the result and explain differences during a later review.'
beforeEach(() => {
  document.body.innerHTML = ''; document.title = ''
  Object.defineProperty(window, 'location', { value: new URL('https://independent-reading.invalid/guide'), configurable: true })
  invalidateContentFilterCache(document.body); invalidateContentFilterCache(document.documentElement)
})

describe('shared reading evidence', () => {
  it.todo('Known generic capability gap: distinguish mixed reading/newsletter prose without borrowing a neighbour')

  it.each(['form', 'aside', 'section'])('does not borrow reading context across an empty %s boundary', tag => {
    document.body.innerHTML = `<main><p>${first}</p></main><div><p>${second}</p><${tag}></${tag}><p id="mixed">Join our newsletter to receive a complete collection of exclusive updates that our subscribers can explore every week.</p></div>`
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('mixed'))
  })

  it.each(['<pre>'+ first +'</pre>', '<span hidden>'+ first +'</span>', '<code>const note = "'+ first +'";</code>'])('does not use protected content as independent reading support: %s', support => {
    document.body.innerHTML = `<main><p>${second}</p></main><section><p>${support}</p><p id="mixed">Join our newsletter to receive a complete collection of exclusive updates that our subscribers can explore every week.</p></section>`
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('mixed'))
  })

  it.each(['aside', 'section', 'nav', 'div role="complementary"'])('does not borrow prose inside a nested %s module in a quotation or list item', module => {
    const moduleTag = module.split(' ')[0]
    const content = `<${module}><h3>Related articles</h3><p>${first}</p></${moduleTag}>`
    for (const wrapper of ['blockquote', 'li']) {
      const container = wrapper === 'li' ? 'ul' : 'section'
      const target = wrapper === 'li' ? 'li' : 'p'
      document.body.innerHTML = `<main><p>${second}</p></main><${container}><${wrapper}>${content}</${wrapper}><${target} id="mixed">Join our newsletter to receive a complete collection of exclusive updates that our subscribers can explore every week.</${target}></${container}>`
      expect(getReadingPurposeDecision(document.getElementById('mixed')!, createScanContext()).policy).toBe('skip-self')
      expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('mixed'))
    }
  })

  it.each(['Join my newsletter', 'Join our newsletter', 'Join the research newsletter', 'Sign up for the mailing list'])('excludes the interactive invitation %s even with neighbouring readable prose', invitation => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><p>${second}</p><p id="offer">The archive preserves every original document so readers can compare later changes. <a href="/subscribe">${invitation}</a> for future explanations.</p></aside>`
    expect(getReadingPurposeDecision(document.getElementById('offer')!, createScanContext()).policy).toBe('skip-self')
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('offer'))
  })

  it('does not assemble an invitation from two separate ordinary links', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><section><p id="copy"><a href="/expedition">Join expedition</a>. ${second} Our <a href="/format">Newsletter format guide</a> explains the complete document format.</p></section>`
    expect(getReadingPurposeDecision(document.getElementById('copy')!, createScanContext()).policy).toBe('keep')
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(document.getElementById('copy'))
  })

  it('recognises one invitation link even when its words are split across inline formatting', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><p>${second}</p><p id="copy">The archive preserves every original document so readers can compare later changes. <a href="/join"><span>Join my </span><em>newsletter</em></a> for updates.</p></aside>`
    expect(getReadingPurposeDecision(document.getElementById('copy')!, createScanContext()).policy).toBe('skip-self')
    expect(resolveAutoTranslationTarget('smart').nodes).not.toContain(document.getElementById('copy'))
  })

  it('does not prepare generic coverage when a profile already suppresses that walk', () => {
    document.body.innerHTML = `<main><p id="one">${first}</p><p id="two">${second}</p></main>`
    const targets = Array.from(document.querySelectorAll('p'))
    const allowTarget = vi.fn((node: Element) => targets.includes(node as HTMLParagraphElement)
      ? { role: 'paragraph' as const, reason: 'test-profile-reading' } : undefined)
    const profile: SiteProfile = { id: 'isolated-fast-path', domains: ['independent-reading.invalid'], targetStrategy: 'profile-first', allowTarget }
    const previous = supplementalCompatFn['independent-reading.invalid']
    siteProfiles.push(profile)
    supplementalCompatFn['independent-reading.invalid'] = () => targets
    try {
      const result = resolveAutoTranslationTarget('smart')
      expect(result.stats?.profileFastPathUsed).toBe(true)
      expect(result.nodes).toEqual(targets)
      for (const target of targets) expect(allowTarget.mock.calls.filter(([node]) => node === target)).toHaveLength(1)
    } finally {
      siteProfiles.splice(siteProfiles.indexOf(profile), 1)
      if (previous) supplementalCompatFn['independent-reading.invalid'] = previous
      else delete supplementalCompatFn['independent-reading.invalid']
    }
  })

  it.each(['hidden', 'aria-hidden="true"', 'class="notranslate"', 'style="display:none"'])('keeps the visible page heading despite a %s duplicate', attribute => {
    document.title = 'Building shared tools • Workshop notes'
    document.body.innerHTML = `<header><h1 id="visible-title">Building shared tools</h1></header><main><p>${first}</p><div ${attribute}><h1>Building shared tools</h1></div></main>`
    expect(resolveAutoTranslationTarget('smart').nodes.map(node => node.id)).toContain('visible-title')
  })

  it.each(['https://independent-reading.invalid/guide', 'https://another-review.example/manual', 'https://community-tools.test/reference'])('shares initial and dynamic decisions on %s', url => {
    Object.defineProperty(window, 'location', { value: new URL(url), configurable: true })
    document.body.innerHTML = readFileSync('tests/fixtures/translation-target/unified-reading-context.html', 'utf8')
    const initial = resolveAutoTranslationTarget('smart'), ids = initial.nodes.map(node => node.id)
    for (const id of ['offer-copy', 'editor-lead', 'navigation-copy']) expect(ids).not.toContain(id)
    for (const id of ['wrapped-copy', 'inline-copy', 'single-item-lead', 'aside-copy']) {
      const node = document.getElementById(id)!
      expect(ids).toContain(id)
      expect(collectDynamicTranslationNodes(node.parentElement!, initial.contentRoot, 'smart', initial.grabOptions)).toContain(node)
    }
  })

  it('does not reject readable support because its aggregate is too large to translate', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><section><p id="lead">Consider this approach</p><ol>${Array.from({ length: 35 }, () => `<li>${second}</li>`).join('')}</ol></section>`
    const lead = document.getElementById('lead')!
    expect(getReadingBlockTargets(lead, createScanContext(), document.querySelector('main')!)).toContain(lead)
  })

  it('keeps independently classified reading cards available in both initial and dynamic collection', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><section class="notice-card"><h3>Practical advice</h3>${second}</section></aside>`
    const card = document.querySelector('.notice-card')!
    expect(scans.isLikelyReadingCandidate(card)).toBe(true)
    expect(classifyContentUnit(card)).toMatchObject({ action: 'allow', kind: 'content-card' })
    const initial = resolveAutoTranslationTarget('smart')
    const dynamic = collectDynamicTranslationNodes(document.querySelector('aside')!, initial.contentRoot, 'smart', initial.grabOptions)
    for (const nodes of [initial.nodes, dynamic]) expect(nodes.map(node => getTranslatableText(node)).join(' ')).toContain(second)
    expect(card.textContent).toContain(second)
  })

  it('does not let old supplemental exhaustion short-circuit a refreshed dynamic budget', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><section><p id="lead">Consider this approach</p><div><ol><li>${second}</li></ol></div></section>`
    const context = createScanContext({ supplementalBudget: 1, dynamicBudget: 100 })
    const lead = document.getElementById('lead')!, main = document.querySelector('main')!
    expect(getReadingBlockTargets(lead, context, main)).toEqual([])
    expect(context.stats.budgetExceeded).toBe(true)
    resetScanBudget(context, 'dynamic')
    expect(getReadingBlockTargets(lead, context, main, 'dynamic')).toContain(lead)
  })

  it('invalidates both net prose and sibling-heading context after a source change', () => {
    document.body.innerHTML = `<section><h2 id="label">Practical advice</h2><p id="copy">${first}</p></section>`
    const context = createScanContext(), copy = document.getElementById('copy')!, label = document.getElementById('label')!
    expect(getReadingBlockTargets(copy, context)).toContain(label)
    label.remove(); copy.innerHTML = `<pre>${first}</pre>`
    invalidateScanCache(context, copy)
    expect(getReadingProseEvidence(copy, context)?.strength).toBe('none')
    expect(getReadingBlockTargets(copy, context)).toEqual([])
  })

  it('retains control-purpose evidence even though protected descendants provide no prose', () => {
    document.body.innerHTML = `<section><p id="copy">${first}</p><a href="/plans">Start your free trial</a></section>`
    const node = document.getElementById('copy')!, context = createScanContext()
    expect(getReadingPurposeDecision(node, context).reason).toBe('promotional-reading-context')
    node.innerHTML = `<pre>${first}</pre>`; invalidateScanCache(context, node)
    expect(getReadingProseEvidence(node, context)?.strength).toBe('none')
  })

  it.each(['grab-node', 'supplemental', 'reading-block'] as const)('applies shared purpose to the %s entry', source => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><strong>Workspace plans</strong><p id="offer">${second}</p><a href="/plans">Start your free trial</a></aside>`
    const node = document.getElementById('offer')!, context = { mode: 'smart' as const, scope: 'smart', contentRoot: document.querySelector('main')!, grabOptions: { scanContext: createScanContext() } }
    const candidate = source === 'reading-block' ? { node, source, readingRole: 'paragraph' as const } : { node, source }
    expect(decideTranslationTarget(candidate, context).policy).toBe('hard-skip')
  })

  it('builds heading associations linearly and accounts for that work', () => {
    const scan = (size: number) => {
      document.body.innerHTML = `<section><h2>Practical advice</h2>${Array.from({ length: size }, () => `<p>${first}</p>`).join('')}</section>`
      const context = createScanContext({ supplementalBudget: 10000 })
      for (const node of document.querySelectorAll('p')) expect(getReadingBlockTargets(node, context).length).toBeGreaterThan(0)
      return context.budgetUsage.supplemental
    }
    expect(scan(120)).toBeLessThanOrEqual(scan(60) * 2.2)
  })

  it('bounds empty-sibling exploration by the active budget', () => {
    document.body.innerHTML = `<section><p id="lead">Consider this approach</p>${'<i></i>'.repeat(2000)}<p>${first}</p></section>`
    const context = createScanContext({ supplementalBudget: 20 })
    expect(getReadingBlockTargets(document.getElementById('lead')!, context)).toEqual([])
    expect(context.budgetUsage.supplemental).toBe(20)
    expect(context.stats.budgetDeferredReadingSubtrees).toBeGreaterThan(0)
  })

  it('keeps a semantic Discussion heading while excluding a standalone comments label', () => {
    document.body.innerHTML = `<main><article><h1>Experimental results</h1><p>${first}</p><h2 id="discussion">Discussion</h2><p>${second}</p></article></main><div>Comments</div>`
    const discussion = document.getElementById('discussion')!
    expect(getReadingPurposeDecision(discussion, createScanContext()).policy).toBe('keep')
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(discussion)
    expect(getReadingPurposeDecision(document.body.lastElementChild!, createScanContext()).reason).toBe('reading-section-label')
  })

  it.each(['', '<h2>Configuration guidance</h2>', '<div><h2>Configuration guidance</h2></div>'])('does not infer recommendation purpose from a class and heading wrapper (%s)', heading => {
    document.body.innerHTML = `<main><article><h1>Operational manual</h1><section class="recommendations">${heading}<p id="copy">${first}</p></section></article></main>`
    const node = document.getElementById('copy')!
    expect(getReadingPurposeDecision(node, createScanContext()).policy).toBe('keep')
    expect(resolveAutoTranslationTarget('smart').nodes.some(target => target === node || target.contains(node))).toBe(true)
  })

  it.each(['Permissions and access control', 'Author guidelines', 'Citation management'])('treats %s as an article subject rather than a metadata declaration', label => {
    document.body.innerHTML = `<main><article aria-label="${label}"><h1>${label}</h1><p id="copy">${first}</p></article></main>`
    const node = document.getElementById('copy')!, context = createScanContext()
    expect(getReadingPurposeDecision(node, context).policy).toBe('keep')
    expect(getReadingProseEvidence(document.querySelector('article')!, context)?.strength).toBe('strong')
    expect(resolveAutoTranslationTarget('smart').nodes).toContain(node)
  })

  it('keeps prose sections despite metadata-like machine names while excluding scalar bylines', () => {
    document.body.innerHTML = `<main><article><h1>Metadata format</h1><div class="metadata"><p id="copy">${first}</p></div><div class="byline"><a href="/writer">A Reader</a><time>2026-11-16</time></div></article></main>`
    const context = createScanContext(), copy = document.getElementById('copy')!
    expect(getReadingPurposeDecision(copy, context).policy).toBe('keep')
    expect(getReadingProseEvidence(copy, context)?.strength).toBe('strong')
    expect(getReadingPurposeDecision(document.querySelector('.byline a')!, context).policy).not.toBe('keep')
  })

  it('stops the net-text traversal rather than merely hiding further work from the counter', () => {
    const attempts = vi.spyOn(scans, 'tryUseScanBudget')
    try {
      for (const size of [100, 1000]) {
        document.body.innerHTML = `<section>${Array.from({ length: size }, () => `<p>${first}</p>`).join('')}</section>`
        const context = createScanContext({ supplementalBudget: 3 })
        attempts.mockClear()
        expect(getReadingProseEvidence(document.querySelector('section')!, context, 'supplemental')).toBeUndefined()
        expect(attempts.mock.calls.length).toBeLessThanOrEqual(4)
        expect(context.readingEvidence.has(document.querySelector('section')!)).toBe(false)
      }
    } finally { attempts.mockRestore() }
  })

  it('carries reading context through safe br splitting and restores source exactly', () => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><p id="copy">${first}<br>Copyright reserved text<br>${second}</p></aside>`
    const copy = document.getElementById('copy')!, original = copy.innerHTML
    const nodes = collectDynamicTranslationNodes(document.querySelector('aside')!, document.querySelector('main')!, 'smart', { siteCompatMode: 'smart', scanContext: createScanContext() })
    expect(nodes).toHaveLength(2)
    expect(nodes.map(node => getTranslatableText(node)).join(' ')).not.toContain('Copyright')
    const wrappers = Array.from(copy.querySelectorAll(`[${DIRECT_TEXT_TARGET_ATTR}]`))
    expect(wrappers.every(wrapper => nodes.includes(wrapper))).toBe(true)
    cleanupDirectTextTargets(new Set(wrappers), [])
    expect(copy.innerHTML).toBe(original)
  })

  it.each(['exclude', 'throw'] as const)('rolls back all dynamic wrappers when final decisions %s', outcome => {
    document.body.innerHTML = `<main><p>${first}</p></main><aside><p id="copy">${first}<br>${second}</p></aside>`
    const copy = document.getElementById('copy')!, original = copy.innerHTML
    const profile: SiteProfile = {
      id: 'test-rejected-source', domains: ['independent-reading.invalid'],
      skipTarget: node => {
        if (!node.hasAttribute(DIRECT_TEXT_TARGET_ATTR)) return false
        if (outcome === 'throw') throw new Error('final decision failed')
        return { policy: 'hard-skip', role: 'ui', reason: 'test-final-rejection' }
      }
    }
    siteProfiles.push(profile)
    try {
      const collect = () => collectDynamicTranslationNodes(document.querySelector('aside')!, document.querySelector('main')!, 'smart', { siteCompatMode: 'smart', scanContext: createScanContext() })
      if (outcome === 'throw') expect(collect).toThrow('final decision failed')
      else expect(collect()).toEqual([])
      expect(copy.innerHTML).toBe(original)
      expect(document.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}]`)).toBeNull()
    } finally { siteProfiles.splice(siteProfiles.indexOf(profile), 1) }
  })
})
