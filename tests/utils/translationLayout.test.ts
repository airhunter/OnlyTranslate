import { afterEach, describe, expect, it } from 'vitest'
import { BILINGUAL_LABEL_ATTR, BILINGUAL_ORIGINAL_CLASS, isCompactTranslationTarget, resolveBilingualControlTarget, prepareCompactBilingualTarget, prepareBilingualClipping, prepareBilingualTextFlow, prepareBilingualCardFlow, normalizeBilingualSourceStyles, restoreBilingualLayout, restoreAllBilingualLayouts, setTranslationStyle } from '@/entrypoints/main/translationLayout'

afterEach(() => { restoreAllBilingualLayouts(); document.body.innerHTML = '' })

describe('compact bilingual insertion boundaries', () => {
  it('preserves authored nowrap inside a shadow-root flex control and restores its text node', () => {
    const component = document.createElement('nav-label')
    document.body.appendChild(component)
    const root = component.attachShadow({ mode: 'open' })
    root.innerHTML = '<a href="/menu" style="display:flex;white-space:nowrap"><span id="copy" style="white-space:nowrap">Software</span><svg width="16" height="16"></svg></a>'
    const copy = root.querySelector<HTMLElement>('#copy')!
    const original = root.innerHTML
    const text = copy.firstChild
    const target = prepareCompactBilingualTarget(copy, copy)
    expect(target.style.getPropertyValue('white-space')).toBe('nowrap')
    expect(target.style.getPropertyPriority('white-space')).toBe('important')
    restoreAllBilingualLayouts()
    expect(root.innerHTML).toBe(original)
    expect(copy.firstChild).toBe(text)
  })

  it.each(['a href="/updates"', 'button', 'div role="button"'])('keeps a long single-control message inside its %s boundary', control => {
    const tag = control.split(' ')[0]
    document.body.innerHTML = `<div id="owner" style="position:absolute"><div><${control} id="action"><svg aria-hidden="true"></svg><span>See 3 new or updated topics</span></${tag}></div></div>`
    const owner = document.getElementById('owner')!
    expect(isCompactTranslationTarget(owner)).toBe(false)
    const target = resolveBilingualControlTarget(owner)
    expect(target).toBe(document.getElementById('action'))
    expect(isCompactTranslationTarget(target)).toBe(true)
  })

  it.each([
    '<div>There are updates <a href="/updates">See the new topics</a></div>',
    '<div><a href="/updates">New topics</a><button>Dismiss</button></div>',
    '<div><a href="/updates">New topics</a><br></div>',
    '<div><p>A long paragraph without any actionable element stays a reading block.</p></div>',
    '<div><span translate="no"><a href="/private">Private</a></span></div>',
  ])('does not cross separate source or protected boundaries: %s', html => {
    document.body.innerHTML = html
    const owner = document.body.firstElementChild as HTMLElement
    expect(resolveBilingualControlTarget(owner)).toBe(owner)
  })

  it.each(['div', 'span', 'h2'])('treats an ordinary short %s label as inline copy without requiring a control ancestor', tag => {
    document.body.innerHTML = `<${tag} id="copy">Our Projects</${tag}>`
    expect(isCompactTranslationTarget(document.querySelector<HTMLElement>('#copy')!)).toBe(true)
  })

  it.each([
    '<div>One two three four five</div>',
    '<span>This title exceeds twenty-four characters</span>',
    '<div>First line<br>Second line</div>',
    '<div style="white-space:pre-line">First line\nSecond line</div>',
    '<div style="display:contents">Short title</div>',
    '<div><p>First paragraph</p><p>Second paragraph</p></div>',
  ])('keeps long copy and authored paragraph boundaries on the block path: %s', html => {
    document.body.innerHTML = html
    expect(isCompactTranslationTarget(document.body.firstElementChild as HTMLElement)).toBe(false)
  })

  it('collapses HTML formatting whitespace without treating it as an authored line break', () => {
    document.body.innerHTML = '<div>\n  <span>Our Projects</span>\n</div>'
    expect(isCompactTranslationTarget(document.body.firstElementChild as HTMLElement)).toBe(true)
  })

  it('puts a sidebar translation inside its label, retaining the icon and link as layout items', () => {
    // 来自 Ziggit 实际侧栏结构：外层 li 和链接均为 Flex，文字是内部 span。
    document.body.innerHTML = '<nav><li id="row" style="display:flex"><a href="/latest" style="display:flex"><span class="icon"><svg aria-hidden="true"><title>Decoration</title></svg></span><span id="label">Topics</span></a></li></nav>'
    const host = document.querySelector<HTMLElement>('#row')!
    const originalHTML = host.innerHTML
    const link = host.querySelector('a')!
    const target = prepareCompactBilingualTarget(host, host)
    expect(target).toBe(document.querySelector('#label'))
    expect(target.getAttribute(BILINGUAL_LABEL_ATTR)).toBe('true')
    expect(link.parentElement).toBe(host)
    expect(host.children.length).toBe(1)
    expect(host.style.display).toBe('flex')
    restoreAllBilingualLayouts()
    expect(host.innerHTML).toBe(originalHTML)
    expect(host.querySelector('a')).toBe(link)
  })

  it.each(['flex', 'grid'])('shares one %s item for a direct text label and its translation', display => {
    document.body.innerHTML = `<button id="target" style="display:${display}"><svg></svg>Save changes</button>`
    const host = document.querySelector<HTMLElement>('#target')!
    const original = host.innerHTML
    const text = host.lastChild!
    const icon = host.firstChild!
    const target = prepareCompactBilingualTarget(host, host)
    expect(target.parentElement).toBe(host)
    expect(target.firstChild).toBe(text)
    expect(host.firstChild).toBe(icon)
    expect(host.style.display).toBe(display)
    restoreAllBilingualLayouts()
    expect(host.innerHTML).toBe(original)
    expect(host.lastChild).toBe(text)
  })

  it('does not merge separate labels or move a label into a numeric badge', () => {
    document.body.innerHTML = '<button id="target" style="display:flex"><span>Notifications</span><span>12</span></button>'
    const host = document.querySelector<HTMLElement>('#target')!
    const children = Array.from(host.children)
    expect(prepareCompactBilingualTarget(host, host)).toBe(host)
    expect(Array.from(host.children)).toEqual(children)
  })

  it('does not unwrap a source node that the website has moved elsewhere', () => {
    document.body.innerHTML = '<button id="target" style="display:flex">Save changes</button><section></section>'
    const host = document.querySelector<HTMLElement>('#target')!
    const target = prepareCompactBilingualTarget(host, host)
    document.querySelector('section')!.appendChild(target)
    restoreAllBilingualLayouts()
    expect(target.parentElement?.tagName).toBe('SECTION')
    expect(target.textContent).toBe('Save changes')
    expect(target.hasAttribute(BILINGUAL_LABEL_ATTR)).toBe(false)
  })
})

