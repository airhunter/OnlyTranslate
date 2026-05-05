import { describe, expect, it } from 'vitest'

import { replaceCompatFn, selectCompatFn } from '@/entrypoints/main/compat'

describe('site profile registry', () => {
  it('registers migrated select profiles by domain', () => {
    expect(selectCompatFn['github.com']).toBeTypeOf('function')
    expect(selectCompatFn['reddit.com']).toBeTypeOf('function')
    expect(selectCompatFn['youtube.com']).toBeTypeOf('function')
    expect(selectCompatFn['x.com']).toBeTypeOf('function')
    expect(selectCompatFn['cnn.com']).toBeTypeOf('function')
    expect(selectCompatFn['medium.com']).toBeTypeOf('function')
    expect(selectCompatFn['stackoverflow.com']).toBeTypeOf('function')
    expect(selectCompatFn['news.ycombinator.com']).toBeTypeOf('function')
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
})
