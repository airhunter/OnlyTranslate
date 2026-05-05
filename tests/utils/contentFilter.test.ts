import { beforeEach, describe, expect, it } from 'vitest'
import { getContentFilterDecision, shouldSkipContentBlock } from '@/entrypoints/utils/contentFilter'

const articleParagraph = 'This paragraph is part of the actual article body. It has enough detail, context, and natural language to look like readable long-form content.'

describe('shouldSkipContentBlock', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  function renderElement(html: string): Element {
    document.body.innerHTML = html
    const element = document.body.firstElementChild
    if (!element) throw new Error('Expected fixture element')
    return element
  }

  it('skips a TDS-like tag cluster', () => {
    const element = renderElement(`
      <section class="post-topics">
        <a href="/tag/data-science">Data Science</a>
        <a href="/tag/pandas">Pandas</a>
        <a href="/tag/productivity">Productivity</a>
        <a href="/tag/python">Python</a>
        <a href="/tag/vectorization">Vectorization</a>
      </section>
    `)

    expect(shouldSkipContentBlock(element)).toBe(true)
    expect(getContentFilterDecision(element)).toBe('skip-self')
  })

  it('skips a TDS-like share block', () => {
    const element = renderElement(`
      <section class="share-this-article">
        <h2>Share This Article</h2>
        <a href="https://www.facebook.com/sharer/sharer.php">Share to Facebook</a>
        <a href="https://www.linkedin.com/shareArticle">Share to LinkedIn</a>
        <a href="https://x.com/intent/tweet">Share to X</a>
      </section>
    `)

    expect(shouldSkipContentBlock(element)).toBe(true)
    expect(getContentFilterDecision(element)).toBe('skip-self')
  })

  it('skips a TDS-like promotional CTA', () => {
    const element = renderElement(`
      <section class="author-program-promo">
        <p>Towards Data Science is a community publication. Submit your insights to reach our global audience and earn through the TDS Author Payment Program.</p>
        <a href="/write-for-us">Write for TDS</a>
      </section>
    `)

    expect(shouldSkipContentBlock(element)).toBe(true)
    expect(getContentFilterDecision(element)).toBe('skip-self')
  })

  it('keeps normal article content', () => {
    const element = renderElement(`
      <section class="article-content">
        <h1>Readable Article Title</h1>
        <p>${articleParagraph}</p>
        <p>${articleParagraph}</p>
        <figcaption>A chart showing the runtime reduction across several implementations.</figcaption>
      </section>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('keeps GitHub README-like documentation content', () => {
    const element = renderElement(`
      <article class="markdown-body">
        <h1>Project README</h1>
        <p>${articleParagraph}</p>
        <pre><code>pnpm install</code></pre>
        <table><tbody><tr><td>Option</td><td>Description</td></tr></tbody></table>
      </article>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('only skips the mixed block itself when it contains share actions', () => {
    const element = renderElement(`
      <shreddit-post>
        <h1 slot="title">China</h1>
        <div slot="text-body" data-post-click-location="text-body">
          Considering spending a month in China. Wondering how much of a headache it is to work there.
        </div>
        <button>Share</button>
      </shreddit-post>
    `)

    expect(shouldSkipContentBlock(element)).toBe(true)
    expect(getContentFilterDecision(element)).toBe('skip-self')
  })

  it('rejects semantic noise subtrees', () => {
    const element = renderElement(`
      <aside>
        <p>${articleParagraph}</p>
      </aside>
    `)

    expect(getContentFilterDecision(element)).toBe('skip-subtree')
  })
})
