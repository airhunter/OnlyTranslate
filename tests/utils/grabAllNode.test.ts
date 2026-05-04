import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/main/trans', () => ({
  handleBtnTranslation: vi.fn()
}))

import { getTranslatableHTML, getTranslatableText, grabAllNode, LLMStandardHTML } from '@/entrypoints/main/dom'

describe('grabAllNode', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps default behavior when no subtree filter is provided', () => {
    document.body.innerHTML = `
      <article>
        <p id="keep">Readable article paragraph.</p>
        <section id="skip">
          <p id="also-keep">Promotional paragraph.</p>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).toContain('keep')
    expect(ids).toContain('also-keep')
  })

  it('rejects all text nodes inside a skipped subtree', () => {
    document.body.innerHTML = `
      <article>
        <p id="keep">Readable article paragraph.</p>
        <section id="skip">
          <p id="promo">Promotional paragraph.</p>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body, {
      shouldSkipSubtree: (element) => element.id === 'skip'
    }).map((node) => node.id)

    expect(ids).toContain('keep')
    expect(ids).not.toContain('promo')
  })

  it('excludes script source when extracting translatable text and html', () => {
    document.body.innerHTML = `
      <h1 id="year">1989 - <script>document.write(new Date().getFullYear())</script>2026</h1>
    `

    const node = document.querySelector('#year') as HTMLElement

    expect(getTranslatableText(node)).toBe('1989 - 2026')
    expect(getTranslatableHTML(node)).toBe('1989 - 2026')
    expect(LLMStandardHTML(node)).toBe('1989 - 2026')
  })

  it('does not select date-only nodes because of script source text', () => {
    document.body.innerHTML = `
      <article>
        <h1 id="year">1989 - <script>document.write(new Date().getFullYear())</script>2026</h1>
        <p id="intro">This readable paragraph should still be translated.</p>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).not.toContain('year')
    expect(ids).toContain('intro')
  })
})
