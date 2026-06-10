import { beforeEach, describe, expect, it } from 'vitest'

import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier'
import { createScanContext, isObviousUiSubtree } from '@/entrypoints/main/translationTarget/scanContext'

describe('contentUnitClassifier', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('allows article titles and subtitles near readable content', () => {
    document.body.innerHTML = `
      <main>
        <section class="article-hero">
          <h1 id="title">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</h1>
          <p id="subtitle" class="dek">Which state-of-the-art AI image generator is most effective at producing A+ results? We put both systems to the test.</p>
        </section>
        <article>
          <p>This readable paragraph provides enough context for the classifier to treat the nearby heading as article content.</p>
        </article>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#title')!).action).toBe('allow')
    expect(classifyContentUnit(document.querySelector('#title')!).kind).toBe('title')
    expect(classifyContentUnit(document.querySelector('#subtitle')!).action).toBe('allow')
    expect(classifyContentUnit(document.querySelector('#subtitle')!).kind).toBe('subtitle')
  })

  it('allows a headline and standfirst without relying on site-specific class names', () => {
    document.body.innerHTML = `
      <div class="page-shell">
        <section class="hero-area">
          <h1 id="headline">OpenAI GPT Image 2 vs Google Nano Banana 2: Which AI Image Generator Is Best?</h1>
          <div id="standfirst">Which state-of-the-art AI image generator is most effective at producing A+ results? We put both systems to the test.</div>
        </section>
      </div>
    `

    expect(classifyContentUnit(document.querySelector('#headline')!).kind).toBe('title')
    expect(classifyContentUnit(document.querySelector('#standfirst')!).kind).toBe('subtitle')
  })

  it('allows document-style content cards', () => {
    document.body.innerHTML = `
      <main class="document">
        <section id="stage-card" class="pipeline-card stage">
          <strong>URL Filtering</strong>
          <span>Blocklists · Malware · Spam · Adult content</span>
          <div>Block-lists of known malware sites, spam networks, adult content, marketing pages, and low-quality domains are applied.</div>
        </section>
      </main>
    `

    const decision = classifyContentUnit(document.querySelector('#stage-card')!)

    expect(decision.action).toBe('allow')
    expect(decision.kind).toBe('content-card')
  })

  it('allows non-early pipeline cards with aria-expanded outside readable containers', () => {
    document.body.innerHTML = `
      <section class="section" aria-label="Data Collection">
        <div class="col-text">
          <div class="data-flow" role="list" aria-label="Data processing pipeline stages">
            <div class="pipeline-node" data-stage="0" role="button" aria-expanded="false" aria-label="Common Crawl - click to expand">
              <div class="pn-title">Common Crawl</div>
              <div class="pn-sub">2.7B web pages · Raw HTML · Since 2007</div>
              <div class="pn-detail">A non-profit organization that crawls the web and freely provides its data. Their bots follow links from seed pages, recursively indexing the internet.</div>
            </div>
            <div class="pipeline-arrow" aria-hidden="true">↓</div>
            <div class="pipeline-node" data-stage="1" role="button" aria-expanded="false" aria-label="URL Filtering - click to expand">
              <div class="pn-title">URL Filtering</div>
              <div class="pn-sub">Blocklists · Malware · Spam · Adult content</div>
              <div class="pn-detail">Block-lists of known malware sites, spam networks, adult content, marketing pages, and low-quality domains are applied. Entire domains can be removed.</div>
            </div>
            <div class="pipeline-arrow" aria-hidden="true">↓</div>
            <div id="late-card" class="pipeline-node" data-stage="2" role="button" aria-expanded="true" aria-label="Text Extraction - click to expand">
              <div class="pn-title">Text Extraction</div>
              <div class="pn-sub">HTML → clean text · Remove navigation &amp; CSS</div>
              <div class="pn-detail">Raw HTML contains div tags, CSS, JavaScript, navigation menus, and ads. Parsers extract just the meaningful text content. This is harder than it sounds.</div>
            </div>
          </div>
        </div>
      </section>
    `

    const decision = classifyContentUnit(document.querySelector('#late-card')!)
    const ids = collectHighConfidenceReadingUnits(document.body).map(node => node.id)

    expect(decision.action).toBe('allow')
    expect(decision.kind).toBe('content-card')
    expect(decision.confidence).toBeGreaterThanOrEqual(0.72)
    expect(ids).toContain('late-card')
  })

  it('allows introductory notice blocks inside reading surfaces', () => {
    document.body.innerHTML = `
      <main>
        <section id="welcome" class="alert alert-info">
          Ziggit is a forum for those interested in, or who are currently programming in the Zig Programming Language.
          We hope you find what you're looking for, or help others to do just that.
        </section>
      </main>
    `

    const decision = classifyContentUnit(document.querySelector('#welcome')!)

    expect(decision.action).toBe('allow')
    expect(decision.kind).toBe('content-card')
  })

  it('skips promotional cards instead of treating them as content cards', () => {
    document.body.innerHTML = `
      <main>
        <section id="promo" class="promo-card">
          <h2>Subscribe to our newsletter</h2>
          <p>Join today to receive marketing updates and sponsored offers.</p>
          <button>Sign up</button>
        </section>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#promo')!).action).toBe('skip')
  })

  it('skips single-link advertisement blocks as interface noise', () => {
    document.body.innerHTML = `
      <main>
        <section id="top-ad" class="ad-banner advertisement">
          <a href="/sponsor">Advertisement</a>
        </section>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#top-ad')!).action).toBe('skip')
  })

  it.each([
    ['promo-copy', 'This promotion is available for Pro, Max, and Team plans. The article explains which accounts qualify, why the limit changes, and how the usage window works.'],
    ['popular-copy', 'The popular explanation misses the hardware constraints. This paragraph compares the design choices and remains normal article prose.'],
    ['share-copy', 'The share of total memory bandwidth matters because each stage waits for the previous one. The sentence is about resource allocation, not social sharing.'],
    ['newsletter-copy', 'The newsletter version includes a short summary before the technical details. The paragraph still describes the article itself rather than a sign-up module.']
  ])('does not classify readable prose as noise just because it has a noisy class: %s', (id, text) => {
    document.body.innerHTML = `<main><p id="${id}" class="${id}">${text}</p></main>`

    expect(classifyContentUnit(document.querySelector(`#${id}`)!).action).not.toBe('skip')
  })

  it('does not prune readable prose subtrees just because their class has a noise word', () => {
    document.body.innerHTML = `
      <main>
        <section id="newsletter-panel" class="newsletter-update">
          <p>This newsletter article explains how the system behaves under sustained load. The paragraph has enough context to be translated as normal prose.</p>
        </section>
      </main>
    `

    const scanContext = createScanContext()

    expect(isObviousUiSubtree(scanContext, document.querySelector('#newsletter-panel')!)).toBe(false)
  })

  it('does not skip readable prose just because it contains file-related words', () => {
    document.body.innerHTML = `
      <main>
        <div id="download-prose">Then they let you download the image or they send you prints.</div>
        <div id="generated-name-prose">The filename is generated after upload so the customer can recognize the edited image later.</div>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#download-prose')!).action).not.toBe('skip')
    expect(classifyContentUnit(document.querySelector('#generated-name-prose')!).action).not.toBe('skip')
  })

  it('does not skip short complete prose with a noisy class', () => {
    document.body.innerHTML = `
      <main>
        <p id="short-promo" class="promo-copy">This promotion paragraph is actual article prose. It explains the policy instead of asking the reader to sign up.</p>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#short-promo')!).action).not.toBe('skip')
  })

  it('does not skip pure text div prose with a noisy class', () => {
    document.body.innerHTML = `
      <main>
        <div id="plain-newsletter" class="newsletter-note">The newsletter note is written as a plain text div. It is still a complete paragraph that should be translated.</div>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#plain-newsletter')!).action).not.toBe('skip')
  })

  it('does not treat noise words in ordinary link URLs as interactive noise actions', () => {
    document.body.innerHTML = `
      <main>
        <p id="shared-url-prose" class="promo-note">
          This article paragraph explains how storage engines coordinate writes, checkpoints, and replication under sustained load.
          The linked guide is supporting context rather than a sharing widget:
          <a href="/guides/how-to-share-data">implementation guide</a>.
        </p>
        <p id="neutral-url-prose" class="promo-note">
          This article paragraph explains how storage engines coordinate writes, checkpoints, and replication under sustained load.
          The linked guide is supporting context rather than a sharing widget:
          <a href="/guides/storage-engine">implementation guide</a>.
        </p>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#shared-url-prose')!).action).not.toBe('skip')
    expect(classifyContentUnit(document.querySelector('#neutral-url-prose')!).action).not.toBe('skip')
  })

  it('lets strong prose evidence override noisy naming even when the prose contains a subscribe link', () => {
    document.body.innerHTML = `
      <main>
        <section id="newsletter-prose" class="newsletter-update">
          <p>
            This archive paragraph describes why some teams subscribe to annual support contracts during migration projects.
            It includes enough surrounding context to read as article prose, and the link is part of the sentence instead of a call-to-action module.
            <a href="/accounts/plans">Subscribe plan details</a>
          </p>
        </section>
      </main>
    `

    expect(classifyContentUnit(document.querySelector('#newsletter-prose')!).action).not.toBe('skip')
  })

  it('does not prune readable prose subtrees just because they include a small button', () => {
    document.body.innerHTML = `
      <main>
        <section id="share-section" class="share-section">
          <p>This readable article block has enough body text to survive a small copy control. The author is explaining how a product behaves under sustained use.</p>
          <button>Copy</button>
        </section>
      </main>
    `

    const scanContext = createScanContext()

    expect(isObviousUiSubtree(scanContext, document.querySelector('#share-section')!)).toBe(false)
  })

  it('allows forum topic titles and excerpts but skips stats metadata', () => {
    document.body.innerHTML = `
      <div id="main-outlet" role="main">
        <table class="topic-list">
          <tbody>
            <tr class="topic-list-item">
              <td class="main-link" itemprop="itemListElement">
                <span class="link-top-line">
                  <a id="topic-title" class="title raw-link raw-topic-link" itemprop="url" href="/t/ai-policy">AI/LLM Policy Updates</a>
                </span>
                <p id="topic-excerpt" class="topic-excerpt">Hey all! The moderation team want to thank you for your input regarding AI showcases.</p>
                <a id="category" class="badge-category">Site Feedback</a>
                <a id="tag" class="discourse-tag">language</a>
              </td>
              <td id="replies" class="replies"><span class="posts">23</span></td>
              <td id="views" class="views">486</td>
              <td id="activity" class="activity">May 30, 2026</td>
            </tr>
          </tbody>
        </table>
      </div>
    `

    expect(classifyContentUnit(document.querySelector('#topic-title')!).kind).toBe('forum-topic')
    expect(classifyContentUnit(document.querySelector('#topic-excerpt')!).kind).toBe('forum-excerpt')
    expect(classifyContentUnit(document.querySelector('#category')!).action).toBe('skip')
    expect(classifyContentUnit(document.querySelector('#tag')!).action).toBe('skip')
    expect(classifyContentUnit(document.querySelector('#replies')!).action).toBe('skip')
    expect(classifyContentUnit(document.querySelector('#activity')!).action).toBe('skip')
  })

  it('collects only high-confidence reading units from mixed page chrome', () => {
    document.body.innerHTML = `
      <nav><a id="nav-docs">Docs</a><a id="nav-more">More</a></nav>
      <main>
        <h1 id="title">Downloading the Internet</h1>
        <section id="stage-card" class="stage-card">
          <strong>Common Crawl</strong>
          <div>Organizations like Common Crawl have been crawling the web since 2007, indexing billions of pages.</div>
        </section>
      </main>
    `

    const ids = collectHighConfidenceReadingUnits(document.body).map(node => node.id)

    expect(ids).toContain('title')
    expect(ids).toContain('stage-card')
    expect(ids).not.toContain('nav-docs')
    expect(ids).not.toContain('nav-more')
  })
})
