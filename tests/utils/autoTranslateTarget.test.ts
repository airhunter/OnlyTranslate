import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  translationScope: 'smart',
  on: true,
  service: 'microsoft',
  display: 1,
  style: 0,
  to: 'zh-Hans',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en',
  model: {} as Record<string, string>,
  token: {} as Record<string, string>,
  customProviders: []
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  isTranslationCancelledError: vi.fn((error: unknown) => {
    return error instanceof Error && error.name === 'TranslationCancelledError'
  }),
  translateText: vi.fn()
}))

vi.mock('@/entrypoints/utils/icon', () => ({
  insertFailedTip: vi.fn(),
  insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() }))
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

import { autoTranslateEnglishPage, collectDynamicTranslationNodes, handleBilingualTranslation, handleBtnTranslation, handleTranslation, resolveAutoTranslateTarget, restoreOriginalContent } from '@/entrypoints/main/trans'
import { DIRECT_TEXT_TARGET_ATTR, grabNode } from '@/entrypoints/main/dom'
import { collectTranslationTargets } from '@/entrypoints/main/translationTarget/collect'
import { getBilingualAppendTarget } from '@/entrypoints/main/translationTarget/decision'
import { getDynamicTranslationScanRoot } from '@/entrypoints/main/translationTarget/dynamic'
import { createScanContext } from '@/entrypoints/main/translationTarget/scanContext'
import {
  BILINGUAL_CONTENT_CLASS,
  BILINGUAL_WRAPPER_CLASS,
  TRANSLATED_ATTR,
  TRANSLATED_ID_ATTR
} from '@/entrypoints/main/translationTarget/constants'
import { siteProfiles } from '@/entrypoints/main/siteProfiles'
import { translateText } from '@/entrypoints/utils/translateApi'
import { shouldTranslateText } from '@/entrypoints/utils/translationDirection'

describe('resolveAutoTranslateTarget behavior', () => {
  const originalLocation = window.location

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
    vi.clearAllMocks()
    vi.mocked(shouldTranslateText).mockReturnValue(true)
    vi.useRealTimers()
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

    const translation = headline.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)
    expect(headline.style.display).toBe('block')
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

    const translation = copy.querySelector<HTMLElement>(`.${BILINGUAL_CONTENT_CLASS}`)
    expect(copy.style.display).toBe('flex')
    expect(translation?.style.display).toBe('')
    expect(translation?.style.width).toBe('')
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
