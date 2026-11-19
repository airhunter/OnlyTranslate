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

import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDomTextUnits } from '@/entrypoints/main/translationTarget/unitizer'
import { getReadingBlockTargets } from '@/entrypoints/main/translationTarget/readingBlocks'
import { createScanContext } from '@/entrypoints/main/translationTarget/scanContext'
import { siteProfiles } from '@/entrypoints/main/siteProfiles'
import { decideTranslationTarget } from '@/entrypoints/main/translationTarget/decision'
import { readFileSync } from 'node:fs'

describe('translationTarget', () => {
  const originalLocation = window.location

  beforeEach(() => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    })
  })

  it('lets the Medium profile allow related article content without allowing metadata', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://towardsdatascience.com/i-reduced-my-pandas-runtime-by-95-heres-what-i-was-doing-wrong/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article id="article">
          <h1 id="title">I Reduced My Pandas Runtime by 95% — Here's What I Was Doing Wrong</h1>
          <p id="body">Most slow Pandas code works until it does not. This article explains hidden bottlenecks in row-wise operations.</p>
          <p id="body-2">The examples compare vectorized operations with loops and show why memory layout matters.</p>
        </article>
      </main>
      <section class="author-social-links">
        <a id="social-youtube" href="https://www.youtube.com/@author">YouTube</a>
      </section>
      <section id="related" class="related-articles">
        <h2>Related Articles</h2>
        <div class="post-card">
          <a href="/related-one">
            <h3 id="related-title">Write Pandas Like a Pro With Method Chaining Pipelines</h3>
          </a>
          <p id="related-summary">Master method chaining, assign, and pipe to write cleaner, testable Pandas code.</p>
          <p id="related-meta">April 15, 2024 · 13 min read</p>
        </div>
      </section>
    `

    const ids = resolveAutoTranslationTarget('smart').nodes.map(node => node.id)

    expect(ids).toContain('body')
    expect(ids).toContain('related-title')
    expect(ids).toContain('related-summary')
    expect(ids).not.toContain('related-meta')
    expect(ids).not.toContain('social-youtube')
  })

  it('unitizes GitHub markdown lists into list item translation targets', () => {
    document.body.innerHTML = `
      <article class="markdown-body">
        <ul id="news-list">
          <li id="news-1">Released v0.2.0 with sustained objectives across turns and a real agent-loop refactor.</li>
          <li id="news-2">Goal mode supports visible multi-step progress and long-horizon missions in chat.</li>
        </ul>
      </article>
    `

    const ids = collectDomTextUnits(document.querySelector('.markdown-body')!).map(node => node.id)

    expect(ids).toContain('news-1')
    expect(ids).toContain('news-2')
    expect(ids).not.toContain('news-list')
  })

  it('resolves GitHub markdown list items through profile expansion', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article class="markdown-body entry-content">
          <h1 id="readme-title">Nanobot README</h1>
          <ul id="news-list">
            <li id="news-1">Released v0.2.0 with sustained objectives across turns and a real agent-loop refactor.</li>
            <li id="news-2">Goal mode supports visible multi-step progress and long-horizon missions in chat.</li>
          </ul>
        </article>
      </main>
    `

    const ids = resolveAutoTranslationTarget('smart').nodes.map(node => node.id)

    expect(ids).toContain('readme-title')
    expect(ids).toContain('news-1')
    expect(ids).toContain('news-2')
    expect(ids).not.toContain('news-list')
  })

  it('lets the CNN profile translate lead package headlines without treating lead as an ad', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://edition.cnn.com/?refresh=1'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="container container_lead-package" data-component-name="container">
          <div class="container__title container_lead-package__title" data-editable="titleLink">
            <a class="container__title-url container_lead-package__title-url">
              <h2 id="lead-title" class="container__title_url-text container_lead-package__title_url-text" data-editable="title">
                Iran's military is rebuilding much faster than expected
              </h2>
              <p id="show-all" class="container__title_url-sub-text container_lead-package__title_url-sub-text">Show all</p>
            </a>
          </div>
          <ul class="container__field-links container_lead-package__field-links">
            <li class="card container__item container_lead-package__item" data-component-name="card">
              <a class="container__link">
                <div class="container__headline container_lead-package__headline">
                  <span id="card-headline" class="container__headline-text" data-editable="headline">
                    Drone production has restarted and Iran remains a threat to US allies in the region
                  </span>
                </div>
              </a>
            </li>
          </ul>
        </div>
        <div id="ad-wrapper" class="container__ads">
          <span id="ad-copy">Advertisement</span>
        </div>
      </main>
    `

    const ids = resolveAutoTranslationTarget('smart').nodes.map(node => node.id)

    expect(ids).toContain('lead-title')
    expect(ids).toContain('card-headline')
    expect(ids).not.toContain('show-all')
    expect(ids).not.toContain('ad-copy')
  })

  it('keeps CNN article elevate headline as its own translation target', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://edition.cnn.com/2026/05/21/politics/iran-military-rebuild'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <section class="layout-article-elevate__top layout__top" data-editable="top" data-track-zone="top">
          <div class="headline-elevate vossi-headline_elevate headline--has-lowertext" data-component-name="headline">
            <div class="headline__wrapper">
              <h1 id="maincontent" data-editable="headlineText" class="headline__text vossi-headline_elevate__text inline-placeholder">
                Iran rebuilding military industrial base faster than expected, already producing drones, according to US intel
              </h1>
            </div>
            <div class="headline__footer vossi-headline_elevate__footer">
              <div class="headline__sub-text vossi-headline_elevate__sub-text">
                <div class="vossi-byline_elevate byline-elevate" data-component-name="byline">
                  <div id="byline-authors" class="byline__authors">By <span class="byline__name">Zachary Cohen</span>, <span class="byline__name">Natasha Bertrand</span></div>
                </div>
                <div class="timestamp-elevate vossi-timestamp_elevate">
                  <span id="timestamp" class="timestamp__time-since">20 hr ago</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <article>
          <p id="body-paragraph">The United States believes Iran is rebuilding parts of its military industrial base faster than expected.</p>
          <p id="body-paragraph-2">Officials say the renewed drone production remains a concern for US allies in the region.</p>
        </article>
      </main>
    `

    const ids = resolveAutoTranslationTarget('smart').nodes.map(node => node.id)

    expect(ids).toContain('maincontent')
    expect(ids).toContain('body-paragraph')
    expect(ids).not.toContain('byline-authors')
    expect(ids).not.toContain('timestamp')
  })
})

