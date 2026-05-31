import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { afterBilingualAppendCompatFn, replaceCompatFn, selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat'
import {
  siteProfileExpandTargetFns,
  siteProfileShouldKeepNestedTargetFns
} from '@/entrypoints/main/siteProfiles'

afterEach(() => {
  window.dispatchEvent(new Event('resize'))
  vi.useRealTimers()
})

describe('site profile registry', () => {
  it('registers migrated select profiles by domain', () => {
    expect(selectCompatFn['github.com']).toBeTypeOf('function')
    expect(selectCompatFn['reddit.com']).toBeTypeOf('function')
    expect(selectCompatFn['youtube.com']).toBeTypeOf('function')
    expect(selectCompatFn['x.com']).toBeTypeOf('function')
    expect(selectCompatFn['cnn.com']).toBeTypeOf('function')
    expect(selectCompatFn['medium.com']).toBeTypeOf('function')
    expect(selectCompatFn['towardsdatascience.com']).toBeTypeOf('function')
    expect(selectCompatFn['stackoverflow.com']).toBeTypeOf('function')
    expect(selectCompatFn['news.ycombinator.com']).toBeTypeOf('function')
  })

  it('registers GitHub target expansion hooks', () => {
    expect(siteProfileExpandTargetFns['github.com']).toBeTypeOf('function')
    expect(siteProfileShouldKeepNestedTargetFns['github.com']).toBeTypeOf('function')
  })

  it('keeps GitHub domain checks out of the generic collect pipeline', () => {
    const source = readFileSync(resolve(process.cwd(), 'entrypoints/main/translationTarget/collect.ts'), 'utf8')

    expect(source).not.toMatch(/github\.com/i)
    expect(source).not.toMatch(/GitHub/)
  })

  it('registers TDS related article supplemental profile', () => {
    expect(supplementalCompatFn['towardsdatascience.com']).toBeTypeOf('function')
  })

  it('registers CNN supplemental profile', () => {
    expect(supplementalCompatFn['cnn.com']).toBeTypeOf('function')
  })

  it('registers Asterisk bilingual append profile', () => {
    expect(afterBilingualAppendCompatFn['asteriskmag.com']).toBeTypeOf('function')
  })

  it('registers Claude learning supplemental profile', () => {
    expect(supplementalCompatFn['nagdy.me']).toBeTypeOf('function')
  })

  it('registers Decrypt article supplemental profile', () => {
    expect(supplementalCompatFn['decrypt.co']).toBeTypeOf('function')
  })

  it('registers Ziggit topic supplemental profile', () => {
    expect(supplementalCompatFn['ziggit.dev']).toBeTypeOf('function')
    expect(siteProfileExpandTargetFns['ziggit.dev']).toBeTypeOf('function')
  })

  it('registers Simon Willison article profile', () => {
    expect(selectCompatFn['simonwillison.net']).toBeTypeOf('function')
  })

  it('registers NXGOAI article profile', () => {
    expect(selectCompatFn['nxgoai.com']).toBeTypeOf('function')
  })

  it('registers Ars Technica article profile', () => {
    expect(selectCompatFn['arstechnica.com']).toBeTypeOf('function')
  })

  it('keeps YouTube replace profile registered', () => {
    const node = document.createElement('yt-formatted-string')
    node.textContent = 'Original'

    replaceCompatFn['youtube.com']?.(node, '<span>Translated</span>')

    expect(node.textContent).toBe('Translated')
  })

  it('keeps simple DOM profiles available', () => {
    const element = document.createElement('div')
    element.className = 'im-description'
    element.textContent = 'Repository description text'

    expect(selectCompatFn['mvnrepository.com']?.(element, { mode: 'smart' })).toBe(element)
  })

  it('relayouts Asterisk footnotes after bilingual text is appended', () => {
    vi.useFakeTimers()
    const resizeHandler = vi.fn()
    window.addEventListener('resize', resizeHandler)

    document.body.innerHTML = `
      <ol class="footnotes-list">
        <li id="fn-1">For some reason, humans have gastric acid that is more acidic than most other animals.</li>
      </ol>
    `
    const footnote = document.querySelector<HTMLElement>('#fn-1')!
    const translationNode = document.createElement('span')

    afterBilingualAppendCompatFn['asteriskmag.com']?.(footnote, translationNode, footnote)

    expect(translationNode.classList.contains('only-translate-asterisk-footnote')).toBe(true)
    vi.advanceTimersByTime(49)
    expect(resizeHandler).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(resizeHandler).toHaveBeenCalledTimes(1)

    window.removeEventListener('resize', resizeHandler)
  })

  it('does not relayout Asterisk for non-footnote bilingual text', () => {
    vi.useFakeTimers()
    const resizeHandler = vi.fn()
    window.addEventListener('resize', resizeHandler)

    document.body.innerHTML = `
      <article>
        <p id="paragraph">This paragraph belongs to the article body and should not trigger footnote relayout.</p>
      </article>
    `
    const paragraph = document.querySelector<HTMLElement>('#paragraph')!
    const translationNode = document.createElement('span')

    afterBilingualAppendCompatFn['asteriskmag.com']?.(paragraph, translationNode, paragraph)
    vi.advanceTimersByTime(60)

    expect(translationNode.classList.contains('only-translate-asterisk-footnote')).toBe(false)
    expect(resizeHandler).not.toHaveBeenCalled()

    window.removeEventListener('resize', resizeHandler)
  })

  it('recognizes common CNN headline and description nodes', () => {
    document.body.innerHTML = `
      <main>
        <a class="container__link">
          <span id="headline" class="container__headline-text">Charting how Trump became a historically unpopular president</span>
        </a>
        <div id="description" class="container__description">
          More than 100 people stranded on cruise ship after deadly hantavirus outbreak.
        </div>
        <div id="live" class="live-updates__button">Live Updates</div>
      </main>
    `

    expect(selectCompatFn['cnn.com']?.(document.querySelector('#headline')!, { mode: 'smart' })).toBe(document.querySelector('#headline'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#description')!, { mode: 'smart' })).toBe(document.querySelector('#description'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#live')!, { mode: 'smart' })).toBe(document.querySelector('#live'))
  })

  it('recognizes CNN homepage hero headlines', () => {
    document.body.innerHTML = `
      <main>
        <section class="homepage-zone">
          <a class="container__link container_lead-plus-headlines__link">
            <div id="hero-headline" class="container__headline container_lead-plus-headlines__headline">
              Guns on television and in Iran's streets as Trump renews war threats
            </div>
          </a>
          <div class="container__title container_lead-package__title" data-editable="titleLink">
            <a class="container__title-url container_lead-package__title-url">
              <h2 id="lead-package-title" class="container__title_url-text container_lead-package__title_url-text" data-editable="title">
                Guns on television and in Iran's streets as Trump renews war threats
              </h2>
              <p id="lead-package-subtext" class="container__title_url-sub-text container_lead-package__title_url-sub-text">Show all</p>
            </a>
          </div>
          <a class="card container__link">
            <span id="lead-headline" class="card__headline card_homepage__headline">
              Set to host Trump, Xi targets stability under cloud of Iran uncertainty
            </span>
          </a>
        </section>
      </main>
    `

    expect(selectCompatFn['cnn.com']?.(document.querySelector('#hero-headline')!, { mode: 'smart' })).toBe(document.querySelector('#hero-headline'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#lead-package-title')!, { mode: 'smart' })).toBe(document.querySelector('#lead-package-title'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#lead-headline')!, { mode: 'smart' })).toBe(document.querySelector('#lead-headline'))
  })

  it('recognizes CNN live story content and skips smart side rails', () => {
    document.body.innerHTML = `
      <header>CNN navigation</header>
      <section id="rail">Related stories</section>
      <div id="live-root" class="layout-live-story-amplify__wrapper">
        <section class="layout-live-story-amplify__top">
          <h1 id="live-title" class="headline_live-story__text">Iran war news and live updates</h1>
        </section>
        <div class="layout-live-story-amplify__left">
          <p id="left-rail">Related story teaser</p>
        </div>
        <div class="layout-live-story-amplify__main">
          <article class="liveStoryPost">
            <h2 id="live-headline" class="live-story-post__headline">Two reasons why Iran may have attacked the UAE</h2>
            <div class="live-story-post__content">
              <p id="live-paragraph" class="paragraph">The UAE bore the brunt of Iran's attacks during the war.</p>
            </div>
          </article>
        </div>
      </div>
    `

    expect(selectCompatFn['cnn.com']?.(document.querySelector('#live-title')!, { mode: 'smart' })).toBe(document.querySelector('#live-title'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#live-headline')!, { mode: 'smart' })).toBe(document.querySelector('#live-headline'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#live-paragraph')!, { mode: 'smart' })).toBe(document.querySelector('#live-paragraph'))
    expect(selectCompatFn['cnn.com']?.(document.querySelector('#left-rail')!, { mode: 'smart' })).toEqual({ skip: true })
  })

  it('supplements CNN article page headlines that sit outside the selected article body', () => {
    document.body.innerHTML = `
      <main>
        <section class="article-header">
          <h1 id="article-title" class="headline__text">
            Iran's military is rebuilding much faster than expected
          </h1>
        </section>
        <article id="article-body">
          <p>Iran has moved quickly to restore parts of its military network after weeks of strikes.</p>
          <p>Officials say the pace of rebuilding has surprised analysts and regional allies.</p>
        </article>
        <div id="ad-wrapper" class="container__ads">
          <h1 id="ad-title">Advertisement</h1>
        </div>
      </main>
    `

    const targets = supplementalCompatFn['cnn.com']?.(document.body, { mode: 'smart' }) ?? []

    expect(targets).toContain(document.querySelector('#article-title'))
    expect(targets).not.toContain(document.querySelector('#ad-title'))
  })
})
