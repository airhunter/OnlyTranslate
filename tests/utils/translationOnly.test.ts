import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTranslationOnly,
  hasTranslationOnlyRecord,
  prepareTranslationOnly,
  withTranslationOnlyLineSeparators,
  restoreAllTranslationOnly,
  restoreTranslationOnly,
} from '@/entrypoints/main/translationOnly'

const translateDocs = (source: string) => source
  .replace(/ (__ONLY_TRANSLATE_SLOT_\d+__) /g, '$1')
  .replace('Read ', '阅读')
  .replace('the docs', '文档')
  .replace(/\.$/, '。')

describe('translation-only in-place text', () => {
  beforeEach(() => {
    restoreAllTranslationOnly()
    document.body.innerHTML = ''
  })

  it('keeps nested links clickable during translation and restores the same text and element nodes', () => {
    document.body.innerHTML = '<p id="target">Read <a href="/docs" title="Documentation"><strong>the docs</strong></a>.</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const originalHTML = target.innerHTML
    const nodes = Array.from(target.querySelectorAll('*'))
    const link = target.querySelector('a')!
    const label = link.querySelector('strong')!.firstChild
    const listener = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', listener)
    const prepared = prepareTranslationOnly(target)

    expect(applyTranslationOnly(prepared, translateDocs(prepared.text))).toBe(true)
    expect(hasTranslationOnlyRecord(target)).toBe(true)
    expect(target.textContent).toBe('阅读文档。')
    expect(Array.from(target.querySelectorAll('*'))).toEqual(nodes)
    expect(link.getAttribute('href')).toBe('/docs')
    expect(link.getAttribute('title')).toBe('Documentation')
    expect(link.querySelector('strong')!.firstChild).toBe(label)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(listener).toHaveBeenCalledTimes(1)

    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe(originalHTML)
    expect(target.querySelector('a')).toBe(link)
    expect(link.querySelector('strong')!.firstChild).toBe(label)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('preserves a linked title when its parent is the translation target', () => {
    document.body.innerHTML = '<span role="heading" id="target"><a class="title" href="/t/topic/18027">Read the docs.</a></span>'
    const target = document.querySelector<HTMLElement>('#target')!
    const link = target.querySelector('a')!
    const prepared = prepareTranslationOnly(target)

    expect(prepared.text).toBe('Read the docs.')
    expect(applyTranslationOnly(prepared, '阅读文档。')).toBe(true)
    expect(target.querySelector('a')).toBe(link)
    expect(link.textContent).toBe('阅读文档。')
    expect(link.getAttribute('href')).toBe('/t/topic/18027')
  })

  it('retains every original citation link in a paragraph with many inline references', () => {
    document.body.innerHTML = `<p id="target">${Array.from({ length: 58 }, (_, index) =>
      `See <a href="/reference/${index}">Reference ${index}</a>. `).join('')}</p>`
    const target = document.querySelector<HTMLElement>('#target')!
    const originalHTML = target.innerHTML
    const links = Array.from(target.querySelectorAll('a'))
    const hrefs = links.map(link => link.getAttribute('href'))
    const prepared = prepareTranslationOnly(target)

    expect(applyTranslationOnly(prepared, prepared.text.replaceAll('See ', '参见').replaceAll('Reference ', '文献'))).toBe(true)
    expect(Array.from(target.querySelectorAll('a'))).toEqual(links)
    expect(links.map(link => link.getAttribute('href'))).toEqual(hrefs)
    expect(links.every(link => link.textContent?.trimStart().startsWith('文献'))).toBe(true)
    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe(originalHTML)
    expect(Array.from(target.querySelectorAll('a'))).toEqual(links)
  })

  it('accepts a real Google response that folds a sentence prefix into a citation label', () => {
    document.body.innerHTML = '<p id="target">One of the earliest empirical studies by <a href="/paper">Hestness et al. (2017)</a> explained the relationship.</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const link = target.querySelector('a')!
    const originalHTML = target.innerHTML
    const listener = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', listener)
    const translated = '__ONLY_TRANSLATE_SLOT_0__Hestness 等人最早的实证研究之一。 (2017)__ONLY_TRANSLATE_SLOT_1__解释了这种关系。'

    expect(applyTranslationOnly(prepareTranslationOnly(target), translated)).toBe(true)
    expect(target.textContent).toBe('Hestness 等人最早的实证研究之一。 (2017)解释了这种关系。')
    expect(target.querySelector('a')).toBe(link)
    link.click()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe(originalHTML)
  })

  it('allows emphasis text to join adjacent translated prose without deleting the emphasis node', () => {
    document.body.innerHTML = '<p id="target">Stop <em>before convergence</em> rather than training longer.</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const emphasis = target.querySelector('em')!
    const label = emphasis.firstChild
    const originalHTML = target.innerHTML

    expect(applyTranslationOnly(prepareTranslationOnly(target), '在收敛之前停止__ONLY_TRANSLATE_SLOT_0____ONLY_TRANSLATE_SLOT_1__，而不是继续训练。')).toBe(true)
    expect(target.textContent).toBe('在收敛之前停止，而不是继续训练。')
    expect(target.querySelector('em')).toBe(emphasis)
    expect(emphasis.firstChild).toBe(label)
    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe(originalHTML)
  })

  it('validates the complete button label rather than requiring every child text to be nonempty', () => {
    document.body.innerHTML = '<button id="target">Show <strong>details</strong></button>'
    const target = document.querySelector<HTMLElement>('#target')!
    const strong = target.querySelector('strong')!
    const prepared = withTranslationOnlyLineSeparators(prepareTranslationOnly(target))
    expect(prepared.text).toBe('Show \n__ONLY_TRANSLATE_SLOT_0__\ndetails')
    expect(applyTranslationOnly(prepared, '显示详细信息\n__ONLY_TRANSLATE_SLOT_0__\n')).toBe(true)
    expect(target.textContent).toBe('显示详细信息')
    expect(target.querySelector('strong')).toBe(strong)
    restoreTranslationOnly(target)
    expect(target.textContent).toBe('Show details')
  })

  it('does not allow one control label to be moved entirely into another control', () => {
    document.body.innerHTML = '<div id="target"><button>Show details</button><button>Close panel</button></div>'
    const target = document.querySelector<HTMLElement>('#target')!
    const originalHTML = target.innerHTML
    expect(applyTranslationOnly(prepareTranslationOnly(target), '显示详细信息并关闭面板\n__ONLY_TRANSLATE_SLOT_0__\n')).toBe(false)
    expect(target.innerHTML).toBe(originalHTML)
  })

  it('rejects a result that preserves markers but clears all prose', () => {
    document.body.innerHTML = '<p id="target">Stop <em>before convergence</em> rather than training longer.</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const originalHTML = target.innerHTML
    expect(applyTranslationOnly(prepareTranslationOnly(target), '__ONLY_TRANSLATE_SLOT_0____ONLY_TRANSLATE_SLOT_1__')).toBe(false)
    expect(target.innerHTML).toBe(originalHTML)
  })

  it('removes only framing line breaks while retaining authored whitespace and translated spacing', () => {
    document.body.innerHTML = '<p id="target">  Read <a href="/docs">the docs</a>.\n</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const originalHTML = target.innerHTML
    const prepared = withTranslationOnlyLineSeparators(prepareTranslationOnly(target))
    expect(applyTranslationOnly(prepared, prepared.text.replace('Read ', '阅读 ').replace('the docs', '文档'))).toBe(true)
    expect(target.textContent).toBe('  阅读 文档.\n')
    restoreTranslationOnly(target)
    expect(target.innerHTML).toBe(originalHTML)
  })

  it('preserves buttons, focus, editable content, control state, code and formulas', () => {
    document.body.innerHTML = '<div id="target"><button type="button"><span>Read the docs.</span></button><input value="initial"><input type="checkbox"><select><option>First</option><option>Second</option></select><textarea>draft</textarea><span contenteditable="true">private draft</span><code id="command">npm install</code><math id="formula"><mi>x</mi></math></div>'
    const target = document.querySelector<HTMLElement>('#target')!
    const originalNodes = Array.from(target.querySelectorAll('*'))
    const button = target.querySelector('button')!
    const input = target.querySelector('input')!
    const checkbox = target.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    const select = target.querySelector('select')!
    const textarea = target.querySelector('textarea')!
    input.value = 'typed by user'
    checkbox.checked = true
    select.selectedIndex = 1
    textarea.value = 'current draft'
    input.focus()
    const listener = vi.fn()
    button.addEventListener('click', listener)
    const prepared = prepareTranslationOnly(target)
    input.value = 'newer input while pending'

    expect(prepared.text).not.toMatch(/private draft|current draft|initial|First|npm install/)
    expect(applyTranslationOnly(prepared, prepared.text.replace('Read the docs.', '阅读文档。'))).toBe(true)
    expect(button.textContent?.trim()).toBe('阅读文档。')
    expect(Array.from(target.querySelectorAll('*'))).toEqual(originalNodes)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('newer input while pending')
    expect(checkbox.checked).toBe(true)
    expect(select.selectedIndex).toBe(1)
    expect(textarea.value).toBe('current draft')
    expect(target.querySelector('[contenteditable]')!.textContent).toBe('private draft')
    expect(target.querySelector('#command')!.textContent).toBe('npm install')
    expect(target.querySelector('#formula')!.textContent).toBe('x')
    button.click()
    expect(listener).toHaveBeenCalledTimes(1)

    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(Array.from(target.querySelectorAll('*'))).toEqual(originalNodes)
    expect(button.textContent).toBe('Read the docs.')
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('newer input while pending')
    expect(checkbox.checked).toBe(true)
    expect(select.selectedIndex).toBe(1)
    expect(textarea.value).toBe('current draft')
  })

  it.each(['missing', 'duplicate', 'reordered', 'empty-link', 'unknown', 'altered-protected'])(
    'rejects %s structure without partially changing the DOM', kind => {
      document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.<code>npm install</code></p>'
      const target = document.querySelector<HTMLElement>('#target')!
      const originalHTML = target.innerHTML
      const link = target.querySelector('a')!
      const prepared = prepareTranslationOnly(target)
      const markers = prepared.text.match(/__ONLY_TRANSLATE_SLOT_\d+__/g)!
      let translated = translateDocs(prepared.text)
      if (kind === 'missing') translated = translated.replace(markers[0]!, '')
      if (kind === 'duplicate') translated += markers[0]
      if (kind === 'reordered') translated = translated.replace(markers[0]!, 'TEMP').replace(markers[1]!, markers[0]!).replace('TEMP', markers[1]!)
      if (kind === 'empty-link') translated = translated.replace('文档', '')
      if (kind === 'unknown') translated += '__ONLY_TRANSLATE_SLOT_999__'
      if (kind === 'altered-protected') translated = translated.replace(/__ONLY_TRANSLATE_INLINE_\d+_[a-z0-9]+__/, '安装命令')

      expect(applyTranslationOnly(prepared, translated)).toBe(false)
      expect(target.innerHTML).toBe(originalHTML)
      expect(target.querySelector('a')).toBe(link)
      expect(hasTranslationOnlyRecord(target)).toBe(false)
    }
  )

  it.each(['text', 'href', 'identical-node-replacement'])(
    'does not apply a pending translation after a %s update', kind => {
      document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.</p>'
      const target = document.querySelector<HTMLElement>('#target')!
      const prepared = prepareTranslationOnly(target)
      if (kind === 'text') target.firstChild!.textContent = 'Updated by host '
      if (kind === 'href') target.querySelector('a')!.href = '/new'
      if (kind === 'identical-node-replacement') target.querySelector('a')!.replaceWith(target.querySelector('a')!.cloneNode(true))
      const updatedHTML = target.innerHTML

      expect(applyTranslationOnly(prepared, translateDocs(prepared.text))).toBe(false)
      expect(target.innerHTML).toBe(updatedHTML)
    }
  )

  it('restores only text still owned by the extension after a partial website update', () => {
    document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.</p>'
    const target = document.querySelector<HTMLElement>('#target')!
    const prepared = prepareTranslationOnly(target)
    expect(applyTranslationOnly(prepared, translateDocs(prepared.text))).toBe(true)
    target.querySelector('a')!.firstChild!.textContent = 'New live label'
    target.querySelector('a')!.setAttribute('href', '/new')

    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe('Read <a href="/new">New live label</a>.')
  })

  it('does not overwrite a replaced host or a moved text node on restore', () => {
    document.body.innerHTML = '<p id="target">Original content</p><p id="destination"></p>'
    const target = document.querySelector<HTMLElement>('#target')!
    expect(applyTranslationOnly(prepareTranslationOnly(target), '译文')).toBe(true)
    const translatedText = target.firstChild!
    document.querySelector('#destination')!.appendChild(translatedText)
    target.innerHTML = '<strong>Updated by host</strong>'

    expect(restoreTranslationOnly(target)).toBe('discarded')
    expect(target.innerHTML).toBe('<strong>Updated by host</strong>')
    expect(translatedText.textContent).toBe('译文')
  })

  it('treats returned HTML as literal text rather than creating nodes or attributes', () => {
    document.body.innerHTML = '<a id="target" href="/docs">Read the docs.</a>'
    const target = document.querySelector<HTMLElement>('#target')!
    expect(applyTranslationOnly(prepareTranslationOnly(target), '<img src=x onerror=alert(1)>')).toBe(true)
    expect(target.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(target.children).toHaveLength(0)
    expect(target.getAttribute('href')).toBe('/docs')
  })
})
