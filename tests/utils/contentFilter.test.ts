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

  it('skips TDS-like social profile links even when the block has no share label', () => {
    const element = renderElement(`
      <section class="author-social-links">
        <a href="https://medium.com/@author">Medium</a>
        <a href="https://www.linkedin.com/in/author">LinkedIn</a>
        <a href="https://twitter.com/author">Twitter</a>
        <a href="https://www.youtube.com/@author">YouTube</a>
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

  it('skips a TDS-like author card', () => {
    const element = renderElement(`
      <section class="author-card">
        <p>WRITTEN BY</p>
        <h2>Ibrahim Salami</h2>
        <a href="/author/ibrahim-salami">See all from Ibrahim Salami</a>
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

  it('keeps article paragraphs that mention code being written by AI', () => {
    const element = renderElement(`
      <p>
        Satya Nadella, the CEO of Microsoft, has been going on about
        <a href="https://techcrunch.com/2025/04/29/microsoft-ceo-says-up-to-30-of-the-companys-code-was-written-by-ai/">how much code is now being written by AI</a>
        at Microsoft. While we do not have direct evidence, there sure is a feeling that Windows is struggling.
        Microsoft itself seems to agree, based on this fine <a href="https://blogs.windows.com/windowsexperience/2026/03/24/improving-the-windows-11-experience/">blog post</a>.
      </p>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('keeps readable article paragraphs that mention a popular linked subject', () => {
    const element = renderElement(`
      <p>
        Expansion artifacts get genuinely dangerous when they compound, when one AI generation becomes the input to another.
        In February, an autonomous openclaw agent
        <a href="https://theshamblog.com/an-ai-agent-published-a-hit-piece-on-me/">published a hit piece on Scott Shambaugh</a>,
        a maintainer of the popular matplotlib Python library, for rejecting its code. Benj Edwards then reported the story
        for Ars Technica; unsurprisingly,
        <a href="https://theshamblog.com/an-ai-agent-published-a-hit-piece-on-me-part-2/">his article contained hallucinated quotes</a>.
      </p>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('keeps paragraph-like divs that contain only text and inline links', () => {
    const element = renderElement(`
      <div>
        <span>Many Chinese companies offer coding plans, often with generous token limits to attract customers away from Claude Code, but companies have also pursued more niche product directions. MiniMax builds highly lucrative </span>
        <a href="https://example.com/ai-companion">AI companion products</a>
        <span>, while Z.ai has sought out B2B partnerships with social media companies and Comac, China's commercial aircraft manufacturer, as well as contracts with government entities.</span>
      </div>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('keeps article containers whose readable paragraphs are inline-only divs', () => {
    const element = renderElement(`
      <article>
        <h1>Inline Block Paragraphs</h1>
        <div>
          This article uses block elements as paragraphs because some rendering pipelines preserve visual layout with generic divs rather than semantic paragraph tags.
        </div>
        <div>
          <span>Many product teams publish long-form reports as text fragments wrapped by inline elements. The paragraph can mention </span>
          <a href="https://example.com/social-distribution">social media distribution</a>
          <span>, partner links, product names, and citations while still being one coherent readable article paragraph.</span>
        </div>
        <section class="share-this-article">
          <h2>Share This Article</h2>
          <a href="https://www.facebook.com/sharer/sharer.php">Share to Facebook</a>
        </section>
      </article>
    `)

    expect(shouldSkipContentBlock(element)).toBe(false)
    expect(getContentFilterDecision(element)).toBe('keep')
  })

  it('still skips structurally marked popular article modules', () => {
    const element = renderElement(`
      <section class="popular-articles">
        <h2>Popular articles</h2>
        <a href="/writing/design-from-the-inside/">Design from the inside</a>
        <a href="/writing/decentralizing-quality/">Decentralizing quality</a>
      </section>
    `)

    expect(shouldSkipContentBlock(element)).toBe(true)
    expect(getContentFilterDecision(element)).toBe('skip-self')
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

  it('keeps technical source links to GitHub as readable content', () => {
    const element = renderElement(`
      <section class="project-source">
        <a href="https://github.com/airhunter/OnlyTranslate">GitHub repository</a>
        <p>Read the source code and installation notes before changing the extension build pipeline.</p>
      </section>
    `)

    expect(getContentFilterDecision(element)).toBe('keep')
    expect(shouldSkipContentBlock(element)).toBe(false)
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
