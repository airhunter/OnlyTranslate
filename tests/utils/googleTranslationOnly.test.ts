import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyGoogleTranslationOnlyHtml,
  prepareGoogleTranslationOnlyHtml,
  restoreGoogleTranslationOnly,
} from '@/entrypoints/main/googleTranslationOnly'

function translatePreparedHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const root = template.content.firstElementChild as HTMLElement
  const link = root.querySelector('a')!
  const code = root.querySelector('code')!

  ;(root.firstChild as Text).data = '阅读 '
  link.textContent = '文档'
  code.textContent = '不应写回'
  ;(root.lastChild as Text).data = ' 了解详情。'
  return template.innerHTML
}

describe('Google translation-only DOM mapping', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('updates existing text nodes while preserving links, attributes, listeners, and protected code', () => {
    document.body.innerHTML = '<p id="target">Read <a href="/docs" title="Documentation">the docs</a><code>npm install</code> for details.</p>'
    const target = document.querySelector('#target') as HTMLElement
    const link = target.querySelector('a')!
    const code = target.querySelector('code')!
    const listener = () => undefined
    link.addEventListener('click', listener)

    const prepared = prepareGoogleTranslationOnlyHtml(target)
    expect(prepared.html).not.toContain('href=')
    expect(prepared.html).not.toContain('title=')
    expect(prepared.html).toContain('translate="no"')

    expect(applyGoogleTranslationOnlyHtml(prepared, translatePreparedHtml(prepared.html))).toBe(true)
    expect(target.querySelector('a')).toBe(link)
    expect(target.querySelector('code')).toBe(code)
    expect(link.getAttribute('href')).toBe('/docs')
    expect(link.getAttribute('title')).toBe('Documentation')
    expect(link.textContent).toBe('文档')
    expect(code.textContent).toBe('npm install')
    expect(target.textContent).toBe('阅读 文档npm install 了解详情。')

    expect(restoreGoogleTranslationOnly(target)).toBe(true)
    expect(target.querySelector('a')).toBe(link)
    expect(target.querySelector('code')).toBe(code)
    expect(target.innerHTML).toBe('Read <a href="/docs" title="Documentation">the docs</a><code>npm install</code> for details.')

    link.removeEventListener('click', listener)
  })

  it('rejects responses whose element markers no longer match', () => {
    document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.</p>'
    const target = document.querySelector('#target') as HTMLElement
    const prepared = prepareGoogleTranslationOnlyHtml(target)
    const template = document.createElement('template')
    template.innerHTML = prepared.html.replace('Read ', '阅读 ').replace('the docs', '文档')
    template.content.querySelector('[data-onlytranslate-google-slot]')?.removeAttribute('data-onlytranslate-google-slot')

    expect(applyGoogleTranslationOnlyHtml(prepared, template.innerHTML)).toBe(false)
    expect(target.textContent).toBe('Read the docs.')
  })

  it('does not overwrite content changed by the host while translation is pending', () => {
    document.body.innerHTML = '<p id="target">Original text</p>'
    const target = document.querySelector('#target') as HTMLElement
    const prepared = prepareGoogleTranslationOnlyHtml(target)
    target.firstChild!.textContent = 'Updated by host'

    const translated = prepared.html.replace('Original text', '译文')
    expect(applyGoogleTranslationOnlyHtml(prepared, translated)).toBe(false)
    expect(target.textContent).toBe('Updated by host')
  })
})
