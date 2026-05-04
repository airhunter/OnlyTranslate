import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/main/trans', () => ({
  handleBtnTranslation: vi.fn()
}))

import { grabAllNode } from '@/entrypoints/main/dom'

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
})