describe('reading list context', () => {
  const first = 'Keep a local copy of the working configuration so every administrator can inspect the settings before the next upgrade.'
  const second = 'Record changes in a shared log so another volunteer can reproduce the result and explain differences during a later review.'
  const originalLocation = window.location

  function arrange(items: string, lead = 'Consider these approaches') {
    document.body.innerHTML = `<main id="root"><p>The guide explains how the community can prepare for the next season and share its equipment.</p></main>
      <aside><strong>Practical advice</strong><p id="list-lead">${lead}</p><ol>${items}</ol></aside>`
    return { lead: document.querySelector('#list-lead')!, root: document.querySelector('#root')! }
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })

  it.each([
    ['https://unadapted.example/guide', `<li>${first}</li><li>${second}</li>`, 'Consider these approaches'],
    ['https://another.invalid/notes', `<li><div>${first}</div></li><li><div>${second}</div></li>`, '留意下面几种做法'],
    ['https://unadapted.example/reference', `<li><div><code>:focus</code> ${first}</div></li><li><div>${second}</div></li>`, 'Consider these approaches'],
    ['https://www.joshwcomeau.com/css/has/', `<li><p>${first}</p></li><li><p>${second}</p></li>`, 'There are two approaches involving <code>:has</code> to consider:']
  ])('uses independent reading items on %s without a site selector', (url, items, text) => {
    Object.defineProperty(window, 'location', { value: new URL(url), configurable: true })
    const { lead, root } = arrange(items, text)
    expect(getReadingBlockTargets(lead, createScanContext(), root)).toContain(lead)
  })

  it.each([
    ['bare pre', `<li><pre>${first}</pre></li><li><pre>${second}</pre></li>`],
    ['editable descendants', `<li><div contenteditable="true">${first}</div></li><li><div contenteditable="plaintext-only">${second}</div></li>`],
    ['linked controls', `<li><a href="/one">${first}</a></li><li><a href="/two">${second}</a></li>`],
    ['checkbox options', `<li><input type="checkbox">${first}</li><li><input type="checkbox">${second}</li>`],
  ])('does not treat %s as two reading items', (_name, items) => {
    const { lead, root } = arrange(items)
    expect(getReadingBlockTargets(lead, createScanContext(), root)).not.toContain(lead)
  })

  // A single independent reading unit now supplies context; hidden/metadata/code
  // siblings add no evidence and do not invalidate the valid unit.
  it.each([
    ['one item with two paragraphs', `<li><p>${first}</p><p>${second}</p></li>`],
    ['one hidden item', `<li>${first}</li><li hidden>${second}</li>`],
    ['one hidden descendant', `<li>${first}</li><li><p>More<span hidden>${second}</span></p></li>`],
    ['protected code', `<li>${first}</li><li><p><code>const explanation = "${second}";</code></p></li>`],
    ['metadata', `<li>${first}</li><li><p class="metadata">${second}</p></li>`]
  ])('uses valid remaining context with %s', (_name, items) => {
    const { lead, root } = arrange(items)
    expect(getReadingBlockTargets(lead, createScanContext(), root)).toContain(lead)
  })

  it('uses remaining readable prose without borrowing protected contents', () => {
    const { lead, root } = arrange(`<li>${first}<pre>command --help</pre></li><li>${second}<div contenteditable="true">Editor</div></li>`)
    expect(getReadingBlockTargets(lead, createScanContext(), root)).toContain(lead)
  })

  it('does not borrow list evidence from an inherited editable region', () => {
    const { lead, root } = arrange(`<li>${first}</li><li>${second}</li>`)
    lead.parentElement!.setAttribute('contenteditable', 'true')
    expect(getReadingBlockTargets(lead, createScanContext(), root)).not.toContain(lead)
  })

  it('keeps promotional lists excluded even when the prose is long', () => {
    const { lead, root } = arrange(`<li>${first}</li><li>${second}</li>`)
    lead.parentElement!.insertAdjacentHTML('beforeend', '<a href="/offer">Buy now</a>')
    expect(getReadingBlockTargets(lead, createScanContext(), root)).not.toContain(lead)
  })

  it('does not take context from an ARIA menu', () => {
    const { lead, root } = arrange(`<li>${first}</li><li>${second}</li>`)
    lead.nextElementSibling!.setAttribute('role', 'menu')
    expect(getReadingBlockTargets(lead, createScanContext(), root)).not.toContain(lead)
  })

  it.each(['supplemental', 'dynamic'] as const)('charges list evidence to the %s budget', budget => {
    const { lead, root } = arrange(`<li><div>${first}</div></li><li><div>${second}</div></li>`)
    const context = createScanContext({ supplementalBudget: 3, dynamicBudget: 3 })
    expect(getReadingBlockTargets(lead, context, root, budget)).not.toContain(lead)
    expect(context.budgetUsage[budget]).toBe(3)
    expect(context.budgetUsage[budget === 'dynamic' ? 'supplemental' : 'dynamic']).toBe(0)
    expect(context.stats.budgetExceeded).toBe(true)
    expect(context.stats.budgetDeferredReadingSubtrees).toBeGreaterThan(0)
  })
})

