import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/main/trans', () => ({
  handleBtnTranslation: vi.fn()
}))

import {
  getTranslatableHTML,
  getTranslatableText,
  getTranslatableTextWithProtectedInline,
  grabAllNode,
  grabNode,
  LLMStandardHTML,
  renderTextWithProtectedInline
} from '@/entrypoints/main/dom'
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

  it('preserves protected inline code when rendering translated text', () => {
    document.body.innerHTML = `
      <p id="intro"><strong>VS Code</strong> is mature. Run <code>code --install-extension Anthropic.claude-code</code>.</p>
    `

    const node = document.querySelector('#intro') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(node)
    const placeholder = result.protectedInlines[0].placeholder

    expect(result.text).toBe(`VS Code is mature. Run ${placeholder}.`)
    expect(result.text).not.toContain('code --install-extension')

    const fragment = renderTextWithProtectedInline(`VS Code 已成熟。运行 ${placeholder}。`, result.protectedInlines)
    const host = document.createElement('span')
    host.append(fragment as DocumentFragment)

    expect(host.innerHTML).toBe('VS Code 已成熟。运行 <code>code --install-extension Anthropic.claude-code</code>。')
  })

  it('returns null when protected inline placeholders are missing', () => {
    document.body.innerHTML = `
      <p id="intro">Run <code>npm install</code>.</p>
    `

    const node = document.querySelector('#intro') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(node)

    expect(renderTextWithProtectedInline('运行 npm install。', result.protectedInlines)).toBeNull()
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

  it('delegates first-line text translation through an injected callback', () => {
    document.body.innerHTML = `
      <div id="host">Intro text that belongs to the first line <div>metadata</div></div>
    `

    const calls: Array<{ textNode: Text; text: string }> = []
    const host = document.querySelector('#host') as HTMLElement
    const result = grabNode(host, {
      translateFirstLineText: (textNode, text) => {
        calls.push({ textNode, text })
      }
    })

    expect(result).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0].text).toBe('Intro text that belongs to the first line ')
    expect(calls[0].textNode.nodeType).toBe(Node.TEXT_NODE)
  })

  it('does not treat short readable identifiers as user names', () => {
    document.body.innerHTML = `
      <article>
        <h2 id="web3">web3</h2>
        <h2 id="step">step_2</h2>
        <h2 id="act">act_1</h2>
      </article>
    `

    const web3 = document.querySelector('#web3') as HTMLElement
    const step = document.querySelector('#step') as HTMLElement
    const act = document.querySelector('#act') as HTMLElement

    expect(grabNode(web3)).toBe(web3)
    expect(grabNode(step)).toBe(step)
    expect(grabNode(act)).toBe(act)
  })

  it('continues after a selected paragraph that contains multiple inline links', () => {
    document.body.innerHTML = `
      <article>
        <p id="previous">
          We do not have access to the internals of companies.
          Like this supposed <a href="/aws-outage">AI caused outage at AWS</a>.
          Which AWS immediately <a href="/corrected">corrected</a>.
          Only to then follow up internally with a <a href="/reset">90-day reset</a>.
        </p>
        <p id="middle">
          Satya Nadella, the CEO of Microsoft, has been going on about
          <a href="/ai-code">how much code is now being written by AI</a>
          at Microsoft. While we do not have direct evidence, there sure is a feeling that Windows is struggling.
          Microsoft itself seems to agree, based on this fine <a href="/blog-post">blog post</a>.
        </p>
        <p id="after">Companies claiming that all product code is written by AI keep shipping rough software.</p>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).toContain('previous')
    expect(ids).toContain('middle')
    expect(ids).toContain('after')
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
