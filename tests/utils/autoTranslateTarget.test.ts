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

  it('keeps GitHub pull request comment translations on markdown blocks', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot/pull/4005'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div id="issuecomment-1" class="js-comment">
          <div id="comment-body" class="comment-body markdown-body js-comment-body">
            <p id="intro">Hi! This PR proposes <strong>GitAgent Protocol (GAP)</strong> support for nanobot -- a small, open standard for portable, discoverable AI agents (<a href="https://gitagent.sh">https://gitagent.sh</a>).</p>
            <p id="fit"><strong>nanobot is a perfect fit for the protocol:</strong> it's lightweight, open-source, multi-provider, and already beloved by developers who want a minimal agent harness.</p>
            <p id="adds-heading"><strong>What this adds -- nothing else changes:</strong></p>
            <ul id="adds-list">
              <li id="agent-yaml"><code>agent.yaml</code> -- a standard manifest capturing nanobot's name, version, model preferences, runtime entrypoint, full skill inventory, license, and supervision policy</li>
              <li id="soul-md"><code>SOUL.md</code> -- nanobot's persona and behavioural contract in the standard soul-file format, faithfully distilled from your existing <code>CLAUDE.md</code> and architecture docs</li>
            </ul>
            <p id="why-heading"><strong>Why this is useful for nanobot:</strong></p>
            <ul id="why-list">
              <li id="why-one">Any GAP-compatible harness can discover and run nanobot without extra config</li>
              <li id="why-two">The agent becomes listable in <a href="https://registry.gitagent.sh">https://registry.gitagent.sh</a> alongside other community agents</li>
            </ul>
            <p id="closing">This is entirely opt-in -- feel free to tweak the files, request changes, or close if this isn't a direction you want to go.</p>
            <hr>
            <p id="signature"><em>Proposed by the <a href="https://gitagent.sh">GAP Promoter</a> - GitAgent Protocol v0.1.0</em></p>
          </div>
        </div>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('intro')
    expect(ids).toContain('fit')
    expect(ids).toContain('adds-heading')
    expect(ids).toContain('agent-yaml')
    expect(ids).toContain('soul-md')
    expect(ids).toContain('why-heading')
    expect(ids).toContain('why-one')
    expect(ids).toContain('why-two')
    expect(ids).toContain('closing')
    expect(ids).toContain('signature')
    expect(ids).not.toContain('comment-body')
    expect(ids).not.toContain('adds-list')
    expect(ids).not.toContain('why-list')
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

  it('keeps Matt Strom-Awn article paragraphs that mention popular linked subjects', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://mattstromawn.com/writing/expansion-artifacts/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main class="l--grid">
        <header class="l--grid-narrow">
          <h1 id="title">Expansion artifacts</h1>
          <p>Apr 20, 2026 · 8 min read</p>
        </header>
        <article class="post l--grid-narrow">
          <p id="intro">The information age has been defined by bandwidth. The internet is limited by how much data we can squeeze into narrow pipes.</p>
        </article>
        <div class="gallery gallery--wide">
          <figure>
            <img src="/images/expansion-1.jpg" alt="A photo montage before any compression cycles.">
            <figcaption>Before compression: PSNR of infinity.</figcaption>
          </figure>
        </div>
        <article class="l--grid-narrow post">
          <p id="aesthetic-choice">Expansion artifacts will become aesthetic choices, too. <a href="https://www.trend-mill.com/p/shrimp-jesus-is-the-future-of-social">Shrimp Jesus</a> is my favorite, the kind of insane imagery that only an LLM would create. Power users of AI website generators already know how to recognize the tool marks. But as more and more non-designers use tools like Claude Design to prompt their way to fully-functional software products, I expect to see a <em>preference</em> for the aesthetic convergence endemic to the current crop of AI models.</p>
          <div class="eleventy-plugin-embed-twitter">
            <blockquote class="twitter-tweet">
              <p lang="en" dir="ltr">I'd like to formally apologize for making every button in Tailwind UI five years ago, leading to every AI generated UI on earth also being indigo.</p>
              <a href="https://twitter.com/adamwathan/status/1953510802159219096">August 7, 2025</a>
            </blockquote>
          </div>
          <p id="compound-danger">Expansion artifacts get genuinely dangerous when they compound, when one AI generation becomes the input to another, and another, and another. In February, an autonomous openclaw agent <a href="https://theshamblog.com/an-ai-agent-published-a-hit-piece-on-me/">published a hit piece on Scott Shambaugh</a>, a maintainer of the popular matplotlib Python library, for rejecting its code. Benj Edwards then reported the story for Ars Technica, but used AI to help him write; unsurprisingly, <a href="https://theshamblog.com/an-ai-agent-published-a-hit-piece-on-me-part-2/">his article contained hallucinated quotes</a>.</p>
          <p id="after">This kind of Gell-Mann Amnesia for expansion artifacts leads to runaway feedback loops:</p>
        </article>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('aesthetic-choice')
    expect(ids).toContain('compound-danger')
  })

  it('keeps Decrypt article title, brief bullets, and short body paragraphs while skipping the reading rail', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://decrypt.co/366408/openai-gpt-image-2-vs-google-nano-banana-2-review'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="sticky top-24 max-w-[12.75rem] mx-auto">
          <div class="mb-4">
            <p id="reading-label" class="inline-flex font-akzidenz-grotesk font-bold mb-4">Reading</p>
            <p id="reading-title">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</p>
          </div>
        </div>
        <div class="z-2 flex-1 min-w-0">
          <div>
            <h1 id="decrypt-title" class="font-canela font-black">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</h1>
            <h2 id="decrypt-subtitle" class="font-akzidenz-grotesk">Which state-of-the-art AI image generator is most effective at producing A+ results? We put GPT Image 2 and Nano Banana 2 to the test.</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-8 unreset post-content md:pb-20">
            <div id="brief-wrapper" class="pt-8 pb-10 border-t border-b border-decryptGridline">
              <h4 id="brief-title">In brief</h4>
              <ul>
                <li id="brief-one">GPT Image 2 launched in late April with native reasoning and extremely good text accuracy in any script.</li>
                <li id="brief-two">Nano Banana 2 wins on anime illustration, aerial spatial composition, and structured information design.</li>
                <li id="brief-three">GPT Image 2 dominates on photorealism, typography, and signature calligraphy.</li>
              </ul>
            </div>
            <p id="body-before">GPT Image 2--model identifier gpt-image-2, running on the GPT-5.4 backbone--is OpenAI's first image model with native reasoning built into the architecture.</p>
            <div class="post-content-w-full my-10 hidden xl:flex items-center justify-center"></div>
            <p id="retired">OpenAI also retired DALL-E 3 and GPT Image 1.5, which are both being shut down on May 12. This isn't an update--it's a replacement.</p>
            <p id="solved">GPT Image 2 appears to have largely solved it.</p>
            <p id="again">Again, in this art, the oversharpening and artifacts are apparent, and the image is not visually pleasing.</p>
            <h3 id="timeline-heading">Agentic research: The Bitcoin timeline</h3>
            <p id="prompt">The prompt asked for a widescreen <a href="/resources/bitcoin">Bitcoin</a> history timeline in kids-drawing style, with a strict quality bar on information accuracy.</p>
          </div>
        </div>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('decrypt-title')
    expect(ids).toContain('decrypt-subtitle')
    expect(ids).toContain('brief-title')
    expect(ids).toContain('brief-one')
    expect(ids).toContain('brief-two')
    expect(ids).toContain('brief-three')
    expect(ids).toContain('retired')
    expect(ids).toContain('solved')
    expect(ids).toContain('again')
    expect(ids).toContain('prompt')
    expect(ids).not.toContain('reading-label')
    expect(ids).not.toContain('reading-title')
    expect(ids).not.toContain('brief-wrapper')
    expect(target.nodes.every(node => node instanceof Element)).toBe(true)
    expect(target.nodes.map(node => node.textContent).join(' ')).not.toContain('ReadingOpenAI')
  })

  it('applies the Decrypt article profile when full-page scope is selected', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://decrypt.co/366408/openai-gpt-image-2-vs-google-nano-banana-2-review'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="sticky top-24 max-w-[12.75rem] mx-auto">
          <div class="mb-4">
            <p id="reading-label">Reading</p>
            <p id="reading-title">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</p>
          </div>
        </div>
        <div>
          <h1 id="decrypt-title">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</h1>
          <h2 id="decrypt-subtitle">Which state-of-the-art AI image generator is most effective at producing A+ results?</h2>
          <div class="post-content">
            <div id="brief-wrapper">
              <h4 id="brief-title">In brief</h4>
              <ul>
                <li id="brief-one">GPT Image 2 launched in late April with native reasoning and extremely good text accuracy in any script.</li>
                <li id="brief-two">Nano Banana 2 wins on anime illustration, aerial spatial composition, and structured information design.</li>
              </ul>
            </div>
            <p id="retired">OpenAI also retired DALL-E 3 and GPT Image 1.5, which are both being shut down on May 12.</p>
          </div>
        </div>
      </main>
    `

    const target = resolveAutoTranslateTarget('full')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('decrypt-title')
    expect(ids).toContain('decrypt-subtitle')
    expect(ids).toContain('brief-title')
    expect(ids).toContain('brief-one')
    expect(ids).toContain('brief-two')
    expect(ids).toContain('retired')
    expect(ids).not.toContain('reading-label')
    expect(ids).not.toContain('reading-title')
    expect(ids).not.toContain('brief-wrapper')
    expect(target.nodes.every(node => node instanceof Element)).toBe(true)
    expect(target.nodes.map(node => node.textContent).join(' ')).not.toContain('ReadingOpenAI')
  })

  it('keeps Decrypt article headings and post paragraphs when the page has no main element', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://decrypt.co/364621/claude-opus-47-review-benchmarks-coding-test'),
      configurable: true
    })
    document.body.innerHTML = `
      <article class="relative overflow-hidden">
        <h2 id="coin-prices" class="sr-only">Coin Prices</h2>
        <div class="sticky top-24 max-w-[12.75rem] mx-auto">
          <p id="reading-label">Reading</p>
          <p id="reading-title">Claude Opus 4.7 Is Here: Anthropic's Latest Model Delivers</p>
        </div>
        <div class="z-2 flex-1 min-w-0">
          <div class="mb-8">
            <h1 id="decrypt-title">Claude Opus 4.7 Is Here: Anthropic's Latest Model Delivers, But It's a Token Eating Machine</h1>
            <h2 id="decrypt-subtitle">Anthropic's new flagship model beat every benchmark we threw at it, eats tokens like a hungry teenager, and showed its reasoning out loud.</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-8 unreset post-content md:pb-20">
            <div id="brief-wrapper">
              <h4 id="brief-title">In brief</h4>
              <ul>
                <li id="brief-one">Anthropic just released its most capable Opus model yet, Claude Opus 4.7.</li>
              </ul>
            </div>
            <p id="first-body">Anthropic shipped <a href="https://www.anthropic.com/news/claude-opus-4-7">Claude Opus 4.7</a> today, calling it the company's most capable Opus model yet. We tested it, and the marketing lines up with the results.</p>
            <p><iframe src="about:blank"></iframe></p>
            <blockquote class="twitter-tweet">
              <p lang="en" dir="ltr">Welcome back opus 4.6 <a href="https://t.co/hpwNkrq1tD">pic.twitter.com/hpwNkrq1tD</a></p>
            </blockquote>
            <p id="benchmarks">Benchmarks back up Anthropic's claims. On SWE-bench Multilingual, a benchmark that measures coding skills, Opus 4.7 scored 80.5% against 4.6's 77.8%.</p>
            <p id="gdpval">On GDPVal-AA, a third-party evaluation of economically valuable knowledge work across finance and legal domains, 4.7 scored 1,753 Elo against GPT-5.4's 1,674--a clear margin over the closest competitor.</p>
          </div>
        </div>
      </article>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('decrypt-title')
    expect(ids).toContain('decrypt-subtitle')
    expect(ids).toContain('brief-title')
    expect(ids).toContain('brief-one')
    expect(ids).toContain('first-body')
    expect(ids).toContain('benchmarks')
    expect(ids).toContain('gdpval')
    expect(ids).not.toContain('coin-prices')
    expect(ids).not.toContain('reading-label')
    expect(ids).not.toContain('reading-title')
    expect(ids).not.toContain('brief-wrapper')
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

  it('skips Asterisk dynamic progress chapter navigation while keeping article headings', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://asteriskmag.com/issues/14/the-mystery-in-the-medicine-cabinet'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="article-root" class="post essay">
        <div id="progress">
          <div class="chapter-indicators">
            <a id="chapter-link" class="progress-bookmark chaptermark" href="#how-does-ibuprofen-work">
              <div class="dot"></div>
              <div class="text"><span id="chapter-span">How does ibuprofen work?</span></div>
            </a>
          </div>
          <div class="markers"></div>
        </div>
        <section class="opener">
          <h1 id="title">The Mystery in the Medicine Cabinet</h1>
          <h2 id="author">Dynomight</h2>
        </section>
        <section class="content" id="rangyscope">
          <div class="intro">
            <p id="subtitle">Acetaminophen, ibuprofen, and what doctors probably want you to know.</p>
          </div>
          <div class="content-blocks">
            <div class="heading">
              <h2 id="how-does-ibuprofen-work">How does ibuprofen work?</h2>
            </div>
            <div class="text">
              <p id="paragraph">Ibuprofen inhibits the Cyclooxygenase enzyme, which leads to less physical inflammation and thus less pain.</p>
            </div>
          </div>
        </section>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map((node) => node.id)

    expect(ids).toContain('title')
    expect(ids).toContain('rangyscope')
    expect(ids).not.toContain('chapter-link')
    expect(ids).not.toContain('chapter-span')

    const dynamicNodes = collectDynamicTranslationNodes(
      document.querySelector('#chapter-link')!,
      document.querySelector('#article-root')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(dynamicNodes).toEqual([])
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
