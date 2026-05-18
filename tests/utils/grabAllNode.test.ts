import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/main/trans', () => ({
  handleBtnTranslation: vi.fn()
}))

import { getTranslatableHTML, getTranslatableText, grabAllNode, LLMStandardHTML } from '@/entrypoints/main/dom'
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter'

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

  it('does not leak generic descendants from skip-self blocks', () => {
    document.body.innerHTML = `
      <section>
        <p id="body">This readable paragraph sits inside a mixed container with enough text to translate safely.</p>
        <a id="share" href="/share">Share</a>
      </section>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: (element) => element.tagName.toLowerCase() === 'section' ? 'skip-self' : 'keep'
    }).map((node) => node.id)

    expect(ids).not.toContain('body')
    expect(ids).not.toContain('share')
  })

  it('keeps site-profile content inside skip-self containers', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.reddit.com/r/digitalnomad/comments/1t3d0e0/china/'),
      configurable: true
    })
    document.body.innerHTML = `
      <shreddit-post id="post">
        <h1 id="post-title" slot="title">China</h1>
        <div id="post-body" slot="text-body" data-post-click-location="text-body">
          Considering spending a month in China. Wondering how much of a headache it is to work there.
        </div>
        <button id="share">Share</button>
      </shreddit-post>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: (element) => element.tagName.toLowerCase() === 'shreddit-post' ? 'skip-self' : 'keep',
      siteCompatMode: 'smart'
    }).map((node) => node.id)

    expect(ids).toContain('post-title')
    expect(ids).toContain('post-body')
    expect(ids).not.toContain('share')
  })

  it('skips TDS-like footer author, tags, share, and CTA descendants in smart filtering', () => {
    document.body.innerHTML = `
      <article>
        <p id="article-body">This paragraph is part of the actual article body. It has enough detail, context, and natural language to look like readable long-form content.</p>
        <section class="author-card">
          <p>WRITTEN BY</p>
          <h2>Ibrahim Salami</h2>
          <a href="/author/ibrahim-salami">See all from Ibrahim Salami</a>
        </section>
        <section class="post-topics">
          <a id="tag-data" href="/tag/data-science">Data Science</a>
          <a id="tag-pandas" href="/tag/pandas">Pandas</a>
          <a id="tag-productivity" href="/tag/productivity">Productivity</a>
          <a id="tag-python" href="/tag/python">Python</a>
        </section>
        <section class="share-this-article">
          <h2 id="share-title">Share This Article</h2>
          <a id="share-facebook" href="https://www.facebook.com/sharer/sharer.php">Share on Facebook</a>
          <a id="share-linkedin" href="https://www.linkedin.com/shareArticle">Share on LinkedIn</a>
          <a id="share-x" href="https://x.com/intent/tweet">Share to X</a>
        </section>
        <section class="author-social-links">
          <a id="social-medium" href="https://medium.com/@ibrahim-salami">Medium</a>
          <a id="social-linkedin" href="https://www.linkedin.com/in/ibrahim-salami">LinkedIn</a>
          <a id="social-twitter" href="https://twitter.com/ibrahim_salami">Twitter</a>
          <a id="social-youtube" href="https://www.youtube.com/@ibrahimsalami">YouTube</a>
        </section>
        <section class="author-program-promo">
          <p id="promo-text">Towards Data Science is a community publication. Submit your insights to reach our global audience and earn through the TDS Author Payment Program.</p>
          <a id="promo-button" href="/write-for-us">Write for TDS</a>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: getContentFilterDecision
    }).map((node) => node.id)

    expect(ids).toContain('article-body')
    expect(ids).not.toContain('tag-data')
    expect(ids).not.toContain('share-title')
    expect(ids).not.toContain('share-facebook')
    expect(ids).not.toContain('social-medium')
    expect(ids).not.toContain('social-youtube')
    expect(ids).not.toContain('promo-text')
    expect(ids).not.toContain('promo-button')
  })
})
