import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { afterBilingualAppendCompatFn, replaceCompatFn, selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat'
import {
  siteProfiles,
  siteProfileExpandTargetFns,
  siteProfileShouldKeepNestedTargetFns
} from '@/entrypoints/main/siteProfiles'

afterEach(() => {
  window.dispatchEvent(new Event('resize'))
  vi.useRealTimers()
})

// 取自 https://news.ycombinator.com/item?id=47555081 的当前 DOM 结构
const HN_ITEM_FIXTURE = `
  <center><table id="hnmain">
    <tr><td class="hnnavbar">
      <span class="pagetop">
        <b class="hnname"><a href="news">Hacker News</a></b>
        <a id="nav-newest" href="newest">new</a> | <a href="front">past</a>
      </span>
    </td></tr>
    <tr><td>
      <table class="fatitem">
        <tr class="athing" id="47555081">
          <td class="title"><span class="rank"></span></td>
          <td class="votelinks"><center><a href="vote?id=47555081"><div id="vote-arrow" class="votearrow" title="upvote"></div></a></center></td>
          <td class="title"><span class="titleline"><a id="story-title" href="item?id=47555081">The risk of AI isn't making us lazy, but making "lazy" look productive</a></span></td>
        </tr>
        <tr><td colspan="2"></td><td class="subtext"><span class="subline">
          <span class="score">76 points</span> by
          <a id="story-user" href="user?id=acmerfight" class="hnuser">acmerfight</a>
          <span class="age" title="2026-03-28T14:48:14"><a href="item?id=47555081">3 months ago</a></span>
          | <a href="hide?id=47555081">hide</a>
          | <a id="story-comments" href="item?id=47555081">88&nbsp;comments</a>
        </span></td></tr>
        <tr><td colspan="2"></td><td>
          <div id="top-text" class="toptext" style="margin-top:4px">I've been reflecting on how LLMs are changing our learning habits as engineers.<p id="top-text-paragraph">But real learning requires deep reading, thinking, and practice.</p></div>
        </td></tr>
      </table>
      <br><br>
      <table class="comment-tree">
        <tr class="athing comtr" id="47556028"><td><table><tr>
          <td class="ind" indent="0"><img src="s.gif" height="1" width="0"></td>
          <td class="votelinks"><center><a href="vote?id=47556028"><div class="votearrow" title="upvote"></div></a></center></td>
          <td id="comment-cell" class="default">
            <div><span class="comhead">
              <a href="user?id=peteforde" class="hnuser">peteforde</a>
              <span id="comment-age" class="age" title="2026-03-28T16:25:40"><a href="item?id=47556028">3 months ago</a></span>
              <span class="navs"> | <a href="#47555767" class="clicky">next</a></span>
            </span></div>
            <br>
            <div class="comment">
              <div id="comment-text" class="commtext c00">Several weeks ago, I spent about a week fully reverse engineering a Stereomaker pedal.<p id="comment-paragraph">It uses a 5-stage all-pass filter to mess with the phase without the use of delay.</p></div>
              <div class="reply"><p><font size="1"><u><a id="comment-reply" href="reply?id=47556028">reply</a></u></font></p></div>
            </div>
          </td>
        </tr></table></td></tr>
      </table>
    </td></tr>
  </table></center>
`

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
    const github = siteProfiles.find(profile => profile.id === 'github')

    expect(github?.collectFastPathTargets).toBeTypeOf('function')
    expect(siteProfileExpandTargetFns['github.com']).toBeTypeOf('function')
    expect(siteProfileShouldKeepNestedTargetFns['github.com']).toBeTypeOf('function')
  })

  it('skips GitHub pull request review metadata without skipping the title', () => {
    document.body.innerHTML = `
      <div class="js-issue-row">
        <a id="pull-title" href="/HKUDS/nanobot/pull/5498">feat(config): unify onboarding in the Agent TUI</a>
        <div id="pull-metadata" class="d-flex mt-1 text-small color-fg-muted">
          #5498 opened 16 hours ago by chengyongru
          <span id="review-wrapper">
            • <a href="/HKUDS/nanobot/pull/5498#partial-pull-merging" aria-label="Review required before merging">Review required</a>
          </span>
        </div>
      </div>
    `
    const github = siteProfiles.find(profile => profile.id === 'github')!
    const title = document.querySelector('#pull-title')!
    const metadata = document.querySelector('#pull-metadata')!
    const reviewWrapper = document.querySelector('#review-wrapper')!

    expect(github.select?.(title, { mode: 'smart' })).toBe(title)
    expect(github.select?.(metadata, { mode: 'smart' })).toEqual({ skip: true })
    expect(github.select?.(reviewWrapper, { mode: 'smart' })).toEqual({ skip: true })
  })

  it('keeps only GitHub Actions run titles in smart mode', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: new URL('https://github.com/HKUDS/nanobot/actions'),
      configurable: true
    })

    try {
      document.body.innerHTML = `
        <div class="Box-row">
          <a href="/HKUDS/nanobot/actions/runs/32707622733">
            <span id="run-title" class="markdown-title">feat(actions): keep readable run titles</span>
          </a>
          <div id="run-metadata">Test Suite #8483: Pull request #5481 synchronize by chengyongru</div>
        </div>
        <div id="actions-error">Sorry, something went wrong. Please reload this page.</div>
      `
      const github = siteProfiles.find(profile => profile.id === 'github')!
      const title = document.querySelector('#run-title')!
      const metadata = document.querySelector('#run-metadata')!
      const error = document.querySelector('#actions-error')!

      expect(github.select?.(title, { mode: 'smart' })).toBe(title)
      expect(github.select?.(metadata, { mode: 'smart' })).toEqual({ skip: true })
      expect(github.select?.(error, { mode: 'smart' })).toEqual({ skip: true })
      expect(github.select?.(metadata, { mode: 'full' })).toBe(false)
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        configurable: true
      })
    }
  })

  it('skips GitHub link-style buttons while keeping Markdown policy content', () => {
    document.body.innerHTML = `
      <a class="Button--primary Button" href="/owner/repo/security/advisories/new">
        <span class="Button-content"><span id="button-label" class="Button-label">Report a vulnerability</span></span>
      </a>
      <div id="button-region" class="Subhead-actions">
        <a class="Button--primary Button" href="/owner/repo/security/advisories/new">
          <span class="Button-content"><span class="Button-label">Report a vulnerability</span></span>
        </a>
      </div>
      <article class="markdown-body">
        <h1 id="policy-title">Security Policy</h1>
        <p id="policy-copy">Report security vulnerabilities privately to the repository maintainers.</p>
      </article>
    `
    const github = siteProfiles.find(profile => profile.id === 'github')!
    const buttonLabel = document.querySelector('#button-label')!
    const buttonRegion = document.querySelector('#button-region')!
    const policyTitle = document.querySelector('#policy-title')!
    const policyCopy = document.querySelector('#policy-copy')!

    expect(github.select?.(buttonLabel, { mode: 'smart' })).toEqual({ skip: true })
    expect(github.select?.(buttonRegion, { mode: 'smart' })).toEqual({ skip: true })
    expect(github.select?.(policyTitle, { mode: 'smart' })).toBe(policyTitle)
    expect(github.select?.(policyCopy, { mode: 'smart' })).toBe(policyCopy)
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

  it('registers Product Hunt product profile', () => {
    expect(selectCompatFn['producthunt.com']).toBeTypeOf('function')
  })

  it('registers Ars Technica article profile', () => {
    expect(selectCompatFn['arstechnica.com']).toBeTypeOf('function')
  })

  it('registers Jacob Gold article profile', () => {
    expect(selectCompatFn['jacob.gold']).toBeTypeOf('function')
  })

  it('registers Hugging Face blog article profile', () => {
    expect(selectCompatFn['huggingface.co']).toBeTypeOf('function')
    expect(afterBilingualAppendCompatFn['huggingface.co']).toBeTypeOf('function')
  })

  it('registers Devin Docs changelog profile', () => {
    expect(selectCompatFn['devin.ai']).toBeTypeOf('function')
  })

  it('registers Ynetnews article profile', () => {
    expect(selectCompatFn['ynetnews.com']).toBeTypeOf('function')
    expect(supplementalCompatFn['ynetnews.com']).toBeTypeOf('function')
  })

  it('registers Substack discussion profile', () => {
    expect(selectCompatFn['substack.com']).toBeTypeOf('function')
    expect(supplementalCompatFn['substack.com']).toBeTypeOf('function')
    expect(siteProfileExpandTargetFns['substack.com']).toBeTypeOf('function')
  })

  it('registers XDA discussion profile', () => {
    expect(selectCompatFn['xda-developers.com']).toBeTypeOf('function')
    expect(supplementalCompatFn['xda-developers.com']).toBeTypeOf('function')
    expect(siteProfileExpandTargetFns['xda-developers.com']).toBeTypeOf('function')
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

  it('registers declarative simple target selectors as select profiles', () => {
    const profile = siteProfiles.find(item => item.id === 'aozora')!
    const element = document.createElement('div')
    element.className = 'main_text'
    element.textContent = 'Readable Aozora text'

    expect(profile.targetSelector).toBe('div.main_text')
    expect(profile.select).toBeUndefined()
    expect(selectCompatFn['aozora.gr.jp']?.(element, { mode: 'smart' })).toBe(element)
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
    const insertionNode = document.createElement('span')

    afterBilingualAppendCompatFn['asteriskmag.com']?.(footnote, translationNode, footnote, insertionNode)

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
    const insertionNode = document.createElement('span')

    afterBilingualAppendCompatFn['asteriskmag.com']?.(paragraph, translationNode, paragraph, insertionNode)
    vi.advanceTimersByTime(60)

    expect(translationNode.classList.contains('only-translate-asterisk-footnote')).toBe(false)
    expect(resizeHandler).not.toHaveBeenCalled()

    window.removeEventListener('resize', resizeHandler)
  })

  it('stacks Hugging Face blog heading translations below flex headings', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://huggingface.co/blog/ServiceNow/mosaicleaks'),
      configurable: true
    })
    document.body.innerHTML = `
      <main>
        <div class="blog-content prose">
          <h1 id="article-title" class="group relative flex items-center">
            <a href="#mosaicleaks-can-your-research-agent-keep-a-secret">
              <span class="header-link">#</span>
            </a>
            <span>MosaicLeaks: Can your research agent keep a secret?</span>
          </h1>
        </div>
      </main>
    `
    const heading = document.querySelector<HTMLElement>('#article-title')!
    const translationNode = document.createElement('span')
    const insertionNode = document.createElement('span')
    translationNode.textContent = 'MosaicLeaks：您的研究代理能否保守秘密？'

    afterBilingualAppendCompatFn['huggingface.co']?.(heading, translationNode, heading, insertionNode)

    expect(heading.style.display).toBe('block')
    expect(translationNode.style.display).toBe('block')
  })

  it('skips Hugging Face blog upvote controls outside the article body', () => {
    document.body.innerHTML = `
      <main>
        <aside>
          <div id="upvote-control" data-target="UpvoteControl">
            <div>
              <a href="/login?next=%2Fblog%2FServiceNow%2Fmosaicleaks">
                <div id="upvote-button">Upvote <span>12</span></div>
              </a>
            </div>
          </div>
        </aside>
      </main>
    `
    const profile = siteProfiles.find(item => item.id === 'hugging-face')!
    const skip = profile.skipTarget?.(document.querySelector('#upvote-button')!, {
      mode: 'smart',
      scope: 'smart',
      contentRoot: document.body
    })

    expect(skip).toMatchObject({
      policy: 'hard-skip',
      role: 'metadata',
      reason: 'hugging-face-blog-metadata'
    })
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

  it('recognizes current Hacker News item DOM and keeps metadata untranslated', () => {
    document.body.innerHTML = HN_ITEM_FIXTURE

    const select = selectCompatFn['news.ycombinator.com']!
    const title = document.querySelector('#story-title')!
    const topText = document.querySelector('#top-text')!
    const commentText = document.querySelector('#comment-text')!

    expect(select(title, { mode: 'smart' })).toBe(title)
    expect(select(topText, { mode: 'smart' })).toBe(topText)
    expect(select(document.querySelector('#top-text-paragraph')!, { mode: 'smart' })).toBe(topText)
    expect(select(commentText, { mode: 'smart' })).toBe(commentText)
    expect(select(document.querySelector('#comment-paragraph')!, { mode: 'smart' })).toBe(commentText)

    expect(select(document.querySelector('#comment-cell')!, { mode: 'smart' })).toBe(false)
    expect(select(document.querySelector('#story-user')!, { mode: 'smart' })).toEqual({ skip: true })
    expect(select(document.querySelector('#comment-age')!, { mode: 'smart' })).toEqual({ skip: true })
    expect(select(document.querySelector('#comment-reply')!, { mode: 'smart' })).toEqual({ skip: true })
    expect(select(document.querySelector('#nav-newest')!, { mode: 'smart' })).toEqual({ skip: true })
    expect(select(document.querySelector('#vote-arrow')!, { mode: 'smart' })).toBe(false)
  })

  it('supplements the Hacker News story text that sits outside the comment tree', () => {
    document.body.innerHTML = HN_ITEM_FIXTURE

    const targets = supplementalCompatFn['news.ycombinator.com']?.(document.body, { mode: 'smart' }) ?? []

    expect(targets).toContain(document.querySelector('#story-title'))
    expect(targets).toContain(document.querySelector('#top-text'))
    expect(targets).toContain(document.querySelector('#comment-text'))
    expect(targets).not.toContain(document.querySelector('#story-user'))
    expect(targets).not.toContain(document.querySelector('#comment-cell'))
  })

  it('still recognizes legacy Hacker News selectors', () => {
    document.body.innerHTML = `
      <table>
        <tr class="athing">
          <td class="title"><a id="legacy-title" class="titlelink" href="item?id=1">Legacy story title</a></td>
        </tr>
        <tr>
          <td class="default">
            <div class="comment"><span id="legacy-comment" class="commtext c00">Legacy comment body.</span></div>
          </td>
        </tr>
      </table>
    `

    const select = selectCompatFn['news.ycombinator.com']!

    expect(select(document.querySelector('#legacy-title')!, { mode: 'smart' })).toBe(document.querySelector('#legacy-title'))
    expect(select(document.querySelector('#legacy-comment')!, { mode: 'smart' })).toBe(document.querySelector('#legacy-comment'))
  })

  it('keeps recognizing the Hacker News user profile about cell', () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>about:</td>
          <td id="about-cell" class="default">Engineer writing about compilers and coffee.</td>
        </tr>
      </table>
    `

    expect(selectCompatFn['news.ycombinator.com']?.(document.querySelector('#about-cell')!, { mode: 'smart' }))
      .toBe(document.querySelector('#about-cell'))
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

  it('supplements WSJ article headlines without collecting nearby navigation or recommendations', () => {
    document.body.innerHTML = `
      <main>
        <div class="article-container">
          <div class="article-header">
            <nav><a id="breadcrumb" href="/business">Business</a></nav>
            <div class="crawler">
              <div><h1 id="article-title">Corporate America Has Suddenly Decided to Stop Blowing Money on AI</h1></div>
              <h2 id="article-dek">Companies big and small are mixing models and changing the economics of the industry</h2>
            </div>
          </div>
          <article><p>Companies are adding lower-priced models alongside their existing artificial intelligence providers.</p></article>
        </div>
        <section class="further-reading">
          <h2 id="related-title">Further Reading</h2>
        </section>
      </main>
    `

    const targets = supplementalCompatFn['wsj.com']?.(document.body, { mode: 'smart' }) ?? []

    expect(targets).toContain(document.querySelector('#article-title'))
    expect(targets).toContain(document.querySelector('#article-dek'))
    expect(targets).not.toContain(document.querySelector('#breadcrumb'))
    expect(targets).not.toContain(document.querySelector('#related-title'))
  })
})
