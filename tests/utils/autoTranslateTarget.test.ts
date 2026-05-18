import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/utils/config', () => ({
  config: {
    translationScope: 'smart'
  }
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  translateText: vi.fn()
}))

vi.mock('@/entrypoints/utils/icon', () => ({
  insertFailedTip: vi.fn(),
  insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() }))
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

import { collectDynamicTranslationNodes, handleBilingualTranslation, resolveAutoTranslateTarget } from '@/entrypoints/main/trans'
import { translateText } from '@/entrypoints/utils/translateApi'

describe('resolveAutoTranslateTarget', () => {
  const originalLocation = window.location

  beforeEach(() => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    })
  })

  it('falls back to unfiltered root nodes when smart filtering removes every node', () => {
    document.body.innerHTML = `
      <main>
        <section class="post-topics">
          <a id="topic-1" href="/tag/world-news">Global markets move after central bank announcement</a>
          <a id="topic-2" href="/tag/business-news">Business leaders respond to new economic data</a>
          <a id="topic-3" href="/tag/technology-news">Technology companies prepare for regulatory changes</a>
        </section>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const translatedText = target.nodes.map((node) => node.textContent).join(' ')

    expect(translatedText).toContain('Global markets move')
    expect(translatedText).toContain('Business leaders respond')
    expect(translatedText).toContain('Technology companies prepare')
    expect(target.grabOptions?.shouldSkipSubtree).toBeUndefined()
    expect(target.grabOptions?.siteCompatMode).toBe('full')
  })

  it('keeps strict filtering when smart mode finds readable content', () => {
    document.body.innerHTML = `
      <main>
        <article>
          <h1 id="title">Readable story</h1>
          <p id="paragraph">This is a readable article paragraph with enough length to survive the smart content filter and become a translation target.</p>
        </article>
        <section class="post-topics">
          <a id="topic-1" href="/tag/world">World</a>
          <a id="topic-2" href="/tag/business">Business</a>
          <a id="topic-3" href="/tag/tech">Tech</a>
        </section>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('paragraph')
    expect(ids).not.toContain('topic-1')
    expect(target.grabOptions).toBeDefined()
  })

  it('does not enable smart filtering in full mode', () => {
    document.body.innerHTML = `
      <main>
        <section class="post-topics">
          <a id="topic-1" href="/tag/world-news">Global markets move after central bank announcement</a>
          <a id="topic-2" href="/tag/business-news">Business leaders respond to new economic data</a>
          <a id="topic-3" href="/tag/technology-news">Technology companies prepare for regulatory changes</a>
        </section>
      </main>
    `

    const target = resolveAutoTranslateTarget('full')
    const translatedText = target.nodes.map((node) => node.textContent).join(' ')

    expect(translatedText).toContain('Global markets move')
    expect(translatedText).toContain('Business leaders respond')
    expect(translatedText).toContain('Technology companies prepare')
    expect(target.grabOptions?.shouldSkipSubtree).toBeUndefined()
    expect(target.grabOptions?.siteCompatMode).toBe('full')
  })

  it('keeps Reddit post and comment bodies in smart mode', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.reddit.com/r/digitalnomad/comments/1t3d0e0/china/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <shreddit-post>
          <h1 id="post-title" slot="title">China</h1>
          <div id="post-body" slot="text-body" data-post-click-location="text-body">
            Considering spending a month in China. Wondering how much of a headache it is to work there.
          </div>
          <button>Share</button>
        </shreddit-post>
        <shreddit-comment>
          <div id="comment-body" slot="comment">
            Very bad idea if you need to work and need access to the non-chinese internet.
          </div>
          <button>Share</button>
        </shreddit-comment>
      </main>
      <aside>
        <h2>r/digitalnomad</h2>
        <p>Digital Nomads are individuals that leverage technology in order to work remotely.</p>
      </aside>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('post-title')
    expect(ids).toContain('post-body')
    expect(ids).toContain('comment-body')
  })

  it('keeps a leading article title when title and body are sibling modules', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com/story'),
      configurable: true
    })
    document.body.innerHTML = `
      <header><nav><a>World</a><a>Politics</a></nav></header>
      <aside>
        <p id="rail">This sidebar teaser should stay outside the smart content root.</p>
      </aside>
      <div id="article-shell" class="article-shell">
        <section class="article-hero">
          <h1 id="headline">Meteor shower peaks tonight. Here is how to watch it</h1>
        </section>
        <div class="article-content">
          <p id="paragraph">Sky-gazers will have the best chance to view the cosmic display on Wednesday morning before dawn, according to astronomers.</p>
          <p id="paragraph-2">The event is expected to be visible under clear skies, with the best viewing away from bright city lights.</p>
        </div>
      </div>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(target.contentRoot).toBe(document.querySelector('#article-shell'))
    expect(ids).toContain('headline')
    expect(ids).toContain('paragraph')
    expect(ids).toContain('paragraph-2')
    expect(ids).not.toContain('rail')
  })

  it('supplements content cards that sit outside the primary article root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ynarwal.github.io/how-llms-work/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="lesson">
        <article id="lesson-body">
          <h1>Downloading the Internet</h1>
          <p id="body-paragraph">The first step is collecting an enormous amount of text. Organizations like Common Crawl have been crawling the web since 2007.</p>
          <p id="body-paragraph-2">The goal is a large quantity of high quality, diverse documents that can be filtered into a training corpus.</p>
        </article>
        <aside>
          <section id="pipeline-card" class="pipeline-card stage">
            <strong>URL Filtering</strong>
            <span>Blocklists · Malware · Spam · Adult content</span>
            <div>Block-lists of known malware sites, spam networks, adult content, marketing pages, and low-quality domains are applied.</div>
          </section>
        </aside>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('body-paragraph')
    expect(ids).toContain('pipeline-card')
  })

  it('does not translate hidden detail text by selecting an expandable card container', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ynarwal.github.io/how-llms-work/'),
      configurable: true
    })
    document.body.innerHTML = `
      <style>
        .pipeline-node:not(.active) .pn-detail { display: none; }
      </style>
      <main id="lesson">
        <article id="lesson-body">
          <h1>Downloading the Internet</h1>
          <p id="body-paragraph">The first step is collecting an enormous amount of text from public web pages.</p>
          <p id="body-paragraph-2">The goal is a large quantity of high quality, diverse documents for training.</p>
        </article>
        <aside>
          <section class="section" aria-label="Data Collection">
            <div class="data-flow" role="list" aria-label="Data processing pipeline stages">
              <div id="late-card" class="pipeline-node" data-stage="2" role="button" aria-expanded="false" aria-label="Text Extraction - click to expand">
                <div id="late-title" class="pn-title">Text Extraction</div>
                <div id="late-sub" class="pn-sub">HTML to clean text · Remove navigation and CSS</div>
                <div id="late-detail" class="pn-detail">Raw HTML contains div tags, CSS, JavaScript, navigation menus, and ads. Parsers extract just the meaningful text content.</div>
              </div>
            </div>
          </section>
        </aside>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).not.toContain('late-card')
    expect(ids).not.toContain('late-title')
    expect(ids).not.toContain('late-sub')
    expect(ids).not.toContain('late-detail')
  })

  it('collects visible detail text after an expandable card opens outside the primary content root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ynarwal.github.io/how-llms-work/'),
      configurable: true
    })
    document.body.innerHTML = `
      <style>
        .pipeline-node:not(.active) .pn-detail { display: none; }
      </style>
      <main id="lesson">
        <article id="lesson-body">
          <h1>Downloading the Internet</h1>
          <p>The first step is collecting an enormous amount of text from public web pages.</p>
        </article>
        <aside>
          <div id="late-card" class="pipeline-node active" data-stage="2" role="button" aria-expanded="true" aria-label="Text Extraction - click to expand">
            <div id="late-title" class="pn-title">Text Extraction</div>
            <div id="late-sub" class="pn-sub">HTML to clean text · Remove navigation and CSS</div>
            <div id="late-detail" class="pn-detail">Raw HTML contains div tags, CSS, JavaScript, navigation menus, and ads. Parsers extract just the meaningful text content.</div>
          </div>
        </aside>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#late-card')!,
      document.querySelector('#lesson-body')!,
      'smart'
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('late-card')
    expect(ids).not.toContain('late-detail')
  })

  it('appends bilingual text inside the visible detail area of an expanded card', async () => {
    vi.mocked(translateText).mockResolvedValue('原始 HTML 包含 div 标签、CSS、JavaScript、导航菜单和广告。解析器只提取有意义的文本内容。')
    document.body.innerHTML = `
      <div id="late-card" class="pipeline-node active" role="button" aria-expanded="true">
        <div class="pn-title">Text Extraction</div>
        <div class="pn-sub">HTML to clean text · Remove navigation and CSS</div>
        <div id="late-detail" class="pn-detail">Raw HTML contains div tags, CSS, JavaScript, navigation menus, and ads. Parsers extract just the meaningful text content.</div>
      </div>
    `

    handleBilingualTranslation(document.querySelector('#late-card')!, false)
    await new Promise(resolve => setTimeout(resolve, 0))

    const detail = document.querySelector('#late-detail')!
    const translation = detail.querySelector('.only-translate-bilingual-content')

    expect(translation?.textContent).toContain('原始 HTML')
    expect(document.querySelector('#late-card > .only-translate-bilingual-content')).toBeNull()
  })

  it('keeps GitHub README markdown list translations on each list item', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article class="markdown-body entry-content">
          <h2 id="news">News</h2>
          <ul id="news-list">
            <li id="news-1">2026-05-15 Released v0.2.0 with sustained objectives across turns, WebUI now ships inside the wheel, and a real agent-loop refactor.</li>
            <li id="news-2">2026-05-14 Goal mode for long-term objectives, visible multi-step progress, and long-horizon missions in chat.</li>
            <li id="news-3">2026-05-13 Streaming reasoning before answers, automatic backup models, and smoother plug-in reconnects.</li>
          </ul>
        </article>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('news-1')
    expect(ids).toContain('news-2')
    expect(ids).toContain('news-3')
    expect(ids).not.toContain('news-list')
  })

  it('splits GitHub README markdown lists even when the list container is selected first', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article class="markdown-body entry-content">
          <h2 id="news">News</h2>
          <ul id="news-list" class="pipeline-card">
            Leading release notes
            <li id="news-1"><strong>2026-05-15</strong> Released v0.2.0 with sustained objectives across turns, WebUI now ships inside the wheel, and a real agent-loop refactor.</li>
            <li id="news-2"><strong>2026-05-14</strong> Goal mode for long-term objectives, visible multi-step progress, and long-horizon missions in chat.</li>
            <li id="news-3"><strong>2026-05-13</strong> Streaming reasoning before answers, automatic backup models, and smoother plug-in reconnects.</li>
          </ul>
        </article>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('news-1')
    expect(ids).toContain('news-2')
    expect(ids).toContain('news-3')
    expect(ids).not.toContain('news-list')
  })

  it('keeps forum-like topic titles while skipping list metadata', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ziggit.dev/'),
      configurable: true
    })
    document.body.innerHTML = `
      <header><nav><a>Docs</a><a>More</a></nav></header>
      <main>
        <ul class="topic-list">
          <li class="topic-list-item">
            <a id="topic-title" class="raw-topic-link" href="/t/ai-policy">AI/LLM Policy Updates</a>
            <p id="topic-excerpt" class="topic-excerpt">Hey all! The moderation team want to thank you for your input regarding AI showcases.</p>
            <span id="category" class="badge-category">Site Feedback</span>
            <span id="replies" class="replies">23</span>
            <span id="views" class="views">486</span>
            <span id="activity" class="activity">3h</span>
          </li>
        </ul>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('topic-title')
    expect(ids).toContain('topic-excerpt')
    expect(ids).not.toContain('category')
    expect(ids).not.toContain('replies')
    expect(ids).not.toContain('views')
    expect(ids).not.toContain('activity')
  })

  it('collects newly revealed nodes from dynamic content regions', () => {
    document.body.innerHTML = `
      <main id="content-root">
        <article id="live-card">
          <p id="already-translated" data-fr-translated="true">Already translated paragraph.</p>
          <div id="expanded" class="is-expanded">
            <p id="revealed">This newly revealed paragraph should be translated after Read More expands the story.</p>
          </div>
        </article>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#expanded')!,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('revealed')
    expect(ids).not.toContain('already-translated')
  })

  it('collects a node when the dynamic mutation target is the revealed paragraph itself', () => {
    document.body.innerHTML = `
      <main id="content-root">
        <article id="live-card">
          <p id="revealed">This paragraph had aria-hidden removed by a Read More interaction and should be observed.</p>
        </article>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#revealed')!,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(nodes.map(node => node.id)).toContain('revealed')
  })

  it('ignores dynamic nodes outside smart content root', () => {
    document.body.innerHTML = `
      <main id="content-root">
        <p id="inside">Readable article paragraph.</p>
      </main>
      <aside id="outside">
        <p id="outside-text">Sidebar text should not be picked up by smart dynamic scans.</p>
      </aside>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#outside')!,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(nodes).toHaveLength(0)
  })
})
