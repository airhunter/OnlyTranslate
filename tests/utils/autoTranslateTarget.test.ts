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
import { getBilingualAppendTarget } from '@/entrypoints/main/translationTarget/decision'
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

  it('keeps GitHub issue list titles while skipping list metadata', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/alchaincyf/huashu-design/issues'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="js-check-all-container">
          <div class="js-issue-row Box-row Box-row--focus-gray p-0">
            <div class="d-flex Box-row--drag-hide position-relative">
              <div class="flex-auto min-width-0 p-2 pr-3 pr-md-2">
                <a id="issue-title-1" class="Link--primary v-align-middle no-underline h4 js-navigation-open markdown-title" href="/alchaincyf/huashu-design/issues/12">
                  Refine token panel spacing on narrow screens
                </a>
                <span id="issue-label" class="IssueLabel color-bg-accent-emphasis">enhancement</span>
                <div class="opened-by">
                  #12 opened 2 days ago by alchaincyf
                </div>
              </div>
            </div>
          </div>
          <li>
            <h3>
              <a id="issue-title-2" href="/alchaincyf/huashu-design/issues/24">
                [SUGGESTION] Add Community Translation Links Section in README
              </a>
            </h3>
            <p>Status: Open.</p>
          </li>
          <li>
            <h3>
              <a id="issue-title-3" href="https://github.com/alchaincyf/huashu-design/issues/23">
                deck_index.html: arrow keys break after clicking inside iframe
              </a>
            </h3>
            <p>
              #23 opened on May 7, 2026 by jaluova
            </p>
          </li>
          <nav aria-label="Repository">
            <a id="repo-issues-tab" href="/alchaincyf/huashu-design/issues">
              Issues 3
            </a>
          </nav>
          <div>
            <div>
              <a id="bare-issues-link" href="/alchaincyf/huashu-design/issues">
                Issues
              </a>
            </div>
          </div>
        </div>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('issue-title-1')
    expect(ids).toContain('issue-title-2')
    expect(ids).toContain('issue-title-3')
    expect(ids).not.toContain('issue-label')
    expect(ids).not.toContain('repo-issues-tab')
    expect(ids).not.toContain('bare-issues-link')
    expect(target.grabOptions?.siteCompatMode).toBe('smart')
  })

  it('keeps GitHub repository search result descriptions in smart mode', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/search?q=openclaw&type=repositories'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div data-testid="facets-pane">
          <ul data-testid="filter-groups">
            <li>
              <a id="repositories-filter" href="https://github.com/search?q=openclaw&amp;type=repositories" data-testid="nav-item-repositories">
                <span>Repositories</span>
                <span>63.5k</span>
              </a>
            </li>
            <li>
              <a id="issues-filter" href="https://github.com/search?q=openclaw&amp;type=issues" data-testid="nav-item-issues">
                <span>Issues</span>
                <span>107k</span>
              </a>
            </li>
          </ul>
        </div>
        <div data-testid="search-sub-header">
          <span id="result-count">63.5k results</span>
          <button id="sort">Sort by: Best match</button>
        </div>
        <div data-testid="results-list" class="List-module__List__fNMbL">
          <div class="Result-module__Result__Up5vk">
            <div class="Repositories-module__resultRow__OxgKG">
              <div class="Repositories-module__resultContent___BS2W">
                <h3>
                  <div class="search-title Header-module__title__QUX7e">
                    <a href="/openclaw/openclaw">openclaw/openclaw</a>
                  </div>
                </h3>
                <div class="Content-module__Content__mHmep">
                  <span id="repo-description-1" class="search-match SearchMatchText-module__searchMatchText__n6aQc">
                    Your own personal AI assistant. Any OS. Any Platform. The lobster way.
                  </span>
                </div>
                <div class="TokenList-module__tokenList__zbitn">
                  <a id="topic" class="TopicLabel-module__topicLabel__QbTaK" href="/topics/assistant">assistant</a>
                </div>
                <span id="stars">374k</span>
              </div>
              <div class="Repositories-module__actionsColumn__LdieL">
                <a>Star</a>
              </div>
            </div>
          </div>
          <div class="Result-module__Result__Up5vk">
            <div class="Repositories-module__resultRow__OxgKG">
              <div class="Repositories-module__resultContent___BS2W">
                <h3>
                  <div class="search-title Header-module__title__QUX7e">
                    <a href="/VoltAgent/awesome-openclaw-skills">VoltAgent/awesome-openclaw-skills</a>
                  </div>
                </h3>
                <div class="Content-module__Content__mHmep">
                  <span id="repo-description-2" class="search-match SearchMatchText-module__searchMatchText__n6aQc">
                    The awesome collection of OpenClaw skills. 5,400+ skills filtered and categorized from the official OpenClaw Skills Registry.
                  </span>
                </div>
              </div>
              <div class="Repositories-module__actionsColumn__LdieL">
                <a>Star</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('repo-description-1')
    expect(ids).toContain('repo-description-2')
    expect(ids).not.toContain('topic')
    expect(ids).not.toContain('stars')
    expect(ids).not.toContain('repositories-filter')
    expect(ids).not.toContain('issues-filter')
    expect(ids).not.toContain('result-count')
    expect(ids).not.toContain('sort')
    expect(target.grabOptions?.siteCompatMode).toBe('smart')
  })

  it('appends GitHub search sponsor translations beside the sponsor paragraph', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/search?q=openclaw&type=repositories'),
      configurable: true
    })
    document.body.innerHTML = `
      <div class="Search-module__rightSidebar__S4cSw">
        <div id="sponsor-card" class="MarketingSuggestion-module__container__vEhi4">
          <h2 class="MarketingSuggestion-module__heading__R5sp4">Sponsor open source projects you depend on</h2>
          <span id="sponsor-copy" class="MarketingSuggestion-module__description__X3VPv">
            Contributors are working behind the scenes to make open source better for everyone--give them the help and recognition they deserve.
          </span>
          <a href="/sponsors/explore">Explore sponsorable projects</a>
        </div>
      </div>
    `

    const card = document.querySelector<HTMLElement>('#sponsor-card')!
    const paragraph = document.querySelector<HTMLElement>('#sponsor-copy')!
    const appendTarget = getBilingualAppendTarget(card, {
      mode: 'smart',
      scope: 'smart',
      contentRoot: document.body
    })

    expect(appendTarget).toBe(paragraph)
  })

  it('keeps GitHub search sidebar translations attached to the sponsor copy', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/search?q=openclaw&type=repositories'),
      configurable: true
    })
    document.body.innerHTML = `
      <div id="right-column" class="Search-module__rightSidebar__S4cSw">
        <div class="SecondarySuggestions-module__container__SiYxU">
          <div class="MarketingSuggestion-module__container__vEhi4">
            <h2 class="MarketingSuggestion-module__heading__R5sp4">Sponsor open source projects you depend on</h2>
            <span id="sponsor-copy" class="MarketingSuggestion-module__description__X3VPv">
            Contributors are working behind the scenes to make open source better for everyone--give them the help and recognition they deserve.
            </span>
            <a href="/sponsors/explore">Explore sponsorable projects</a>
          </div>
          <div id="protip" class="MiniTip-module__container__VcJrj">
            ProTip! Press the / key to activate the search input again and adjust your query.
          </div>
        </div>
      </div>
    `

    const sidebar = document.querySelector<HTMLElement>('#right-column')!
    const copy = document.querySelector<HTMLElement>('#sponsor-copy')!
    const appendTarget = getBilingualAppendTarget(sidebar, {
      mode: 'smart',
      scope: 'smart',
      contentRoot: document.body
    })

    expect(appendTarget).toBe(copy)

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('sponsor-copy')
    expect(ids).not.toContain('right-column')
    expect(ids).not.toContain('protip')
  })

  it('supplements TDS related article card titles and descriptions outside the article root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://towardsdatascience.com/i-reduced-my-pandas-runtime-by-95-heres-what-i-was-doing-wrong/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article id="article">
          <h1 id="title">I Reduced My Pandas Runtime by 95% — Here's What I Was Doing Wrong</h1>
          <p id="body-paragraph">Most slow Pandas code works until it does not. This article explains hidden bottlenecks in row-wise operations.</p>
          <p id="body-paragraph-2">The examples compare vectorized operations with loops and show why memory layout matters.</p>
        </article>
      </main>
      <section class="author-social-links">
        <a id="social-medium" href="https://medium.com/@author">Medium</a>
        <a id="social-youtube" href="https://www.youtube.com/@author">YouTube</a>
      </section>
      <section id="related" class="related-articles">
        <h2>Related Articles</h2>
        <div class="post-card">
          <a href="/related-one">
            <h3 id="related-title-1">Write Pandas Like a Pro With Method Chaining Pipelines</h3>
          </a>
          <p id="related-description-1">Master method chaining, assign, and pipe to write cleaner, testable Pandas code.</p>
        </div>
        <div class="post-card">
          <a href="/related-two">
            <h3 id="related-title-2">Beyond Lists: Using Python Deque for Real-Time Sliding Windows</h3>
          </a>
          <p id="related-description-2">Discover why collections deque is useful for high-performance sliding windows and efficient data streams.</p>
        </div>
      </section>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(target.contentRoot.contains(document.querySelector('#body-paragraph'))).toBe(true)
    expect(target.contentRoot.contains(document.querySelector('#related'))).toBe(false)
    expect(ids).toContain('body-paragraph')
    expect(ids).toContain('related-title-1')
    expect(ids).toContain('related-description-1')
    expect(ids).toContain('related-title-2')
    expect(ids).toContain('related-description-2')
    expect(ids).not.toContain('related')
    expect(ids).not.toContain('social-medium')
    expect(ids).not.toContain('social-youtube')
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

  it('includes Claude learning right-rail comparison cards in smart mode without opening generic asides', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://claude.nagdy.me/learn/getting-started/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="main-content">
        <div class="lg:grid lg:grid-cols-[3fr_2fr]">
          <article>
            <h2 id="prerequisites">Prerequisites</h2>
            <p id="body-paragraph">Claude Code runs on macOS, Ubuntu, and Windows with an active internet connection. This paragraph is long enough to be recognized as the main learning article body instead of the surrounding page layout.</p>
            <p id="body-paragraph-two">Before installing the CLI, confirm your terminal, editor, and account access are ready for a guided setup session.</p>
          </article>
          <aside>
            <div class="p-5">
              <section>
                <h3 id="compare-title">Compare</h3>
                <div class="grid grid-cols-2 gap-6" role="region">
                  <div class="rounded-lg">
                    <div><h3 id="cli-title">CLI Terminal</h3></div>
                    <ul>
                      <li id="cli-feature"><strong>Full feature set</strong> — Every slash command, MCP server, hook, and plugin works in the terminal</li>
                    </ul>
                  </div>
                  <div class="rounded-lg">
                    <div><h3 id="ide-title">IDE Extensions</h3></div>
                    <ul>
                      <li id="ide-feature"><strong>Inline editing</strong> — See changes directly in your editor with visual diffs</li>
                    </ul>
                  </div>
                </div>
              </section>
              <section>
                <h3 id="quiz-title">Check Your Understanding</h3>
                <div role="radiogroup">
                  <button id="quiz-option" role="radio">The native installer via curl or PowerShell</button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>
      <aside id="outside-aside">
        <p id="outside-aside-text">This generic sidebar paragraph should not be picked up by the Claude profile.</p>
      </aside>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('body-paragraph')
    expect(ids).toContain('compare-title')
    expect(ids).toContain('cli-title')
    expect(ids).toContain('cli-feature')
    expect(ids).toContain('ide-title')
    expect(ids).toContain('ide-feature')
    expect(ids).toContain('quiz-title')
    expect(ids).not.toContain('quiz-option')
    expect(ids).not.toContain('outside-aside-text')
  })

  it('keeps Mario Zechner article paragraphs that contain inline links', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://mariozechner.at/posts/2026-03-25-thoughts-on-slowing-the-fuck-down/'),
      configurable: true
    })
    document.body.innerHTML = `
      <header>
        <nav><a href="/">Home</a><a href="/archive">Archive</a></nav>
      </header>
      <main>
        <article>
          <h1 id="title">Thoughts on slowing the fuck down</h1>
          <p id="lead">I have been thinking about the pace of software development and the pressure to automate every part of it.</p>
          <p id="previous-with-links">
            We don't have access to the internals of companies. But every now and then something slips through to some news reporter.
            Like this supposed <a href="https://www.ft.com/content/00c282de-ed14-4acd-a948-bc8d6bdb339d">AI caused outage at AWS</a>.
            Which AWS immediately <a href="https://www.aboutamazon.com/news/aws/aws-service-outage-ai-bot-kiro">"corrected"</a>.
            Only to then follow up internally with a <a href="https://www.businessinsider.com/amazon-tightens-code-controls-after-outages-including-one-ai-2026-3">90-day reset</a>.
          </p>
          <p id="satya-paragraph">
            Satya Nadella, the CEO of Microsoft, has been going on about
            <a href="https://techcrunch.com/2025/04/29/microsoft-ceo-says-up-to-30-of-the-companys-code-was-written-by-ai/">how much code is now being written by AI</a>
            at Microsoft. While we don't have direct evidence, there sure is a feeling that Windows is going down the shitter.
            Microsoft itself seems to agree, based on this fine
            <a href="https://blogs.windows.com/windowsexperience/2026/03/24/improving-the-windows-11-experience/">blog post</a>.
          </p>
          <p id="after">That post is not quite an admission, but it gives the impression that the product is struggling under its own weight.</p>
        </article>
      </main>
      <footer><a href="/rss">RSS</a></footer>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('satya-paragraph')
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
