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

import { collectDynamicTranslationNodes, resolveAutoTranslateTarget } from '@/entrypoints/main/trans'

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