describe('explicitly approved metadata adaptations', () => {
  const originalLocation = window.location
  const cases = [
    { profile: 'blogger', fixture: 'blogger-followers-widget.html', url: 'https://another-author.blogspot.com/workshop', target: '#followers-title', text: 'People reading this blog' },
    { profile: 'claude-nagdy', fixture: 'claude-course-metadata.html', url: 'https://claude.nagdy.me/learn/shared-workspace/', target: '#level-line', text: 'Intermediate' }
  ]

  function render(sample: typeof cases[number], url = sample.url) {
    Object.defineProperty(window, 'location', { value: new URL(url), configurable: true })
    document.body.innerHTML = readFileSync('tests/fixtures/translation-target/' + sample.fixture, 'utf8')
    return document.querySelector(sample.target)!
  }

  it.each(cases)('demonstrates the actual exclusion added by $profile', sample => {
    const profile = siteProfiles.find(profile => profile.id === sample.profile)!
    const currentSkip = profile.skipTarget!
    profile.skipTarget = (node, context) => currentSkip(node, { ...context, scope: 'full' })
    try {
      render(sample)
      const oldText = resolveAutoTranslationTarget('smart').nodes.map(node => node.textContent).join(' ')
      expect(oldText).toContain(sample.text)
    } finally { profile.skipTarget = currentSkip }
    render(sample)
    const newText = resolveAutoTranslationTarget('smart').nodes.map(node => node.textContent).join(' ')
    expect(newText).not.toContain(sample.text)
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })

  it.each(cases)('keeps $profile exclusions in smart fallback but leaves full unchanged', sample => {
    const node = render(sample)
    for (const mode of ['smart', 'full'] as const) {
      const decision = decideTranslationTarget({ node, source: 'grab-node' }, { scope: 'smart', mode, contentRoot: document.body })
      expect(decision.policy).toBe('hard-skip')
    }
    expect(decideTranslationTarget({ node, source: 'grab-node' }, { scope: 'full', mode: 'full', contentRoot: document.body }).policy).toBe('allow')
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })

  it.each(['https://other.nagdy.me/learn/shared-workspace/', 'https://claude.nagdy.me/projects/shared-workspace/'])('does not apply course metadata exclusion to %s', url => {
    const node = render(cases[1], url)
    const profile = siteProfiles.find(profile => profile.id === 'claude-nagdy')!
    expect(profile.skipTarget!(node, { scope: 'smart', mode: 'smart', contentRoot: document.body })).toBe(false)
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })

  it('keeps a readable sentence even when it is styled like a course badge', () => {
    const row = render(cases[1])
    row.children[0].textContent = 'Keep a copy before upgrading.'
    row.children[1].textContent = '20 minutes'
    const profile = siteProfiles.find(profile => profile.id === 'claude-nagdy')!
    expect(profile.skipTarget!(row, { scope: 'smart', mode: 'smart', contentRoot: document.body })).toBe(false)
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })
})
