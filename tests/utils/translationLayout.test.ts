import { afterEach, describe, expect, it } from 'vitest'
import { BILINGUAL_LABEL_ATTR, BILINGUAL_ORIGINAL_CLASS, prepareCompactBilingualTarget, prepareBilingualClipping, restoreAllBilingualLayouts, setTranslationStyle } from '@/entrypoints/main/translationLayout'

afterEach(() => { restoreAllBilingualLayouts(); document.body.innerHTML = '' })

describe('compact bilingual insertion boundaries', () => {
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
