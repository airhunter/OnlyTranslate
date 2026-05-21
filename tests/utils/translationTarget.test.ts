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
})
