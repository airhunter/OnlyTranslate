import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCanUseBatchTranslationForCurrentConfig = vi.hoisted(() => vi.fn(() => false))
const mockHasForegroundTranslationWork = vi.hoisted(() => vi.fn(() => false))
const mockCancelAllTranslations = vi.hoisted(() => vi.fn())
const mockInsertFailedTip = vi.hoisted(() => vi.fn())
const mockShowExtensionReloadedTip = vi.hoisted(() => vi.fn())
const mockConfig = vi.hoisted(() => ({
  translationScope: 'smart',
  on: true,
  service: 'microsoft',
  display: 1,
  style: 0,
  to: 'zh-Hans',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en',
  maxConcurrentTranslations: 6,
  model: {} as Record<string, string>,
  token: {} as Record<string, string>,
  customProviders: []
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  canUseBatchTranslationForCurrentConfig: mockCanUseBatchTranslationForCurrentConfig,
  cancelAllTranslations: mockCancelAllTranslations,
  hasForegroundTranslationWork: mockHasForegroundTranslationWork,
  isExtensionContextInvalidatedError: vi.fn((error: unknown) => {
    return error instanceof Error && /extension context invalidated|receiving end does not exist/i.test(error.message)
  }),
  isTranslationCancelledError: vi.fn((error: unknown) => {
    return error instanceof Error && error.name === 'TranslationCancelledError'
  }),
  translateText: vi.fn()
}))

vi.mock('@/entrypoints/utils/icon', () => ({
  insertFailedTip: mockInsertFailedTip,
  insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() })),
  showExtensionReloadedTip: mockShowExtensionReloadedTip
}))