describe('generic text height constraints', () => {
  it('releases a fixed title wrapper while leaving the card description and outer layout alone', () => {
    document.body.innerHTML = '<a style="display:grid;height:150px"><div id="title" style="height:24px;line-height:24px;font-size:16px;max-height:24px"><span id="label">Wikipedia</span></div><p>Description text</p></a>'
    const title = document.querySelector<HTMLElement>('#title')!
    const card = title.parentElement!
    const original = card.innerHTML
    prepareBilingualTextFlow(title, title.querySelector<HTMLElement>('#label')!)
    expect(title.style.height).toBe('auto')
    expect(title.style.minHeight).toBe('24px')
    expect(title.style.maxHeight).toBe('none')
    expect(card.style.height).toBe('150px')
    expect(card.style.display).toBe('grid')
    restoreAllBilingualLayouts()
    expect(card.innerHTML).toBe(original)
  })

  it('handles nested flex row heights without any website selectors', () => {
    document.body.innerHTML = '<nav><div id="owner"><a href="/docs" style="display:flex;height:36px;font-size:16px;line-height:24px"><svg aria-hidden="true"></svg><span id="label">Documentation</span></a></div></nav>'
    const owner = document.querySelector<HTMLElement>('#owner')!
    const link = owner.querySelector<HTMLElement>('a')!
    prepareBilingualTextFlow(owner, document.querySelector<HTMLElement>('#label')!)
    expect(link.style.height).toBe('auto')
    expect(link.style.minHeight).toBe('36px')
    expect(link.style.display).toBe('flex')
    restoreAllBilingualLayouts()
    expect(link.getAttribute('style')).toBe('display:flex;height:36px;font-size:16px;line-height:24px')
  })

  it.each([
    'height:600px;line-height:24px;font-size:16px',
    'height:24px;line-height:24px;overflow-y:auto',
    'height:24px;line-height:24px;position:absolute',
  ])('keeps large, scrollable and positioned containers constrained: %s', style => {
    document.body.innerHTML = `<div id="copy" style="${style}"><span id="label">Short title</span></div>`
    const host = document.querySelector<HTMLElement>('#copy')!
    prepareBilingualTextFlow(host, document.querySelector<HTMLElement>('#label')!)
    expect(host.getAttribute('style')).toBe(style)
  })

  it('does not release an outer media card even if its only readable text is a short label', () => {
    document.body.innerHTML = '<a id="card" style="height:100px;line-height:24px"><img src="cover.png"><span id="label">Short title</span></a>'
    const card = document.querySelector<HTMLElement>('#card')!
    prepareBilingualTextFlow(card, document.querySelector<HTMLElement>('#label')!)
    expect(card.style.height).toBe('100px')
  })

  it('normalizes nested owned styles back to the exact source attribute without mutating the live DOM', () => {
    document.body.innerHTML = '<div id="host"><span id="copy" style="height:24px;color:red">Short title</span></div>'
    const host = document.querySelector<HTMLElement>('#host')!
    const copy = host.querySelector<HTMLElement>('#copy')!
    const original = host.innerHTML
    setTranslationStyle(host, copy, 'height', 'auto')
    setTranslationStyle(host, copy, 'min-height', '24px')
    const clone = host.cloneNode(true) as HTMLElement
    normalizeBilingualSourceStyles(host, clone)
    expect(clone.innerHTML).toBe(original)
    expect(copy.style.height).toBe('auto')
    copy.style.color = 'blue'
    copy.style.height = '50px'
    const updated = host.cloneNode(true) as HTMLElement
    normalizeBilingualSourceStyles(host, updated)
    expect(updated.querySelector<HTMLElement>('#copy')!.style.height).toBe('50px')
    expect(updated.querySelector<HTMLElement>('#copy')!.style.color).toBe('blue')
    expect(updated.querySelector<HTMLElement>('#copy')!.style.minHeight).toBe('')
    restoreAllBilingualLayouts()
    expect(copy.style.height).toBe('50px')
    expect(copy.style.color).toBe('blue')
    expect(copy.style.minHeight).toBe('')
  })
})

