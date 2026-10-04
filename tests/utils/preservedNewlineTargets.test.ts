import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

vi.mock('@/entrypoints/utils/config', () => ({ config: { translationScope: 'smart', display: 1 } }))

import { cleanupDirectTextTargets, DIRECT_TEXT_TARGET_ATTR, grabAllNode } from '@/entrypoints/main/dom'
import { collectTranslationTargets, resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDynamicTranslationNodes } from '@/entrypoints/main/translationTarget/dynamic'
import { siteProfiles } from '@/entrypoints/main/siteProfiles'

const selector = `[${DIRECT_TEXT_TARGET_ATTR}="true"]`
const paragraph = 'Lead clinical solution delivery and coordinate implementation with global teams. '.repeat(24)
const sourceText = `${paragraph}\r\n \r\nResponsibilities:\n● Lead delivery.\n● Manage risks.\n\n${paragraph}`

function setup(style = 'pre-wrap', text = sourceText): HTMLElement {
  document.body.innerHTML = `<article id="story"><dl><dd id="jd" style="white-space: ${style}"></dd></dl></article>`
  const host = document.querySelector<HTMLElement>('#jd')!
  host.textContent = text
  return host
}

describe('preserved newline translation targets', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it.each(['pre-wrap', 'pre-line'])('collects every paragraph in one scan for %s and preserves separators', style => {
    const host = setup(style)
    const originalNode = host.firstChild
    const targets = grabAllNode(host)
    expect(targets).toHaveLength(3)
    expect(targets.map(node => node.textContent)).toEqual([paragraph, 'Responsibilities:\n● Lead delivery.\n● Manage risks.', paragraph])
    expect(host.textContent).toBe(sourceText)
    expect(grabAllNode(host)).toEqual(targets)
    cleanupDirectTextTargets(targets)
    expect(host.childNodes).toHaveLength(1)
    expect(host.firstChild).toBe(originalNode)
    expect(host.textContent).toBe(sourceText)
  })

  it('splits an oversized paragraph at lines or words without losing text or splitting surrogate pairs', () => {
    const host = setup('pre-wrap', `${paragraph.repeat(3)}\n${'😀'.repeat(1800)} continued delivery work.`)
    const originalText = host.textContent
    const targets = grabAllNode(host)
    expect(targets.length).toBeGreaterThan(2)
    expect(targets.every(node => node.textContent!.length <= 3072)).toBe(true)
    expect(targets.every(node => !/[\uD800-\uDBFF]$/.test(node.textContent!))).toBe(true)
    expect(host.textContent).toBe(originalText)
    cleanupDirectTextTargets(targets)
    expect(host.childNodes).toHaveLength(1)
    expect(host.textContent).toBe(originalText)
  })

  it('keeps serialized wrappers under the markup limit for escaped text', () => {
    const text = `Clinical delivery includes ${'<&>'.repeat(1300)}\nEnsure successful implementation.`
    const host = setup('pre-wrap', text)
    const targets = grabAllNode(host)
    expect(targets.length).toBeGreaterThan(1)
    expect(targets.every(node => node.outerHTML.length <= 4096)).toBe(true)
    expect(host.textContent).toBe(text)
  })

  it.each(['normal', 'pre', 'break-spaces'])('does not split text with %s whitespace', style => {
    const host = setup(style)
    grabAllNode(host)
    expect(host.querySelector(selector)).toBeNull()
    expect(host.childNodes).toHaveLength(1)
  })

  it('does not split short or mixed markup content', () => {
    const short = setup('pre-wrap', 'Short paragraph.\n\nAnother paragraph.')
    grabAllNode(short)
    expect(short.querySelector(selector)).toBeNull()
    const mixed = setup()
    mixed.appendChild(document.createElement('em')).textContent = 'Emphasized content.'
    grabAllNode(mixed)
    expect(mixed.querySelector(selector)).toBeNull()
  })

  it.each(['pre', 'code', 'nav', 'button', '[translate="no"]', '[contenteditable="true"]', '[hidden]'])('does not split excluded content inside %s', excluded => {
    const host = setup()
    const container = document.createElement(excluded.startsWith('[') ? 'div' : excluded)
    if (excluded.startsWith('[')) {
      const attribute = /\[([^=\]]+)(?:="([^"]*)")?\]/.exec(excluded)!
      container.setAttribute(attribute[1], attribute[2] ?? '')
    }
    host.replaceWith(container)
    container.appendChild(host)
    grabAllNode(container)
    expect(host.querySelector(selector)).toBeNull()
    expect(host.textContent).toBe(sourceText)
  })

  it('reuses all targets on dynamic rescans', () => {
    const host = setup()
    const story = document.querySelector('#story')!
    const first = collectDynamicTranslationNodes(host, story, 'smart', { siteCompatMode: 'smart' })
    const second = collectDynamicTranslationNodes(host, story, 'smart', { siteCompatMode: 'smart' })
    expect(first).toHaveLength(3)
    expect(second).toEqual(first)
    expect(host.querySelectorAll(selector)).toHaveLength(3)
  })

  it('merges only owned text fragments when the website adds adjacent text', () => {
    const host = setup()
    const targets = grabAllNode(host)
    const before = document.createTextNode('Website prefix ')
    const after = document.createTextNode(' Website suffix')
    host.prepend(before)
    host.append(after)
    cleanupDirectTextTargets(targets)
    expect(host.childNodes).toHaveLength(3)
    expect(host.firstChild).toBe(before)
    expect(host.lastChild).toBe(after)
    expect(host.textContent).toBe(`Website prefix ${sourceText} Website suffix`)
  })

  it('preserves a website node inserted between owned fragments during cleanup', () => {
    const host = setup()
    const targets = grabAllNode(host)
    const update = document.createElement('em')
    update.textContent = 'Live update'
    host.insertBefore(update, targets[1])
    cleanupDirectTextTargets(targets)
    expect(update.parentNode).toBe(host)
    expect(host.querySelector(selector)).toBeNull()
    expect(host.textContent!.replace('Live update', '')).toBe(sourceText)
  })

  it('preserves a website text node added inside an owned wrapper', () => {
    const host = setup()
    const targets = grabAllNode(host)
    const update = document.createTextNode('Live update')
    targets[0].appendChild(update)
    cleanupDirectTextTargets(targets)
    expect(update.parentNode).toBe(host)
    expect(update.data).toBe('Live update')
    expect(host.querySelector(selector)).toBeNull()
    expect(host.textContent!.replace('Live update', '')).toBe(sourceText)
  })

  it('cleans every fragment if the final target policy rejects them', () => {
    const host = setup()
    const originalNode = host.firstChild
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: new URL('https://split-policy-test.example/job'), configurable: true })
    siteProfiles.push({
      id: 'split-policy-test', domains: ['split-policy-test.example'],
      skipTarget: node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR) ? { policy: 'hard-skip', reason: 'test' } : undefined
    })
    try {
      const decisions = collectTranslationTargets(host, {
        mode: 'full', scope: 'full', contentRoot: host, grabOptions: { siteCompatMode: 'full' }
      })
      expect(decisions).toEqual([])
      expect(host.querySelector(selector)).toBeNull()
      expect(host.childNodes).toHaveLength(1)
      expect(host.firstChild).toBe(originalNode)
      expect(host.textContent).toBe(sourceText)
    } finally {
      siteProfiles.pop()
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    }
  })

  it('keeps adopted fragments and completes restoration after the last wrapper is released', () => {
    const host = setup()
    const targets = grabAllNode(host)
    cleanupDirectTextTargets(targets, [targets[1]])
    expect(host.querySelectorAll(selector)).toHaveLength(1)
    expect(host.textContent).toBe(sourceText)
    cleanupDirectTextTargets([targets[1]])
    expect(host.childNodes).toHaveLength(1)
    expect(host.textContent).toBe(sourceText)
  })

  it('collects the JD when company prose wins smart content-root scoring', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: new URL('https://www.liepin.com/job/1985555579.shtml'), configurable: true })
    document.body.innerHTML = fs.readFileSync('tests/fixtures/translation-target/liepin-preserved-newline-jd.html', 'utf8')
    const company = document.querySelector('.company-intro-container')!
    const jd = document.querySelector('[data-selector="job-intro-content"]')!
    try {
      const result = resolveAutoTranslationTarget('smart')
      expect(result.contentRoot).toBe(company)
      expect(result.nodes.filter(node => jd.contains(node))).toHaveLength(11)
      expect(resolveAutoTranslationTarget('smart').nodes.filter(node => jd.contains(node))).toEqual(result.nodes.filter(node => jd.contains(node)))
      expect(collectDynamicTranslationNodes(jd, result.contentRoot, 'smart', result.grabOptions).filter(node => jd.contains(node))).toHaveLength(11)
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    }
  })

  it.each([
    { path: '/company/123456/', selector: 'job-intro-content' },
    { path: '/job/1985555579.shtml', selector: 'unrelated-content' }
  ])('does not supplement unrelated Liepin content at $path with $selector', ({ path, selector }) => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: new URL(`https://www.liepin.com${path}`), configurable: true })
    document.body.innerHTML = fs.readFileSync('tests/fixtures/translation-target/liepin-preserved-newline-jd.html', 'utf8')
    const jd = document.querySelector('#job-description')!
    jd.setAttribute('data-selector', selector)
    try {
      const result = resolveAutoTranslationTarget('smart')
      expect(result.contentRoot).toBe(document.querySelector('.company-intro-container'))
      expect(result.nodes.filter(node => jd.contains(node))).toEqual([])
      expect(jd.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBeNull()
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    }
  })
})
