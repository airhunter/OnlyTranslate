import { beforeEach, describe, expect, it } from 'vitest'
import { encodeInlineLinkRequest, getSmartInlineLinkResolver, prepareInlineLinkTranslation, preserveInlineLink, renderInlineLinkTranslation } from '@/entrypoints/main/inlineLinks'
import { prepareTranslationOnly, applyTranslationOnly, restoreAllTranslationOnly, restoreTranslationOnly } from '@/entrypoints/main/translationOnly'

const sample = 'Read <a id="story" class="brand" href="https://example.com/story" onclick="throw 1" style="color: rgb(0, 120, 200)">the story</a> from <a id="mention" href="/reader">@reader</a> <a id="tag" href="/hashtag/cat">#cat</a> <a id="url" href="https://example.com/" target="_blank">example.com/…</a>.'
const translate = (text: string) => text.replace(/ (__ONLY_TRANSLATE_SLOT_\d+__) /g, '$1').replace('Read ', '阅读').replace('the story', '这篇报道').replace(' from ', '来自').replace(/\.$/, '。')

function setup(site = 'x', scope = 'smart') {
  const url = new URL(site === 'x' ? 'https://x.com/author/status/123' : site === 'threads' ? 'https://www.threads.com/@author/post/123' : 'https://example.com/')
  Object.defineProperty(window, 'location', { value: url, configurable: true })
  Object.defineProperty(document, 'location', { value: url, configurable: true })
  document.body.innerHTML = site === 'threads'
    ? `<div data-pressable-container="true"><div lang="en"><div><span dir="auto"><span id="body">${sample}</span></span></div></div></div>`
    : `<article><div data-testid="tweetText" id="body">${sample}</div></article>`
  const host = document.querySelector<HTMLElement>('#body')!
  return { host, resolve: getSmartInlineLinkResolver(host, scope) }
}

