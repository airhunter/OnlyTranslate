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
