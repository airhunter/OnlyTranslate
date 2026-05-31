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

import { collectDynamicTranslationNodes, handleBilingualTranslation, handleBtnTranslation, resolveAutoTranslateTarget } from '@/entrypoints/main/trans'
import { getBilingualAppendTarget } from '@/entrypoints/main/translationTarget/decision'
import { getDynamicTranslationScanRoot } from '@/entrypoints/main/translationTarget/dynamic'
import { createScanContext } from '@/entrypoints/main/translationTarget/scanContext'
import { translateText } from '@/entrypoints/utils/translateApi'

describe('resolveAutoTranslateTarget behavior', () => {
  const originalLocation = window.location

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    })
  })

  it('translates button text through the shared translateText entrypoint', async () => {
    vi.mocked(translateText).mockResolvedValue('开始操作')
    document.body.innerHTML = `<button id="action">Start action</button>`

    const button = document.querySelector('#action') as HTMLElement
    handleBtnTranslation(button)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(translateText).toHaveBeenCalledWith('Start action', document.title)
    expect(button.innerText).toBe('开始操作')
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
            <div id="late-sub" class="pn-sub">HTML to clean text - Remove navigation and CSS</div>
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
        <div class="pn-sub">HTML to clean text - Remove navigation and CSS</div>
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
    expect(ids).toContain('how-does-ibuprofen-work')
    expect(ids).toContain('paragraph')
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

  it('collects an untranslated Asterisk paragraph after a bilingual sibling', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://asteriskmag.com/issues/14/the-mystery-in-the-medicine-cabinet'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="article-root" class="post essay">
        <section class="content" id="rangyscope">
          <div class="content-blocks">
            <div id="medicine-text" class="text">
              <p id="ibuprofen" data-fr-node-id="fr-node-18" data-fr-translated="true" class="only-translate-bilingual">
                Ibuprofen inhibits the Cyclooxygenase (COX) enzyme. This in turn inhibits the formation of
                <a href="https://www.ncbi.nlm.nih.gov/books/NBK542299/">messenger molecules</a>
                involved in inflammation, which leads to less physical inflammation and thus less pain.
                <span class="only-translate-bilingual-content fluent-display-bold">布洛芬抑制环氧合酶，从而减轻疼痛。</span>
              </p>
              <p id="nsaid-paragraph">
                The same story is true for almost all over-the-counter painkillers, which is why they’re almost all
                considered “non-steroidal anti-inflammatory drugs,” or NSAIDs. This includes ibuprofen, aspirin,
                naproxen (Aleve), and a long list of <a href="https://www.drugs.com/drug-class/nonsteroidal-anti-inflammatory-agents.html">related drugs</a>.
                But it does not include acetaminophen.
              </p>
            </div>
          </div>
        </section>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#medicine-text')!,
      document.querySelector('#rangyscope')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(nodes.map(node => node.id)).toContain('nsaid-paragraph')
    expect(nodes.map(node => node.id)).not.toContain('ibuprofen')
  })

  it('collects Ziggit reply paragraphs inserted outside the initial post content root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://ziggit.dev/t/what-is-the-exact-semantic-of-export/15822'),
      configurable: true
    })
    document.body.innerHTML = `
      <section id="topic" class="topic-area">
        <div class="post-stream">
          <article id="post_1" class="boxed onscreen-post">
            <div class="post__body topic-body clearfix">
              <div class="post__regular regular post__contents contents">
                <div class="cooked">
                  <p id="intro" data-fr-translated="true" class="only-translate-bilingual">
                    Hi guys, in my understanding, <code>export</code> is used to expose a Zig function to c/c++ code.
                    <span class="only-translate-bilingual-content fluent-display-bold">translated intro</span>
                  </p>
                  <pre data-code-wrap="zig" class="codeblock-buttons"><code>pub export fn DllMain() bool { return true; }</code></pre>
                </div>
              </div>
            </div>
          </article>
          <article id="post_2" class="boxed onscreen-post">
            <div class="post__body topic-body clearfix">
              <div class="topic-meta-data">
                <span id="username" class="first username">vulpesx</span>
                <span id="time" class="relative-date">1h</span>
              </div>
              <div id="reply-contents" class="post__regular regular post__contents contents">
                <div class="cooked">
                  <p id="reply-point">That is the point of <code>export</code>, if you do not want it exported then do not <code>export</code> it</p>
                </div>
                <section class="post__menu-area post-menu-area clearfix">
                  <nav class="post-controls expanded">
                    <button id="like">like this post</button>
                  </nav>
                </section>
              </div>
            </div>
          </article>
        </div>
      </section>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#post_2')!,
      document.querySelector('#post_1')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('reply-point')
    expect(ids).not.toContain('username')
    expect(ids).not.toContain('time')
    expect(ids).not.toContain('like')
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

  it('drops batched dynamic UI outside the smart content root before deep scanning', () => {
    const scanContext = createScanContext()
    document.body.innerHTML = `
      <main id="content-root">
        <article>
          <p id="inside">Readable article paragraph with enough detail to remain the main translation target.</p>
        </article>
      </main>
      <aside id="ui-batch" class="sidebar toolbar related recommended">
        ${Array.from({ length: 120 }, (_, index) => `<button id="ui-${index}">Open</button>`).join('')}
      </aside>
    `

    const uiBatch = document.querySelector('#ui-batch')!
    const scanRoot = getDynamicTranslationScanRoot(
      uiBatch,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart', scanContext }
    )
    const nodes = collectDynamicTranslationNodes(
      uiBatch,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart', scanContext }
    )

    expect(scanRoot).toBeNull()
    expect(nodes).toHaveLength(0)
    expect(scanContext.stats.classifiedElements).toBeLessThanOrEqual(1)
  })

  it('keeps dynamic readable paragraphs inside heavy content roots within the dynamic budget', () => {
    const scanContext = createScanContext()
    document.body.innerHTML = `
      <main id="content-root">
        <article id="live-story">
          <div id="dynamic-batch">
            ${Array.from({ length: 120 }, (_, index) => `<span class="badge">Badge ${index}</span>`).join('')}
            <p id="dynamic-readable">This newly inserted live update contains enough context to be translated after the heavy page batches DOM mutations.</p>
          </div>
        </article>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#dynamic-batch')!,
      document.querySelector('#content-root')!,
      'smart',
      { siteCompatMode: 'smart', scanContext }
    )

    expect(nodes.map(node => node.id)).toContain('dynamic-readable')
    expect(scanContext.stats.classifiedElements).toBeLessThanOrEqual(800)
  })
})