describe('site-scoped smart inline links', () => {
  beforeEach(() => { restoreAllTranslationOnly(); document.body.innerHTML = '' })

  it.each(['x', 'threads'])('restores URL/mention/tag labels and translates descriptive link labels on %s', site => {
    const { host, resolve } = setup(site)
    const originalHTML = host.innerHTML
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    expect(prepared.text).not.toMatch(/@reader|#cat|example.com/)
    expect(prepared.text).toContain('the story')
    const content = renderInlineLinkTranslation(prepared, translate(prepared.text))!
    const rendered = document.createElement('span')
    rendered.append(content)
    expect(rendered.querySelectorAll('a')).toHaveLength(4)
    expect([...rendered.querySelectorAll('a')].map(a => a.textContent)).toEqual(['这篇报道', '@reader', '#cat', 'example.com/…'])
    expect([...rendered.querySelectorAll('a')].map(a => a.href)).toEqual([...host.querySelectorAll('a')].map(a => a.href))
    expect(rendered.querySelector('[id], [onclick]')).toBeNull()
    expect(rendered.querySelector<HTMLAnchorElement>('a')?.style.color).toBe('rgb(0, 120, 200)')
    expect(rendered.querySelector<HTMLAnchorElement>('a:last-child')?.target).toBe('_blank')
    expect(rendered.querySelector<HTMLAnchorElement>('a:last-child')?.rel).toContain('noopener')
    expect(host.innerHTML).toBe(originalHTML)
    expect(restoreAllTranslationOnly()).toEqual([])
  })

  it.each(['full', undefined, 'unknown'])('does not enable the policy outside smart mode (%s)', scope => {
    const { host } = setup()
    expect(getSmartInlineLinkResolver(host, scope)).toBeUndefined()
  })

  it('does not enable the policy on another site or on X page chrome', () => {
    expect(setup('other').resolve).toBeUndefined()
    const { host } = setup()
    document.body.appendChild(host)
    expect(getSmartInlineLinkResolver(host, 'smart')).toBeUndefined()
  })

  it.each(['x', 'threads'])('preserves native link and text identities in translation-only mode on %s', site => {
    const { host, resolve } = setup(site)
    const originalHTML = host.innerHTML
    const nodes = [...host.querySelectorAll('*')]
    const prepared = prepareTranslationOnly(host, node => preserveInlineLink(node, resolve!))
    expect(applyTranslationOnly(prepared, translate(prepared.text))).toBe(true)
    expect(host.textContent).toBe('阅读这篇报道来自@reader #cat example.com/…。')
    expect([...host.querySelectorAll('*')]).toEqual(nodes)
    expect(restoreTranslationOnly(host)).toBe('restored')
    expect(host.innerHTML).toBe(originalHTML)
  })

  it.each(['missing', 'duplicate', 'reordered', 'unknown'])('rejects %s structure markers without emitting broken links', kind => {
    const { host, resolve } = setup()
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    const tokens = prepared.text.match(/__ONLY_TRANSLATE_(?:SLOT_\d+|INLINE_\d+_[a-z0-9]+)__/g)!
    let response = translate(prepared.text)
    if (kind === 'missing') response = response.replace(tokens[0], '')
    if (kind === 'duplicate') response += tokens[0]
    if (kind === 'reordered') response = response.replace(tokens[0], 'TEMP').replace(tokens[1], tokens[0]).replace('TEMP', tokens[1])
    if (kind === 'unknown') response += '__ONLY_TRANSLATE_INLINE_999_unknown__'
    expect(renderInlineLinkTranslation(prepared, response)).toBeNull()
    expect(restoreAllTranslationOnly()).toEqual([])
  })

  it('transports short multilingual posts without English marker names and restores the local protocol', () => {
    const { host, resolve } = setup()
    host.innerHTML = 'なかよし✨ Good family💕 <a href="/hashtag/cat">#cat</a>'
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    const request = encodeInlineLinkRequest(prepared)
    expect(request.text).toContain('なかよし✨ Good family💕')
    expect(request.text).not.toContain('ONLY_TRANSLATE')
    expect(request.decode(request.text)).toBe(prepared.text.replace(/ (__ONLY_TRANSLATE_SLOT_\d+__) /g, '$1'))
    expect(request.decode(request.text.replace('⟦0⟧', ''))).toBeNull()
    expect(request.decode(request.text + '⟦99⟧')).toBeNull()
  })

  it('rejects source collisions with transport boundary syntax', () => {
    const { host, resolve } = setup()
    host.append(' literal ⟦0⟧')
    const request = encodeInlineLinkRequest(prepareInlineLinkTranslation(host, resolve!))
    expect(request.text).toBe('')
    expect(request.decode('anything')).toBeNull()
  })

  it('handles repeated labels by position and binds cached text to the current page links', () => {
    const { host, resolve } = setup()
    host.innerHTML = 'Read <a href="/one">the story</a> and <a href="/two">the story</a>.'
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    const response = translate(prepared.text).replace('the story', '第二篇报道')
    const first = document.createElement('span')
    first.append(renderInlineLinkTranslation(prepared, response)!)
    expect([...first.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['https://x.com/one', 'https://x.com/two'])
    host.querySelector('a')!.setAttribute('href', '/new')
    const second = document.createElement('span')
    second.append(renderInlineLinkTranslation(prepareInlineLinkTranslation(host, resolve!), response)!)
    expect(second.querySelector('a')?.href).toBe('https://x.com/new')
  })

  it('keeps malicious service markup as text and never manufactures a link from plain text', () => {
    const { host, resolve } = setup()
    host.append(' @plain #plain https://plain.example/')
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    const fragment = renderInlineLinkTranslation(prepared, translate(prepared.text).replace('阅读', '<img src=x onerror=alert(1)>'))!
    const rendered = document.createElement('span')
    rendered.append(fragment)
    expect(rendered.querySelector('img')).toBeNull()
    expect(rendered.querySelectorAll('a')).toHaveLength(4)
    expect(rendered.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('retains the clipped spans of a legacy X short URL instead of exposing the hidden full label', () => {
    const { host, resolve } = setup()
    host.innerHTML = 'Read <a href="https://t.co/example" dir="ltr"><span id="prefix" aria-hidden="true" class="r-clipped" onclick="throw 1">https://</span>example.com/story<span aria-hidden="true" class="r-clipped">/full-path</span><span aria-hidden="true" class="r-ellipsis">…</span></a> today.'
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    const rendered = document.createElement('span')
    rendered.append(renderInlineLinkTranslation(prepared, prepared.text.replace('Read ', '阅读'))!)
    const link = rendered.querySelector('a')!
    expect(link.querySelectorAll('.r-clipped[aria-hidden="true"]')).toHaveLength(2)
    expect(link.querySelector('.r-ellipsis')?.textContent).toBe('…')
    expect(link.querySelector('[id], [onclick]')).toBeNull()
    expect(link.getAttribute('dir')).toBe('ltr')
    expect(link.href).toBe('https://t.co/example')
  })

  it('does not clone dangerous URL schemes or hidden and native UI content', () => {
    const { host, resolve } = setup()
    host.insertAdjacentHTML('beforeend', '<a href="javascript:alert(1)">unsafe</a><span hidden>hidden copy</span><button>Translate</button>')
    const prepared = prepareInlineLinkTranslation(host, resolve!)
    expect(prepared.text).not.toMatch(/hidden copy|Translate/)
    const rendered = document.createElement('span')
    rendered.append(renderInlineLinkTranslation(prepared, translate(prepared.text))!)
    expect(rendered.querySelector('[href^="javascript:"]')).toBeNull()
    expect(rendered.textContent).toContain('unsafe')
  })
})
