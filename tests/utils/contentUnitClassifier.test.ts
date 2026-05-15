import { beforeEach, describe, expect, it } from 'vitest'

import { classifyContentUnit, collectHighConfidenceReadingUnits } from '@/entrypoints/utils/contentUnitClassifier'

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

  it('allows forum topic titles and excerpts but skips stats metadata', () => {
    document.body.innerHTML = `
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

    expect(classifyContentUnit(document.querySelector('#topic-title')!).kind).toBe('forum-topic')
    expect(classifyContentUnit(document.querySelector('#topic-excerpt')!).kind).toBe('forum-excerpt')
    expect(classifyContentUnit(document.querySelector('#category')!).action).toBe('skip')
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
