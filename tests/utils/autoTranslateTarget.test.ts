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

import { resolveAutoTranslateTarget } from '@/entrypoints/main/trans'

describe('resolveAutoTranslateTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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
    expect(target.grabOptions?.siteCompatMode).toBe('smart')
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
})