describe('compound linked card flow', () => {
  const html = '<a href="/case"><div id="frame" style="display:flex;flex-direction:column;overflow:hidden;height:100%"><div id="head" style="display:flex;flex-direction:column;height:264px"><img src="logo.png"><div id="title" style="font-size:24px;line-height:32px">A customer story title</div></div><div id="foot" style="display:flex;height:110px"><div>100%<div id="description" style="font-size:18px;line-height:22px">Increase in daily active users</div></div></div></div></a>'

  it('releases compound sections independently while retaining the outer card height rule until the last owner restores', () => {
    document.body.innerHTML = html
    const original = document.body.innerHTML
    const frame = document.getElementById('frame')!
    const head = document.getElementById('head')!
    const foot = document.getElementById('foot')!
    const title = document.getElementById('title')!
    const description = document.getElementById('description')!
    prepareBilingualCardFlow(title, title)
    expect(head.style.height).toBe('auto')
    expect(head.style.minHeight).toBe('264px')
    expect(foot.style.height).toBe('110px')
    expect(frame.style.height).toBe('100%')
    expect(frame.style.minHeight).toBe('min-content')
    prepareBilingualCardFlow(description, description)
    expect(foot.style.height).toBe('auto')
    restoreBilingualLayout(title)
    expect(head.style.height).toBe('264px')
    expect(frame.style.minHeight).toBe('min-content')
    restoreBilingualLayout(description)
    expect(document.body.innerHTML).toBe(original)
  })

  it.each(['overflow-y:auto', 'position:absolute', 'flex-direction:row'])('keeps scrollable, positioned and non-column containers constrained: %s', constraint => {
    document.body.innerHTML = html
    const frame = document.getElementById('frame')!
    frame.style.cssText += ';' + constraint
    const original = document.body.innerHTML
    const title = document.getElementById('title')!
    prepareBilingualCardFlow(title, title)
    expect(document.body.innerHTML).toBe(original)
  })

  it('does not expand an unlinked page region or a card containing an editing control', () => {
    document.body.innerHTML = html
    const title = document.getElementById('title')!
    const frame = document.getElementById('frame')!
    frame.appendChild(document.createElement('textarea'))
    const original = document.body.innerHTML
    prepareBilingualCardFlow(title, title)
    expect(document.body.innerHTML).toBe(original)
    const link = frame.parentElement!
    link.replaceWith(frame)
    const unlinked = document.body.innerHTML
    prepareBilingualCardFlow(title, title)
    expect(document.body.innerHTML).toBe(unlinked)
  })

  it('retains shared style ownership and later website changes across independent restores', () => {
    document.body.innerHTML = html
    const frame = document.getElementById('frame')!
    const title = document.getElementById('title')!
    const description = document.getElementById('description')!
    const originalStyle = frame.getAttribute('style')
    for (const owner of [title, description]) {
      setTranslationStyle(owner, frame, 'height', 'auto')
      setTranslationStyle(owner, frame, 'min-height', 'min-content')
    }
    restoreBilingualLayout(description)
    expect(frame.style.height).toBe('auto')
    expect(frame.style.minHeight).toBe('min-content')
    restoreBilingualLayout(title)
    expect(frame.getAttribute('style')).toBe(originalStyle)
    for (const owner of [title, description]) setTranslationStyle(owner, frame, 'height', 'auto')
    frame.style.height = '600px'
    frame.style.color = 'blue'
    restoreAllBilingualLayouts()
    expect(frame.style.height).toBe('600px')
    expect(frame.style.color).toBe('blue')
  })
})