vi.mock('@/entrypoints/utils/translationDirection', () => ({
  shouldTranslateText: vi.fn(() => true)
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

import { autoTranslateEnglishPage, collectDynamicTranslationNodes, handleBilingualTranslation, handleBtnTranslation, handleSingleTranslation, handleTranslation, originalContents, resolveAutoTranslateTarget, restoreOriginalContent } from '@/entrypoints/main/trans'
import { DIRECT_TEXT_TARGET_ATTR, grabAllNode, grabNode } from '@/entrypoints/main/dom'
import { collectTranslationTargets } from '@/entrypoints/main/translationTarget/collect'
import { getBilingualAppendTarget } from '@/entrypoints/main/translationTarget/decision'
import { getDynamicTranslationScanRoot } from '@/entrypoints/main/translationTarget/dynamic'
import { createScanContext } from '@/entrypoints/main/translationTarget/scanContext'
import {
  BILINGUAL_CONTENT_CLASS,
  BILINGUAL_TEXT_CLASS,
  BILINGUAL_WRAPPER_CLASS,
  TRANSLATED_ATTR,
  TRANSLATED_ID_ATTR
} from '@/entrypoints/main/translationTarget/constants'
import { siteProfiles } from '@/entrypoints/main/siteProfiles'
import { translateText } from '@/entrypoints/utils/translateApi'
import { shouldTranslateText } from '@/entrypoints/utils/translationDirection'

describe('resolveAutoTranslateTarget behavior', () => {
  const originalLocation = window.location
  const originalDocumentLocation = document.location

  beforeEach(() => {
    document.body.innerHTML = ''
    mockConfig.translationScope = 'smart'
    mockConfig.on = true
    mockConfig.service = 'microsoft'
    mockConfig.display = 1
    mockConfig.style = 0
    mockConfig.to = 'zh-Hans'
    mockConfig.bidirectionalTranslation = false
    mockConfig.bidirectionalTarget = 'en'
    mockConfig.maxConcurrentTranslations = 6
    mockCanUseBatchTranslationForCurrentConfig.mockReturnValue(false)
    mockHasForegroundTranslationWork.mockReturnValue(false)
    vi.clearAllMocks()
    vi.mocked(shouldTranslateText).mockReturnValue(true)
    vi.useRealTimers()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: originalDocumentLocation,
      configurable: true
    })
  })

  it('translates button text through the shared translateText entrypoint', async () => {
    vi.mocked(translateText).mockResolvedValue('开始操作')
    document.body.innerHTML = `<button id="action">Start action</button>`

    const button = document.querySelector('#action') as HTMLElement
    handleBtnTranslation(button)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(translateText).toHaveBeenCalledWith('Start action', document.title, expect.objectContaining({
      diagnostics: expect.objectContaining({ scene: 'hover' }),
    }))
    expect(button.innerText).toBe('开始操作')
  })

  it('applies and restores Google translation-only output without replacing inline elements', async () => {
    mockConfig.service = 'google'
    mockConfig.display = 0
    document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.</p>'
    const target = document.querySelector('#target') as HTMLElement
    const link = target.querySelector('a')!
    const nodeId = 'google-translation-only-target'
    target.setAttribute(TRANSLATED_ATTR, 'true')
    target.setAttribute(TRANSLATED_ID_ATTR, nodeId)
    originalContents.set(nodeId, target.innerHTML)

    vi.mocked(translateText).mockImplementation(async (origin: string) => {
      const template = document.createElement('template')
      template.innerHTML = origin
      const root = template.content.firstElementChild as HTMLElement
      ;(root.firstChild as Text).data = '阅读 '
      root.querySelector('a')!.textContent = '文档'
      ;(root.lastChild as Text).data = '。'
      return template.innerHTML
    })

    await handleSingleTranslation(target, false)

    expect(translateText).toHaveBeenCalledWith(
      expect.stringContaining('data-onlytranslate-google-root'),
      document.title,
      expect.objectContaining({ textFormat: 'html' }),
    )
    expect(target.querySelector('a')).toBe(link)
    expect(target.textContent).toBe('阅读 文档。')

    restoreOriginalContent()

    expect(translateText).toHaveBeenCalledTimes(1)
    expect(target.querySelector('a')).toBe(link)
    expect(target.textContent).toBe('Read the docs.')
    expect(target.hasAttribute(TRANSLATED_ATTR)).toBe(false)
    expect(target.hasAttribute(TRANSLATED_ID_ATTR)).toBe(false)
  })

  it('allows batching only for automatic webpage translation targets', async () => {
    class ImmediateIntersectionObserver {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockResolvedValue('译文')
    document.body.innerHTML = `
      <main>
        <article>
          <h1>Batch Translation Queue</h1>
          <p>Teams use automatic webpage translation to process several readable paragraphs.</p>
          <p>The queue can combine compatible requests without changing page insertion behavior.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(vi.mocked(translateText).mock.calls.some(([, , options]) => {
        return options?.allowBatch === true && options.priority === 'high'
      })).toBe(true)
    } finally {
      restoreOriginalContent()
    }
  })

  it('keeps initial automatic targets visibility-gated when batch is supported', async () => {
    const observedTargets: Element[] = []
    class PassiveIntersectionObserver {
      observe(target: Element) {
        observedTargets.push(target)
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    mockCanUseBatchTranslationForCurrentConfig.mockReturnValue(true)
    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockResolvedValue('译文')
    document.body.innerHTML = `
      <main>
        <article>
          <h1>Batch Translation Queue</h1>
          <p>Automatic webpage translation should send collected page targets into the batch queue.</p>
          <p>It should not wait for every paragraph to become visible one at a time.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(observedTargets.length).toBeGreaterThan(0)
      expect(translateText).not.toHaveBeenCalled()
    } finally {
      restoreOriginalContent()
    }
  })

  it('starts non-visible initial targets as one-at-a-time background translations', async () => {
    vi.useFakeTimers()
    class PassiveIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    let resolveTranslation!: (value: string) => void
    mockConfig.maxConcurrentTranslations = 3
    mockCanUseBatchTranslationForCurrentConfig.mockReturnValue(true)
    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockReturnValue(new Promise(resolve => {
      resolveTranslation = resolve
    }))
    document.body.innerHTML = `
      <main>
        <article>
          <h1>Background Translation Queue</h1>
          <p>The first hidden paragraph can be translated after visible work is idle.</p>
          <p>The second hidden paragraph waits until the first background task finishes.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await vi.advanceTimersByTimeAsync(1000)

      const backgroundCalls = vi.mocked(translateText).mock.calls.filter(([, , options]) => {
        return options?.priority === 'background'
      })
      expect(backgroundCalls).toHaveLength(1)
      expect(backgroundCalls[0][2]).toMatchObject({
        allowBatch: true,
        priority: 'background'
      })

      await vi.advanceTimersByTimeAsync(1000)
      expect(vi.mocked(translateText).mock.calls.filter(([, , options]) => {
        return options?.priority === 'background'
      })).toHaveLength(1)

      resolveTranslation('后台译文')
      await vi.advanceTimersByTimeAsync(250)

      expect(vi.mocked(translateText).mock.calls.filter(([, , options]) => {
        return options?.priority === 'background'
      })).toHaveLength(2)
    } finally {
      restoreOriginalContent()
      vi.useRealTimers()
    }
  })

  it('submits background translations even while foreground work is active', async () => {
    vi.useFakeTimers()
    class PassiveIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    mockCanUseBatchTranslationForCurrentConfig.mockReturnValue(true)
    mockHasForegroundTranslationWork.mockReturnValue(true)
    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockResolvedValue('后台译文')
    document.body.innerHTML = `
      <main>
        <article>
          <h1>Background Translation Priority</h1>
          <p>The hidden paragraph should still enter the background queue.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await vi.advanceTimersByTimeAsync(1000)

      expect(vi.mocked(translateText).mock.calls.some(([, , options]) => {
        return options?.allowBatch === true && options.priority === 'background'
      })).toBe(true)
    } finally {
      restoreOriginalContent()
      vi.useRealTimers()
    }
  })

  it('submits multiple non-visible background translations with reserved foreground capacity', async () => {
    vi.useFakeTimers()
    class PassiveIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    mockCanUseBatchTranslationForCurrentConfig.mockReturnValue(true)
    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockReturnValue(new Promise(() => {}))
    document.body.innerHTML = `
      <main>
        <article>
          <h1>Background Translation Window</h1>
          <p>The first hidden paragraph should enter the background queue.</p>
          <p>The second hidden paragraph should enter the background queue.</p>
          <p>The third hidden paragraph should enter the background queue.</p>
          <p>The fourth hidden paragraph should enter the background queue.</p>
          <p>The fifth hidden paragraph should wait for a reserved foreground slot.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await vi.advanceTimersByTimeAsync(1000)

      expect(vi.mocked(translateText).mock.calls.filter(([, , options]) => {
        return options?.priority === 'background'
      })).toHaveLength(4)
    } finally {
      restoreOriginalContent()
      vi.useRealTimers()
    }
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

  it('keeps Wikipedia paragraphs whole when inline metadata exceeds the markup size limit', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://en.wikipedia.org/wiki/Jordan'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="mw-parser-output">
          <h1 id="wiki-title">Jordan</h1>
          <p id="wiki-lead">
            <b id="wiki-country">Jordan</b>,
            <sup id="wiki-reference"><a href="#cite_note-a">[a]</a></sup>
            officially the <b>Hashemite Kingdom of Jordan</b>, is a country in the
            <a id="wiki-region" href="/wiki/Southern_Levant">Southern Levant</a>
            region of West Asia. Jordan is bordered by Syria to the north and Iraq to the east.
          </p>
        </div>
      </main>
    `

    document.querySelector('#wiki-reference')?.setAttribute(
      'data-mw',
      JSON.stringify({ body: 'x'.repeat(5000) })
    )

    const paragraph = document.querySelector('#wiki-lead')!
    const target = resolveAutoTranslateTarget('smart')
    const paragraphTargets = target.nodes.filter(node => node === paragraph || paragraph.contains(node))

    expect(paragraph.outerHTML.length).toBeGreaterThan(4096)
    expect(paragraphTargets).toEqual([paragraph])
  })

  it('keeps Reddit multimedia text leaves when player markup exceeds the target size limit', () => {
    const redditUrl = new URL('https://www.reddit.com/r/PinoyProgrammer/comments/1u4tuvb/multimedia-post/')
    Object.defineProperty(window, 'location', {
      value: redditUrl,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: redditUrl,
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <shreddit-post view-context="CommentsPage" post-type="multi_media">
          <h1 id="post-title" slot="title">I'M BEGINNING TO BELIEVE</h1>
          <shreddit-post-text-body id="post-body-host" slot="text-body">
            <div slot="text-body" data-post-click-location="text-body">
              <div property="schema:articleBody">
                <p id="post-first">I have been learning C++ by building a small terminal game.</p>
                <p id="post-second">I now understand more about memory management.</p>
                <figure id="video-player">
                  <p id="video-error">This video could not be loaded.</p>
                  <video></video>
                </figure>
              </div>
            </div>
          </shreddit-post-text-body>
        </shreddit-post>
      </main>
    `

    document.querySelector('#video-player')?.setAttribute('data-player-state', 'x'.repeat(5000))

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map(node => node.id).filter(Boolean)

    expect(document.querySelector('#post-body-host')?.outerHTML.length).toBeGreaterThan(4096)
    expect(ids).toEqual(expect.arrayContaining(['post-title', 'post-first', 'post-second']))
    expect(ids).not.toContain('post-body-host')
    expect(ids).not.toContain('video-player')
    expect(ids).not.toContain('video-error')
  })

  it('rescans a Reddit comments-page post after hydration replaces the original host', () => {
    const redditUrl = new URL('https://www.reddit.com/r/PinoyProgrammer/comments/1u4tuvb/multimedia-post/')
    Object.defineProperty(window, 'location', {
      value: redditUrl,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: redditUrl,
      configurable: true
    })
    document.body.innerHTML = `
      <shreddit-post id="old-post" view-context="CommentsPage">
        <h1 slot="title">Loading post</h1>
      </shreddit-post>
    `

    const oldContentRoot = document.querySelector('#old-post') as Element
    const replacement = document.createElement('shreddit-post')
    replacement.id = 'hydrated-post'
    replacement.setAttribute('view-context', 'CommentsPage')
    replacement.setAttribute('post-type', 'multi_media')
    replacement.innerHTML = `
      <h1 id="hydrated-title" slot="title">I'M BEGINNING TO BELIEVE</h1>
      <shreddit-post-text-body id="hydrated-body-host" slot="text-body">
        <div slot="text-body" data-post-click-location="text-body">
          <div property="schema:articleBody">
            <p id="hydrated-first">I have been learning C++ by building a small terminal game.</p>
            <p id="hydrated-second">I now understand more about memory management.</p>
            <figure id="hydrated-player"><video></video></figure>
          </div>
        </div>
      </shreddit-post-text-body>
    `
    oldContentRoot.replaceWith(replacement)

    const grabOptions = {
      siteCompatMode: 'smart' as const,
      scanContext: createScanContext()
    }
    const scanRoot = getDynamicTranslationScanRoot(
      replacement,
      oldContentRoot,
      'smart',
      grabOptions
    )
    const nodes = collectDynamicTranslationNodes(
      replacement,
      oldContentRoot,
      'smart',
      grabOptions
    )
    const ids = nodes.map(node => node.id).filter(Boolean)

    expect(scanRoot).toBe(replacement)
    expect(ids).toEqual(expect.arrayContaining(['hydrated-title', 'hydrated-first', 'hydrated-second']))
    expect(ids).not.toContain('hydrated-body-host')
    expect(ids).not.toContain('hydrated-player')
  })

  it('projects bilingual Reddit post text through its named shadow slot', async () => {
    const redditUrl = new URL('https://www.reddit.com/r/PinoyProgrammer/comments/1s950b7/claude-pro/')
    Object.defineProperty(window, 'location', {
      value: redditUrl,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: redditUrl,
      configurable: true
    })
    vi.mocked(translateText).mockResolvedValue('Reddit 帖子正文译文。')
    document.body.innerHTML = `
      <shreddit-post-text-body id="post-body" slot="text-body">
        <div slot="text-body" data-post-click-location="text-body">
          <div id="post-body-content">
            <p>Developers are comparing the model capability and usage limits before choosing one plan.</p>
          </div>
        </div>
      </shreddit-post-text-body>
    `

    const postBody = document.querySelector('#post-body') as HTMLElement
    const shadowRoot = postBody.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = '<slot name="text-body"></slot>'

    await handleBilingualTranslation(postBody, false)

    const insertion = postBody.querySelector<HTMLElement>(`:scope > .${BILINGUAL_CONTENT_CLASS}`)
    const textBodySlot = shadowRoot.querySelector('slot') as HTMLSlotElement
    expect(insertion?.getAttribute('slot')).toBe('text-body')
    expect(insertion?.querySelector(`.${BILINGUAL_TEXT_CLASS}`)?.textContent).toBe('Reddit 帖子正文译文。')
    expect(textBodySlot.assignedElements()).toContain(insertion)
  })

  it('translates prose wrapped in code tags instead of restoring it as protected code', async () => {
    vi.mocked(translateText).mockResolvedValue('请将这个沙箱作为安全环境进行全面测试，并严格限制资源访问。目标是安全执行用户提供的数据转换任务。')
    document.body.innerHTML = `
      <blockquote id="research-task">
        <p><code>Put this sandbox through its paces as a fast secure environment. Explore what it would take to run untrusted Python and JavaScript code with strict limits on RAM, CPU time, network access, and filesystem access.</code></p>
        <p><code>Goal is to execute user-provided tasks safely for practical workflows such as recurring data transformations and document processing.</code></p>
      </blockquote>
    `

    const quote = document.querySelector<HTMLElement>('#research-task')!
    await handleBilingualTranslation(quote, false)

    const origin = vi.mocked(translateText).mock.calls[0]?.[0]
    const translation = quote.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)
    expect(origin).toContain('Put this sandbox through its paces')
    expect(origin).toContain('Goal is to execute user-provided tasks safely')
    expect(origin).not.toContain('__ONLY_TRANSLATE_INLINE_')
    expect(translation?.textContent).toContain('请将这个沙箱作为安全环境进行全面测试')
  })

  it('stacks Reddit post body translations when page styles force descendant spans inline', async () => {
    const redditUrl = new URL('https://www.reddit.com/r/odinlang/')
    Object.defineProperty(window, 'location', {
      value: redditUrl,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: redditUrl,
      configurable: true
    })
    vi.mocked(translateText).mockResolvedValue('这是帖子正文的译文。')

    document.body.innerHTML = `
      <style>shreddit-post [property="schema:articleBody"] span { display: inline !important; }</style>
      <shreddit-post>
        <div data-post-click-location="text-body">
          <div property="schema:articleBody">
            <p id="post-paragraph">This paragraph is rendered inside Reddit's post component.</p>
            <ul>
              <li id="post-list-item">This list item is also rendered inside Reddit's post component.</li>
            </ul>
          </div>
        </div>
      </shreddit-post>
    `
    const paragraph = document.querySelector<HTMLElement>('#post-paragraph')!
    const listItem = document.querySelector<HTMLElement>('#post-list-item')!

    await Promise.all([
      handleBilingualTranslation(paragraph, false),
      handleBilingualTranslation(listItem, false)
    ])

    for (const target of [paragraph, listItem]) {
      const insertion = target.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)!
      const translation = insertion.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)!
      expect(insertion.firstElementChild?.tagName).toBe('BR')
      expect(insertion.lastElementChild).toBe(translation)
      expect(window.getComputedStyle(insertion).display).toBe('inline')
      expect(window.getComputedStyle(translation).display).toBe('inline')
      expect(translation.style.getPropertyPriority('display')).toBe('')
    }
  })

  it('separates inline Reddit feed paragraphs and expands their clipping containers', async () => {
    const redditUrl = new URL('https://www.reddit.com/r/odinlang/')
    Object.defineProperty(window, 'location', {
      value: redditUrl,
      configurable: true
    })
    Object.defineProperty(document, 'location', {
      value: redditUrl,
      configurable: true
    })
    vi.mocked(translateText).mockResolvedValue('Reddit Feed 段落译文。')
    document.body.innerHTML = `
      <style>
        .feed-card-clip { height: 120px; overflow: hidden; }
        .feed-card-text-preview { height: 116px; overflow: hidden; text-overflow: ellipsis; }
        [property="schema:articleBody"] > p { display: inline; }
      </style>
      <shreddit-post>
        <div id="feed-card-clip" class="feed-card-clip overflow-hidden">
          <div id="feed-body" class="md feed-card-text-preview text-ellipsis line-clamp-3" property="schema:articleBody">
            <p id="feed-first">The first paragraph should remain separate from the next paragraph.</p>
            <p id="feed-second">The second paragraph should begin after the first translation.</p>
          </div>
        </div>
      </shreddit-post>
    `

    const first = document.querySelector<HTMLElement>('#feed-first')!
    await handleBilingualTranslation(first, false)

    const insertion = first.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)!
    const body = document.querySelector<HTMLElement>('#feed-body')!
    const clip = document.querySelector<HTMLElement>('#feed-card-clip')!
    expect([...insertion.children].map(child => child.tagName)).toEqual(['BR', 'SPAN', 'BR'])
    expect(body.style.height).toBe('auto')
    expect(body.style.maxHeight).toBe('none')
    expect(body.style.overflow).toBe('visible')
    expect(body.style.textOverflow).toBe('clip')
    expect(clip.style.height).toBe('auto')
    expect(clip.style.maxHeight).toBe('none')
    expect(clip.style.overflow).toBe('visible')
  })

  it('keeps normal-flow translations inline so they can wrap beside floats', async () => {
    vi.mocked(translateText).mockResolvedValue('浮动元素旁边的译文应该逐行排版。')
    document.body.innerHTML = `
      <style>.only-translate-bilingual-text { display: inline-block; }</style>
      <article>
        <figure style="float: right; width: 300px;">A floated figure</figure>
        <p id="float-paragraph">Translated prose should not become one atomic inline box beside floated content.</p>
      </article>
    `

    const paragraph = document.querySelector<HTMLElement>('#float-paragraph')!
    await handleBilingualTranslation(paragraph, false)

    const insertion = paragraph.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)!
    const translation = insertion.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)!
    expect(insertion.firstElementChild?.tagName).toBe('BR')
    expect(window.getComputedStyle(translation).display).toBe('inline')
    expect(translation.style.display).toBe('inline')
    expect(translation.style.width).toBe('')
  })

  it('keeps marker translations inline after a structural line break', async () => {
    mockConfig.style = 11
    vi.mocked(translateText).mockResolvedValue('结构性换行后的马克笔译文。')
    document.body.innerHTML = `
      <style>
        .only-translate-bilingual-text { display: inline-block; }
        .fluent-display-marker { display: inline; }
      </style>
      <p id="marker-paragraph">Marker translations should start on their own line.</p>
    `

    const paragraph = document.querySelector<HTMLElement>('#marker-paragraph')!
    await handleBilingualTranslation(paragraph, false)

    const insertion = paragraph.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)!
    const translation = insertion.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)!
    expect(insertion.firstElementChild?.tagName).toBe('BR')
    expect(translation.classList.contains('fluent-display-marker')).toBe(true)
    expect(window.getComputedStyle(translation).display).toBe('inline')
  })

  it('uses block insertion layout for flex translation targets in normal flow', async () => {
    vi.mocked(translateText).mockResolvedValue('研究代理会混合私有文档和外部工具。')
    document.body.innerHTML = `
      <article id="article" style="display: block;">
        <h1 id="headline" style="display: flex;">Research agents mix private documents with external tools.</h1>
      </article>
    `

    const headline = document.querySelector('#headline') as HTMLElement
    handleBilingualTranslation(headline, false)
    await new Promise(resolve => setTimeout(resolve, 0))

    const insertion = headline.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)
    const translation = insertion?.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)
    expect(headline.style.display).toBe('block')
    expect(insertion?.querySelector('br')).toBeNull()
    expect(insertion?.style.display).toBe('block')
    expect(insertion?.style.width).toBe('100%')
    expect(translation?.style.display).toBe('block')
    expect(translation?.style.width).toBe('100%')
  })

  it('preserves flex item layout when the translation target parent is flex', async () => {
    vi.mocked(translateText).mockResolvedValue('操作按钮保持在工具栏内。')
    document.body.innerHTML = `
      <div id="toolbar" style="display: flex;">
        <span id="toolbar-copy" style="display: flex;">Action button copy stays inside a toolbar.</span>
      </div>
    `

    const copy = document.querySelector('#toolbar-copy') as HTMLElement
    handleBilingualTranslation(copy, false)
    await new Promise(resolve => setTimeout(resolve, 0))

    const insertion = copy.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)
    const translation = insertion?.querySelector<HTMLElement>(`.${BILINGUAL_TEXT_CLASS}`)
    expect(copy.style.display).toBe('flex')
    expect(insertion?.querySelector('br')).toBeNull()
    expect(insertion?.style.display).toBe('')
    expect(insertion?.style.width).toBe('')
    expect(translation?.style.display).toBe('')
    expect(translation?.style.width).toBe('')
  })

  it('removes the complete bilingual insertion when translation is toggled off', async () => {
    vi.mocked(translateText).mockResolvedValue('切换关闭后不应残留换行节点。')
    document.body.innerHTML = `<p id="toggle-paragraph">Turning bilingual translation off restores this paragraph.</p>`
    const paragraph = document.querySelector<HTMLElement>('#toggle-paragraph')!
    const originalHTML = paragraph.innerHTML

    await handleBilingualTranslation(paragraph, false)
    expect(paragraph.querySelector(`.${BILINGUAL_CONTENT_CLASS} > br`)).not.toBeNull()

    vi.useFakeTimers()
    const removal = handleBilingualTranslation(paragraph, false)
    await vi.advanceTimersByTimeAsync(250)
    await removal

    expect(paragraph.innerHTML).toBe(originalHTML)
    expect(paragraph.classList.contains(BILINGUAL_WRAPPER_CLASS)).toBe(false)
    expect(paragraph.querySelector(`.${BILINGUAL_CONTENT_CLASS}, br`)).toBeNull()
  })

  it('restores manually inserted bilingual content without leaving translation state behind', async () => {
    vi.mocked(translateText).mockResolvedValue('全局恢复后可以再次翻译。')
    document.body.innerHTML = `<p id="restore-paragraph">Restoring the page removes every manual translation marker.</p>`
    const paragraph = document.querySelector<HTMLElement>('#restore-paragraph')!
    const originalHTML = paragraph.innerHTML

    await handleBilingualTranslation(paragraph, false)
    expect(paragraph.classList.contains(BILINGUAL_WRAPPER_CLASS)).toBe(true)

    restoreOriginalContent()

    expect(paragraph.innerHTML).toBe(originalHTML)
    expect(paragraph.classList.contains(BILINGUAL_WRAPPER_CLASS)).toBe(false)
    expect(document.querySelector(`.${BILINGUAL_CONTENT_CLASS}, .${BILINGUAL_TEXT_CLASS}`)).toBeNull()
  })

  it('restores bilingual direct text wrappers without disturbing nested child blocks', async () => {
    vi.mocked(translateText).mockResolvedValue('Translated log event.')
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul id="nested-list">
              <li id="first-verdict"><em>Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const target = grabNode(document.querySelector('#first-label')) as HTMLElement

    expect(target.getAttribute('data-fr-direct-text-target')).toBe('true')

    handleBilingualTranslation(target, false)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(target.querySelector('.only-translate-bilingual-content')?.textContent).toContain('Translated log event.')
    expect(document.querySelector('#first-verdict')?.textContent).toContain('Filter Verdict:')

    restoreOriginalContent()

    expect(document.querySelector('[data-fr-direct-text-target="true"]')).toBeNull()
    expect(document.querySelector('.only-translate-bilingual-content')).toBeNull()
    expect(document.querySelector('#first-label')?.parentElement?.id).toBe('first-event')
    expect(document.querySelector('#nested-list > #first-verdict')?.textContent).toContain('Filter Verdict:')
  })

  it('inserts and restores bilingual translations line by line around authored br elements', async () => {
    vi.mocked(translateText)
      .mockResolvedValueOnce('第一行译文')
      .mockResolvedValueOnce('第二行译文')
      .mockResolvedValueOnce('第三行译文')
    document.body.innerHTML = `
      <main>
        <div id="lyrics">First lyric line<br>Second <em id="lyric-emphasis">lyric</em> line<br><br>Third lyric line</div>
      </main>
    `
    const lyrics = document.querySelector<HTMLElement>('#lyrics')!
    const originalHTML = lyrics.innerHTML
    const wrappers = grabAllNode(lyrics)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers.map(node => node.textContent?.trim())).toEqual([
      'First lyric line',
      'Second lyric line',
      'Third lyric line'
    ])

    for (const wrapper of wrappers) {
      await handleBilingualTranslation(wrapper, false)
    }

    expect(wrappers.map(wrapper =>
      wrapper.querySelector(`.${BILINGUAL_TEXT_CLASS}`)?.textContent
    )).toEqual(['第一行译文', '第二行译文', '第三行译文'])
    expect(wrappers.every(wrapper =>
      wrapper.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)?.firstElementChild?.tagName === 'BR'
    )).toBe(true)
    expect(lyrics.querySelectorAll(':scope > br')).toHaveLength(3)
    expect(document.querySelector('#lyric-emphasis')?.closest(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrappers[1])

    restoreOriginalContent()

    expect(lyrics.innerHTML).toBe(originalHTML)
    expect(lyrics.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"], .${BILINGUAL_CONTENT_CLASS}`)).toBeNull()
  })

  it('reuses hard-break line wrappers during dynamic rescans', () => {
    document.body.innerHTML = `
      <article id="story">
        <p>Existing article paragraph keeps the dynamic content inside smart scope.</p>
        <div id="dynamic-lyrics">First dynamic lyric line<br>Second dynamic lyric line</div>
      </article>
    `
    const story = document.querySelector<HTMLElement>('#story')!
    const lyrics = document.querySelector<HTMLElement>('#dynamic-lyrics')!

    const firstScan = collectDynamicTranslationNodes(
      lyrics,
      story,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const firstWrappers = Array.from(lyrics.querySelectorAll<HTMLElement>(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`))

    const secondScan = collectDynamicTranslationNodes(
      lyrics,
      story,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const secondWrappers = Array.from(lyrics.querySelectorAll<HTMLElement>(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`))

    expect(firstWrappers.map(node => node.textContent?.trim())).toEqual([
      'First dynamic lyric line',
      'Second dynamic lyric line'
    ])
    expect(secondWrappers).toEqual(firstWrappers)
    expect(firstScan).toEqual(expect.arrayContaining(firstWrappers))
    expect(secondScan).toEqual(expect.arrayContaining(firstWrappers))
  })

  it('collects nested list direct text and child blocks as separate auto translation targets', () => {
    document.body.innerHTML = `
      <article>
        <p>The audit was to decide what to keep invisible in the Meridian example.</p>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul>
              <li id="first-verdict"><em>Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
          <li id="second-event">
            <em id="second-label">Log Event:</em> Comparing repair estimate to BlueBook value.
            <ul>
              <li id="second-verdict"><em>Filter Verdict:</em> <strong>Show.</strong> (High Stakes, impacts user's payout).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const target = resolveAutoTranslateTarget('smart')
    const texts = target.nodes.map(node => node.textContent?.replace(/\s+/g, ' ').trim())

    expect(texts).toContain('Log Event: Pinging Server West-2 for redundancy check.')
    expect(texts).toContain('Filter Verdict: Hide. (Low Stakes, High Technicality).')
    expect(texts).toContain('Log Event: Comparing repair estimate to BlueBook value.')
    expect(texts).toContain("Filter Verdict: Show. (High Stakes, impacts user's payout).")
    expect(texts).not.toContain('Log Event: Pinging Server West-2 for redundancy check. Filter Verdict: Hide. (Low Stakes, High Technicality).')
  })

  it('unwraps direct text wrappers that are discarded during target collection', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://direct-wrapper-test.example/article'),
      configurable: true
    })
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul>
              <li id="first-verdict"><em>Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    siteProfiles.push({
      id: 'direct-wrapper-test',
      domains: ['direct-wrapper-test.example'],
      skipTarget: (element) => element.hasAttribute(DIRECT_TEXT_TARGET_ATTR)
        ? { policy: 'hard-skip', reason: 'test-direct-wrapper-skip' }
        : undefined
    })

    try {
      const decisions = collectTranslationTargets(document.body, {
        mode: 'smart',
        scope: 'smart',
        contentRoot: document.body,
        grabOptions: {
          siteCompatMode: 'smart'
        }
      }, { includeSupplemental: false })

      expect(decisions.some(decision => decision.target.hasAttribute(DIRECT_TEXT_TARGET_ATTR))).toBe(false)
      expect(document.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBeNull()
      expect(document.querySelector('#first-label')?.parentElement?.id).toBe('first-event')
      expect(document.querySelector('#first-event > ul > #first-verdict')).not.toBeNull()
    } finally {
      siteProfiles.pop()
    }
  })

  it('keeps already translated direct text wrappers during dynamic rescans', () => {
    document.body.innerHTML = `
      <article id="story">
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul>
              <li id="first-verdict"><em>Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const wrapper = grabNode(document.querySelector('#first-label')) as HTMLElement
    wrapper.setAttribute(TRANSLATED_ATTR, 'true')

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#first-event')!,
      document.querySelector('#story')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(document.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrapper)
    expect(document.querySelector('#first-label')?.closest(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrapper)
    expect(wrapper.getAttribute(TRANSLATED_ATTR)).toBe('true')
    expect(nodes).not.toContain(wrapper)
  })

  it('cleans hover direct text wrappers when translation direction skips the target text', () => {
    vi.useFakeTimers()
    vi.mocked(shouldTranslateText).mockReturnValue(false)
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul>
              <li id="first-verdict"><em>Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const label = document.querySelector('#first-label') as Element
    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(label)

    try {
      handleTranslation(12, 34)
      vi.runAllTimers()

      expect(shouldTranslateText).toHaveBeenCalledWith(expect.stringContaining('Log Event:'))
      expect(translateText).not.toHaveBeenCalled()
      expect(document.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBeNull()
      expect(document.querySelector('#first-label')?.parentElement?.id).toBe('first-event')
      expect(document.querySelector('#first-event > ul > #first-verdict')).not.toBeNull()
    } finally {
      elementFromPoint.mockRestore()
      vi.useRealTimers()
      restoreOriginalContent()
    }
  })

  it('clears auto-translation markers when a bilingual translation is cancelled before insertion', async () => {
    class ImmediateIntersectionObserver {
      constructor(
        private readonly callback: IntersectionObserverCallback
      ) {}

      observe(target: Element) {
        this.callback([
          {
            isIntersecting: true,
            target
          } as IntersectionObserverEntry
        ], this as unknown as IntersectionObserver)
      }

      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockImplementation(() => Promise.reject(Object.assign(new Error('Translation cancelled'), {
      name: 'TranslationCancelledError'
    })))
    Object.defineProperty(window, 'location', {
      value: new URL('https://arstechnica.com/gadgets/2026/06/20-years-of-intel-macs-why-apple-switched-and-why-it-switched-again/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="main">
        <article>
          <h1>20 years of Intel Macs</h1>
          <p>Apple switched the Mac to Intel processors after years of internal experiments and shipping constraints.</p>
          <figure class="ars-wp-img-shortcode id-2159213 align-fullwidth">
            <figcaption>
              <div class="caption">
                <div class="caption-icon"></div>
                <div id="powerbook-caption" class="caption-content">
                  An early 2000s-era titanium PowerBook G4 running Mac OS X Leopard. Apple was never able to squeeze the PowerPC G5 into a laptop.
                  <span class="caption-credit">Credit: Andrew Cunningham</span>
                </div>
              </div>
            </figcaption>
          </figure>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await new Promise(resolve => setTimeout(resolve, 0))

      const caption = document.querySelector('#powerbook-caption') as HTMLElement
      expect(caption.hasAttribute(TRANSLATED_ATTR)).toBe(false)
      expect(caption.hasAttribute(TRANSLATED_ID_ATTR)).toBe(false)
      expect(caption.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)).toBeNull()
    } finally {
      restoreOriginalContent()
    }
  })

  it('stops webpage translation and asks for one refresh when the extension context is invalidated', async () => {
    vi.mocked(translateText).mockRejectedValue(new Error('Extension context invalidated.'))
    document.body.innerHTML = `
      <article>
        <p id="first">The first uncached paragraph needs the extension runtime.</p>
        <p id="second">The second uncached paragraph would fail for the same reason.</p>
      </article>
    `

    document.querySelectorAll<HTMLElement>('p').forEach((node, index) => {
      node.setAttribute(TRANSLATED_ATTR, 'true')
      node.setAttribute(TRANSLATED_ID_ATTR, `failed-${index}`)
    })

    try {
      await Promise.all([
        handleBilingualTranslation(document.querySelector('#first')!, false),
        handleBilingualTranslation(document.querySelector('#second')!, false)
      ])

      expect(mockCancelAllTranslations).toHaveBeenCalledTimes(1)
      expect(mockShowExtensionReloadedTip).toHaveBeenCalledTimes(1)
      expect(mockInsertFailedTip).not.toHaveBeenCalled()
      expect(document.querySelector(`[${TRANSLATED_ATTR}="true"]`)).toBeNull()
      expect(document.querySelector(`[${TRANSLATED_ID_ATTR}]`)).toBeNull()
    } finally {
      restoreOriginalContent()
    }
  })

  it('retries stale bilingual auto-translation markers that have no inserted translation', async () => {
    class ImmediateIntersectionObserver {
      constructor(
        private readonly callback: IntersectionObserverCallback
      ) {}

      observe(target: Element) {
        this.callback([
          {
            isIntersecting: true,
            target
          } as IntersectionObserverEntry
        ], this as unknown as IntersectionObserver)
      }

      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockImplementation((origin: string) => {
      if (origin.includes('PowerBook G4')) {
        return Promise.resolve('早期 2000 年代钛金属 PowerBook G4 运行 Mac OS X Leopard。')
      }
      return Promise.resolve(`translated: ${origin}`)
    })
    Object.defineProperty(window, 'location', {
      value: new URL('https://arstechnica.com/gadgets/2026/06/20-years-of-intel-macs-why-apple-switched-and-why-it-switched-again/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="main">
        <article>
          <h1>20 years of Intel Macs</h1>
          <p>Apple switched the Mac to Intel processors after years of internal experiments and shipping constraints.</p>
          <figure class="ars-wp-img-shortcode id-2159213 align-fullwidth">
            <figcaption>
              <div class="caption">
                <div class="caption-icon"></div>
                <div
                  id="powerbook-caption"
                  class="caption-content"
                  ${TRANSLATED_ATTR}="true"
                  ${TRANSLATED_ID_ATTR}="fr-node-3"
                >
                  An early 2000s-era titanium PowerBook G4 running Mac OS X Leopard. Apple was never able to squeeze the PowerPC G5 into a laptop.
                  <span class="caption-credit">Credit: Andrew Cunningham</span>
                </div>
              </div>
            </figcaption>
          </figure>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await new Promise(resolve => setTimeout(resolve, 0))
      await new Promise(resolve => setTimeout(resolve, 0))

      const caption = document.querySelector('#powerbook-caption') as HTMLElement
      expect(caption.getAttribute(TRANSLATED_ATTR)).toBe('true')
      expect(caption.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)?.textContent).toContain('PowerBook G4')
    } finally {
      restoreOriginalContent()
    }
  })

  it('keeps existing bilingual content when auto translation rescans a node missing its translated marker', async () => {
    class ImmediateIntersectionObserver {
      constructor(
        private readonly callback: IntersectionObserverCallback
      ) {}

      observe(target: Element) {
        this.callback([
          {
            isIntersecting: true,
            target
          } as IntersectionObserverEntry
        ], this as unknown as IntersectionObserver)
      }

      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    vi.useFakeTimers()
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.mocked(translateText).mockResolvedValue('不应重新翻译这条标注。')
    Object.defineProperty(window, 'location', {
      value: new URL('https://arstechnica.com/gadgets/2026/06/20-years-of-intel-macs-why-apple-switched-and-why-it-switched-again/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="main">
        <article>
          <h1>20 years of Intel Macs</h1>
          <p>Apple switched the Mac to Intel processors after years of internal experiments and shipping constraints.</p>
          <figure class="ars-wp-img-shortcode id-2159213 align-fullwidth">
            <figcaption>
              <div class="caption">
                <div class="caption-icon"></div>
                <div id="powerbook-caption" class="caption-content ${BILINGUAL_WRAPPER_CLASS}">
                  An early 2000s-era titanium PowerBook G4 running Mac OS X Leopard. Apple was never able to squeeze the PowerPC G5 into a laptop.
                  <span class="caption-credit">Credit: Andrew Cunningham</span>
                  <span class="${BILINGUAL_CONTENT_CLASS}">早期 2000 年代钛金属 PowerBook G4 运行 Mac OS X Leopard。</span>
                </div>
              </div>
            </figcaption>
          </figure>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')
      await vi.runAllTimersAsync()

      const caption = document.querySelector('#powerbook-caption') as HTMLElement
      expect(caption.getAttribute(TRANSLATED_ATTR)).toBe('true')
      expect(caption.querySelector(`.${BILINGUAL_CONTENT_CLASS}`)?.textContent).toContain('钛金属 PowerBook G4')
      expect(translateText).not.toHaveBeenCalledWith(expect.stringContaining('PowerBook G4'), document.title)
    } finally {
      vi.useRealTimers()
      restoreOriginalContent()
    }
  })

  it('does not clean stale bilingual markers while an auto translation pass is already active', () => {
    class PassiveIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    class NoopMutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    vi.stubGlobal('IntersectionObserver', PassiveIntersectionObserver)
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    Object.defineProperty(window, 'location', {
      value: new URL('https://arstechnica.com/gadgets/2026/06/20-years-of-intel-macs-why-apple-switched-and-why-it-switched-again/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="main">
        <article>
          <h1>20 years of Intel Macs</h1>
          <p>Apple switched the Mac to Intel processors after years of internal experiments and shipping constraints.</p>
          <p id="active-pass-seed">The Intel Mac era changed Apple's laptop lineup for years.</p>
        </article>
      </main>
    `

    try {
      autoTranslateEnglishPage('smart')

      const staleCaption = document.createElement('div')
      staleCaption.id = 'stale-caption'
      staleCaption.className = 'caption-content'
      staleCaption.setAttribute(TRANSLATED_ATTR, 'true')
      staleCaption.setAttribute(TRANSLATED_ID_ATTR, 'fr-node-99')
      staleCaption.textContent = 'An early 2000s-era titanium PowerBook G4 running Mac OS X Leopard.'
      document.querySelector('article')?.appendChild(staleCaption)

      autoTranslateEnglishPage('smart')

      expect(staleCaption.getAttribute(TRANSLATED_ATTR)).toBe('true')
      expect(staleCaption.getAttribute(TRANSLATED_ID_ATTR)).toBe('fr-node-99')
    } finally {
      restoreOriginalContent()
    }
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

  it('collects every readable list item in a VitePress article list', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://danielmiessler.com/blog/companies-graph-of-algorithms'),
      configurable: true
    })
    document.body.innerHTML = `
      <div class="dp-doc">
        <div>
          <p>Well, let's say that your company takes pictures, cleans them up, stylizes them, and adds a caption--which customers can then download in a large format.</p>
          <p>The company started in the early 2000's, founded by an artist/photographer, and here's how it works:</p>
          <p><img src="/images/graph-of-algorithms-memories-workflow.png" alt="Memories Company Workflow"></p>
          <ul>
            <li id="upload">The user uploads the best quality digital image that you have of the photo, or sends it to the company</li>
            <li id="scan"><em>Memories</em> receives it and does a high-quality scan--checking quality and repairing any damage using old-school photography techniques + Photoshop</li>
            <li id="stylize">Then they stylize the image in some kind of way, like Retro, Cinematic, Family, whatever--and add a caption</li>
            <li id="download">Then they let you download the image or they send you prints.</li>
          </ul>
          <p>Simple enough, and for anyone into computers you will recognize this as a series of steps, aka--an algorithm.</p>
        </div>
      </div>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map(node => node.id)

    expect(ids).toContain('upload')
    expect(ids).toContain('scan')
    expect(ids).toContain('stylize')
    expect(ids).toContain('download')
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

  it('skips dynamically mounted Hugging Face blog upvote controls', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://huggingface.co/blog/ServiceNow/mosaicleaks'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="page-root">
        <div class="blog-content prose">
          <h1 id="article-title">MosaicLeaks: Can your research agent keep a secret?</h1>
          <p id="summary">
            Deep research agents increasingly combine private local documents with external tools like web retrieval,
            creating a privacy risk that external queries may leak sensitive information.
          </p>
        </div>
        <aside id="upvote-rail">
          <div id="upvote-control" class="SVELTE_HYDRATER contents" data-target="UpvoteControl">
            <div class="flex flex-wrap items-center gap-2.5 pt-1 lg:sticky lg:top-8">
              <a href="/login?next=%2Fblog%2FServiceNow%2Fmosaicleaks" class="self-start">
                <div id="upvote-button" class="shadow-alternate group flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border">
                  Upvote
                  <div id="upvote-count" class="font-semibold text-orange-500">12</div>
                </div>
              </a>
              <ul id="upvoter-list" class="flex items-center text-gray-600 flex-row text-base">
                <li title="victor"><a href="/victor"><img alt="" src="/avatars/victor.svg"></a></li>
              </ul>
            </div>
          </div>
        </aside>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#upvote-control')!,
      document.querySelector('#page-root')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(nodes).toEqual([])
  })

  it('skips dynamically rescanned GitHub link-button wrappers', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot/security'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="Subhead">
          <h1>Security</h1>
          <div id="report-action" class="Subhead-actions" data-view-component="true">
            <a class="Button--primary Button--medium Button" data-view-component="true" href="/HKUDS/nanobot/security/advisories/new">
              <span class="Button-content"><span class="Button-label">Report a vulnerability</span></span>
            </a>
          </div>
        </div>
        <article id="security-policy" class="markdown-body">
          <h1>Security Policy</h1>
          <p>Report security vulnerabilities privately to the repository maintainers.</p>
        </article>
      </main>
    `

    const dynamicNodes = collectDynamicTranslationNodes(
      document.querySelector('#report-action')!,
      document.querySelector('#security-policy')!,
      'smart',
      { siteCompatMode: 'smart' }
    )

    expect(dynamicNodes).toEqual([])
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

  it('collects XDA comments inserted outside the initial article content root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.xda-developers.com/story-notepad-plus-plus/'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <article>
          <section id="article-body" class="article-body">
            <p data-fr-translated="true">The already translated article body remains the smart content root.</p>
          </section>
        </article>
      </main>
      <footer class="article-footer">
        <div id="footer-threads" class="footer-threads">
          <div id="w-comment-feed" class="w-comments-feed">
            <ul id="comments-feed-list" class="comments-feed-list">
              <li id="new-comment" class="comments-feed-item">
                <div class="w-thread-author-usercards">
                  <span id="new-comment-author">Eric</span>
                </div>
                <div class="user-comment" data-is-comment="true">
                  <p id="new-comment-text">Awesome! I just donated. I use Notepad++.</p>
                </div>
                <div id="new-comment-date" class="user-date">2025-03-02 00:48:03</div>
                <div class="w-user-comment-footer-option">
                  <button id="new-comment-reply">Reply</button>
                  <button id="new-comment-copy">Copy</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#new-comment')!,
      document.querySelector('#article-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('new-comment-text')
    expect(ids).not.toContain('new-comment-author')
    expect(ids).not.toContain('new-comment-date')
    expect(ids).not.toContain('new-comment-reply')
    expect(ids).not.toContain('new-comment-copy')
  })

  it('collects Substack comment paragraphs inserted outside the initial article content root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="substack-post-page">
        <article id="post-body" class="post">
          <h1>Why Jet Engines Aren't Made In China</h1>
          <p data-fr-translated="true">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
        </article>
        <section id="discussion" class="single-post-section comments-section">
          <h4>Discussion about this post</h4>
          <div class="comment-list">
            <div class="comment-list-items">
              <div class="comment">
                <div id="comment-johnny" role="article" aria-label="Comment by Johnny Ducati" class="comment-content">
                  <div class="comment-meta">
                    <a href="https://substack.com/profile/johnny">Johnny Ducati</a>
                    <span>May 17</span>
                    <button type="button">Liked by Aakash Japi</button>
                  </div>
                  <div class="comment-body expanded">
                    <p id="johnny-first">When I was a young guy, I reconditioned fixtures to finish grind the root of turbine blades for General Electric.</p>
                    <p id="johnny-second">The blades and vanes themselves are like works of art, and the investment casting process leaves the internal passages incredibly slick.</p>
                  </div>
                  <div class="comment-actions">
                    <button id="johnny-like" type="button">Like (40)</button>
                    <button id="johnny-reply" type="button">Reply</button>
                    <a id="johnny-share" href="/share">Share</a>
                  </div>
                </div>
              </div>
              <div class="comment">
                <div id="comment-matthew" role="article" aria-label="Comment by Matthew Green" class="comment-content">
                  <div class="comment-meta">
                    <a href="https://substack.com/profile/matthew">Matthew Green</a>
                    <span>May 13</span>
                  </div>
                  <div class="comment-body expanded">
                    <p id="matthew-first">Ok, this is very interesting. I have some questions:</p>
                    <p id="matthew-second">You repeatedly say that China has failed but then proceed to say that they are about a decade behind.</p>
                  </div>
                  <div class="comment-actions">
                    <button id="matthew-reply" type="button">Reply</button>
                    <a id="matthew-share" href="/share">Share</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#discussion')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('johnny-first')
    expect(ids).toContain('johnny-second')
    expect(ids).toContain('matthew-first')
    expect(ids).toContain('matthew-second')
    expect(ids).not.toContain('comment-johnny')
    expect(ids).not.toContain('comment-matthew')
    expect(ids).not.toContain('johnny-like')
    expect(ids).not.toContain('johnny-reply')
    expect(ids).not.toContain('johnny-share')
    expect(ids).not.toContain('matthew-reply')
    expect(ids).not.toContain('matthew-share')
  })

  it('collects Substack restack paragraphs after switching discussion tabs', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="substack-post-page">
        <article id="post-body" class="post">
          <h1>Why Jet Engines Aren't Made In China</h1>
          <p data-fr-translated="true">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
        </article>
        <section id="discussion" class="single-post-section comments-section">
          <h4>Discussion about this post</h4>
          <div class="tab-list">
            <button type="button">Comments</button>
            <button type="button">Restacks</button>
          </div>
          <div id="restacks-panel" class="restacks-list">
            <article id="restack-noah" class="restack-item">
              <div class="restack-meta">
                <a href="https://www.noahpinion.blog/">Noah Smith</a>
                <span>Jun 1</span>
                <button id="noah-subscribe" type="button">Subscribe</button>
              </div>
              <div class="restack-body">
                <p id="noah-first">An underrated reason for the success of Chinese technology policy is that a lot of their best technology is just the Electric Tech Stack.</p>
                <p id="noah-second">The Electric Tech Stack is what Western nations are missing.</p>
              </div>
              <div class="restack-actions">
                <button id="noah-like" type="button">38</button>
                <button id="noah-reply" type="button">2</button>
                <button id="noah-repost" type="button">4</button>
                <button id="noah-share" type="button">Share</button>
              </div>
            </article>
            <article id="restack-aakash" class="restack-item">
              <div class="restack-meta">
                <a href="https://aakash.substack.com/">Aakash Japi</a>
                <span>2d</span>
                <button id="aakash-subscribe" type="button">Subscribe</button>
              </div>
              <div class="restack-body">
                <p id="aakash-first">Looks like a recruiter for Chinese aerospace is posting engineering jobs:</p>
                <p id="aakash-link">reddit.com/r/aerospace/...</p>
                <p id="aakash-second">They must have taken my article to heart.</p>
              </div>
              <div class="restack-actions">
                <button id="aakash-like" type="button">4</button>
                <button id="aakash-reply" type="button">1</button>
                <button id="aakash-repost" type="button">1</button>
                <button id="aakash-share" type="button">Share</button>
              </div>
            </article>
          </div>
        </section>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#restacks-panel')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(ids).toContain('noah-first')
    expect(ids).toContain('noah-second')
    expect(ids).toContain('aakash-first')
    expect(ids).toContain('aakash-second')
    expect(ids).not.toContain('aakash-link')
    expect(ids).not.toContain('restack-noah')
    expect(ids).not.toContain('restack-aakash')
    expect(ids).not.toContain('noah-subscribe')
    expect(ids).not.toContain('noah-like')
    expect(ids).not.toContain('noah-reply')
    expect(ids).not.toContain('noah-repost')
    expect(ids).not.toContain('noah-share')
    expect(ids).not.toContain('aakash-subscribe')
    expect(ids).not.toContain('aakash-like')
    expect(ids).not.toContain('aakash-reply')
    expect(ids).not.toContain('aakash-repost')
    expect(ids).not.toContain('aakash-share')
  })

  it('collects Substack note restacks when the comments-section wrapper is replaced', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="substack-post-page">
        <article id="post-body" class="post">
          <h1>Why Jet Engines Aren't Made In China</h1>
          <p data-fr-translated="true">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
        </article>
        <div id="discussion-shell" class="pencraft pc-display-flex pc-flexDirection-column pc-gap-16 pc-paddingTop-32 pc-paddingBottom-32 pc-reset">
          <h4>Discussion about this post</h4>
          <div class="pencraft pc-display-flex pc-flexDirection-column pc-position-relative pc-minWidth-0 pc-reset">
            <div class="pencraft pc-display-flex pc-gap-4 pc-padding-4 pc-reset" role="tablist">
              <button id="note-comments-tab" type="button" role="tab" aria-selected="false">Comments</button>
              <button id="note-restacks-tab" type="button" role="tab" aria-selected="true">Restacks</button>
            </div>
          </div>
          <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-16 pc-paddingTop-16 pc-reset container">
            <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-16 pc-reset">
              <div id="note-noah" role="article" aria-label="Note" class="pencraft pc-display-flex pc-flexDirection-column pc-position-relative pc-reset feedItem-ONDKv3 feedItem-p_SCsv">
                <div class="pencraft pc-display-flex pc-flexDirection-column pc-reset pencraft pc-gap-8 pc-reset">
                  <div class="pencraft pc-gap-12 pc-reset pencraft pc-display-flex pc-flexDirection-column pc-reset feedUnit-NTpfyQ hasAvatar-XDSVUi">
                    <div class="pencraft pc-display-flex pc-gap-12 pc-alignItems-flex-start pc-reset">
                      <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-8 pc-minWidth-0 pc-reset flex-grow-rzmknG">
                        <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-12 pc-reset">
                          <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-4 pc-reset">
                            <div class="pencraft pc-display-flex pc-minWidth-0 pc-gap-8 pc-alignItems-center pc-justifyContent-space-between pc-reset">
                              <span id="note-noah-author">Noah Smith</span>
                              <button id="note-noah-subscribe" type="button">Subscribe</button>
                            </div>
                            <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-4 pc-position-relative pc-reset">
                              <div class="pencraft pc-display-flex pc-flexDirection-column pc-reset feedCommentBody-UWho7S">
                                <div class="pencraft pc-reset color-primary-zABazT line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-regular-mUq6Gb reset-IxiVJZ feedCommentBodyInner-AOzMIC">
                                  <div class="ProseMirror FeedProseMirror">
                                    <p id="note-noah-first">An underrated reason for the success of Chinese technology policy is that a lot of their best technology is just the Electric Tech Stack.</p>
                                    <p id="note-noah-second">The Electric Tech Stack is what Western nations are missing.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="pencraft pc-display-flex pc-gap-16 pc-reset">
                            <button id="note-noah-like" type="button">38</button>
                            <button id="note-noah-reply" type="button">2</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div id="note-aakash" role="article" aria-label="Note" class="pencraft pc-display-flex pc-flexDirection-column pc-position-relative pc-reset feedItem-ONDKv3 feedItem-p_SCsv">
                <div class="pencraft pc-display-flex pc-flexDirection-column pc-reset feedCommentBody-UWho7S">
                  <div class="pencraft pc-reset feedCommentBodyInner-AOzMIC">
                    <div class="ProseMirror FeedProseMirror">
                      <p id="note-aakash-first">Looks like a recruiter for Chinese aerospace is posting engineering jobs:</p>
                      <p id="note-aakash-link">reddit.com/r/aerospace/...</p>
                      <p id="note-aakash-second">They must have taken my article to heart.</p>
                    </div>
                  </div>
                </div>
                <button id="note-aakash-subscribe" type="button">Subscribe</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#note-restacks-tab')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const scanRoot = getDynamicTranslationScanRoot(
      document.querySelector('#note-restacks-tab')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(scanRoot).toBe(document.querySelector('#discussion-shell'))
    expect(ids).toContain('note-noah-first')
    expect(ids).toContain('note-noah-second')
    expect(ids).toContain('note-aakash-first')
    expect(ids).toContain('note-aakash-second')
    expect(ids).not.toContain('note-aakash-link')
    expect(ids).not.toContain('note-noah')
    expect(ids).not.toContain('note-aakash')
    expect(ids).not.toContain('note-noah-author')
    expect(ids).not.toContain('note-noah-subscribe')
    expect(ids).not.toContain('note-noah-like')
    expect(ids).not.toContain('note-noah-reply')
    expect(ids).not.toContain('note-aakash-subscribe')
  })

  it('promotes Substack discussion tab mutations to scan visible comments and restacks', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="substack-post-page">
        <article id="post-body" class="post">
          <h1>Why Jet Engines Aren't Made In China</h1>
          <p data-fr-translated="true">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
        </article>
        <section id="discussion" class="post-comments">
          <h4>Discussion about this post</h4>
          <div class="tab-list" role="tablist">
            <button id="comments-tab" type="button" role="tab" aria-selected="true">Comments</button>
            <button id="restacks-tab" type="button" role="tab" aria-selected="false">Restacks</button>
          </div>
          <div class="comment-list">
            <div class="comment-list-items">
              <div class="comment">
                <div role="article" aria-label="Comment by Johnny Ducati" class="comment-content">
                  <div class="comment-meta">
                    <a href="https://substack.com/profile/johnny">Johnny Ducati</a>
                    <button id="comment-subscribe" type="button">Subscribe</button>
                  </div>
                  <div class="comment-body expanded">
                    <p id="tab-comment-first">The blades and vanes themselves are like works of art, and the investment casting process leaves the internal passages incredibly slick.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="restacks-list">
            <article class="restack-item">
              <div class="restack-meta">
                <a href="https://www.noahpinion.blog/">Noah Smith</a>
                <button id="restack-subscribe" type="button">Subscribe</button>
              </div>
              <div class="restack-body">
                <p id="tab-restack-first">An underrated reason for the success of Chinese technology policy is that a lot of their best technology is just the Electric Tech Stack.</p>
              </div>
            </article>
          </div>
        </section>
      </main>
    `

    const nodes = collectDynamicTranslationNodes(
      document.querySelector('#comments-tab')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const scanRoot = getDynamicTranslationScanRoot(
      document.querySelector('#comments-tab')!,
      document.querySelector('#post-body')!,
      'smart',
      { siteCompatMode: 'smart' }
    )
    const ids = nodes.map(node => node.id)

    expect(scanRoot).toBe(document.querySelector('#discussion'))
    expect(ids).toContain('tab-comment-first')
    expect(ids).toContain('tab-restack-first')
    expect(ids).not.toContain('comment-subscribe')
    expect(ids).not.toContain('restack-subscribe')
  })

  it('collects visible Substack comments during the initial smart translation pass', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="substack-post-page">
        <article id="post-body" class="post">
          <h1 id="post-title">Why Jet Engines Aren't Made In China</h1>
          <p id="post-intro">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
          <p id="post-second">A high-pressure turbine blade in a modern jet engine is expected to sit in gas hotter than lava while sustaining a consistent centrifugal load.</p>
          <p id="post-third">Achieving these requirements has made it one of the most complex manufacturing outputs in the world, because materials, casting, cooling, inspection, and certification all interact.</p>
          <p id="post-fourth">Established manufacturers still only reach limited yield on the hardest components, and a new entrant would spend years learning process knowledge that cannot be read from a blueprint.</p>
        </article>
        <section id="discussion" class="post-comments">
          <h4>Discussion about this post</h4>
          <div class="tab-list" role="tablist">
            <button id="initial-comments-tab" type="button" role="tab" aria-selected="true">Comments</button>
            <button id="initial-restacks-tab" type="button" role="tab" aria-selected="false">Restacks</button>
          </div>
          <div class="comment-list">
            <div class="comment-list-items">
              <div class="comment">
                <div id="initial-comment-card" role="article" aria-label="Comment by Johnny Ducati" class="comment-content">
                  <div class="comment-meta">
                    <a href="https://substack.com/profile/johnny">Johnny Ducati</a>
                    <span>May 17</span>
                    <button id="initial-comment-subscribe" type="button">Subscribe</button>
                  </div>
                  <div class="comment-body expanded">
                    <p id="initial-comment-first">When I was a young guy, I reconditioned fixtures to finish grind the root of turbine blades for General Electric.</p>
                    <p id="initial-comment-second">The blades and vanes themselves are like works of art, and the investment casting process leaves the internal passages incredibly slick.</p>
                  </div>
                  <div class="comment-actions">
                    <button id="initial-comment-like" type="button">Like (40)</button>
                    <button id="initial-comment-reply" type="button">Reply</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map(node => node.id)

    expect(ids).toContain('post-title')
    expect(ids).toContain('initial-comment-first')
    expect(ids).toContain('initial-comment-second')
    expect(ids).not.toContain('initial-comment-card')
    expect(ids).not.toContain('initial-comment-subscribe')
    expect(ids).not.toContain('initial-comment-like')
    expect(ids).not.toContain('initial-comment-reply')
  })

  it('collects visible Substack comments from the current comments-section root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <div aria-label="Post" role="main" class="single-post-container">
        <div class="single-post">
          <article id="post-body" class="typography newsletter-post post">
            <h1 id="real-post-title" class="post-title published">Why Jet Engines Aren't Made In China</h1>
            <div class="available-content">
              <div class="body markup">
                <p id="real-post-intro">Jet engines are a low-margin market focused on long-term reliability where manufacturing quality and consistency are paramount.</p>
                <p id="real-post-second">A high-pressure turbine blade in a modern jet engine is expected to sit in gas hotter than lava while sustaining a consistent centrifugal load.</p>
                <p id="real-post-third">Achieving these requirements has made it one of the most complex manufacturing outputs in the world, because materials, casting, cooling, inspection, and certification all interact.</p>
                <p id="real-post-fourth">Established manufacturers still only reach limited yield on the hardest components, and a new entrant would spend years learning process knowledge that cannot be read from a blueprint.</p>
              </div>
            </div>
          </article>
          <div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-16 pc-paddingTop-32 pc-paddingBottom-32 pc-reset">
            <h4>Discussion about this post</h4>
            <div class="pencraft pc-display-flex pc-flexDirection-column pc-position-relative pc-minWidth-0 pc-reset bg-primary-zk6FDl outline-detail-vcQLyr pc-borderRadius-sm overflow-hidden-WdpwT6">
              <button id="real-comments-tab" type="button" class="pencraft segment-j4TeZ4">Comments</button>
              <button id="real-restacks-tab" type="button" class="pencraft segment-j4TeZ4">Restacks</button>
            </div>
            <div id="real-discussion" class="single-post-section comments-section">
              <div class="comment-list post-page-root-comment-list">
                <div class="comment-list-items">
                  <div class="comment">
                    <div id="real-comment-card" class="pencraft pc-display-flex pc-gap-12 pc-paddingBottom-12 pc-reset comment-content">
                      <div class="pencraft pc-display-flex pc-flexDirection-column pc-reset flex-grow-rzmknG">
                        <div class="pencraft pc-display-flex pc-reset">
                          <span id="real-comment-author">Johnny Ducati</span>
                          <span id="real-comment-date">May 17</span>
                          <button id="real-comment-menu" type="button">More</button>
                        </div>
                        <div class="comment-body expanded">
                          <p id="real-comment-first">When I was a young guy, I reconditioned fixtures to finish grind the root of turbine blades for General Electric.</p>
                          <p id="real-comment-second">The blades and vanes themselves are like works of art, and the investment casting process leaves the internal passages incredibly slick.</p>
                        </div>
                        <div class="pencraft pc-display-flex pc-gap-16 pc-paddingTop-8 pc-justifyContent-flex-start pc-alignItems-center pc-reset comment-actions withShareButton-hQzuEn">
                          <a id="real-comment-like" href="/like">Like (40)</a>
                          <a id="real-comment-reply" href="/reply">Reply</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    const target = resolveAutoTranslateTarget('smart')
    const ids = target.nodes.map(node => node.id)

    expect(ids).toContain('real-post-title')
    expect(ids).toContain('real-comment-first')
    expect(ids).toContain('real-comment-second')
    expect(ids).not.toContain('real-comment-card')
    expect(ids).not.toContain('real-comment-author')
    expect(ids).not.toContain('real-comment-menu')
    expect(ids).not.toContain('real-comment-like')
    expect(ids).not.toContain('real-comment-reply')
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

  it('does not expand site profiles for dynamic roots already inside the smart content root', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://aakash.substack.com/p/why-jet-engines-arent-made-in-china'),
      configurable: true
    })
    document.body.innerHTML = `
      <main id="content-root">
        <article id="article">
          <p id="dynamic-readable">This newly inserted article paragraph already lives inside the smart content root and should not need profile expansion.</p>
        </article>
      </main>
    `

    const originalQuerySelectorAll = Element.prototype.querySelectorAll
    let profileExpansionQueries = 0
    Element.prototype.querySelectorAll = function querySelectorAllWithProfileCounter(this: Element, selectors: string) {
      if (selectors.includes('feedCommentBody')) profileExpansionQueries++
      return originalQuerySelectorAll.call(this, selectors)
    } as typeof Element.prototype.querySelectorAll

    try {
      const scanRoot = getDynamicTranslationScanRoot(
        document.querySelector('#dynamic-readable')!,
        document.querySelector('#content-root')!,
        'smart',
        { siteCompatMode: 'smart' }
      )

      expect(scanRoot).toBe(document.querySelector('#dynamic-readable'))
      expect(profileExpansionQueries).toBe(0)
    } finally {
      Element.prototype.querySelectorAll = originalQuerySelectorAll
    }
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