describe('bounded bilingual clipping and restoration', () => {
  it('preserves both languages with the same line limit inside an actual clipping ancestor', () => {
    document.body.innerHTML = '<section id="clip" style="display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical"><p id="copy">An original <a href="/story">story summary</a> with more content.</p></section>'
    const clip = document.querySelector<HTMLElement>('#clip')!
    const host = document.querySelector<HTMLElement>('#copy')!
    const link = host.querySelector('a')!
    const originalHTML = host.innerHTML
    const originalStyle = clip.style.cssText
    const insertion = document.createElement('span')
    const translation = document.createElement('span')
    translation.textContent = '摘要的中文翻译。'
    expect(prepareBilingualClipping(host, insertion, translation)).toBe(true)
    insertion.appendChild(translation)
    host.appendChild(insertion)
    expect(host.querySelector(`.${BILINGUAL_ORIGINAL_CLASS}`)?.textContent).toContain('An original')
    expect(host.querySelector('a')).toBe(link)
    expect(insertion.style.getPropertyValue('-webkit-line-clamp')).toBe('2')
    expect(clip.style.getPropertyValue('-webkit-line-clamp')).toBe('unset')
    insertion.remove()
    restoreAllBilingualLayouts()
    expect(host.innerHTML).toBe(originalHTML)
    expect(link.parentElement).toBe(host)
    expect(clip.style.cssText).toBe(originalStyle)
  })

  it('never changes an unrelated clipped layout that contains other content', () => {
    document.body.innerHTML = '<section style="-webkit-line-clamp:2;overflow:hidden"><h2>Separate title</h2><p id="copy">Summary content</p></section>'
    const host = document.querySelector<HTMLElement>('#copy')!
    expect(prepareBilingualClipping(host, document.createElement('span'), document.createElement('span'))).toBe(false)
    expect(host.querySelector(`.${BILINGUAL_ORIGINAL_CLASS}`)).toBeNull()
  })

  it('retains website style updates instead of restoring over them', () => {
    const host = document.createElement('p')
    host.style.display = 'flex'
    setTranslationStyle(host, host, 'display', 'block')
    host.style.display = 'grid'
    restoreAllBilingualLayouts()
    expect(host.style.display).toBe('grid')
  })
})
