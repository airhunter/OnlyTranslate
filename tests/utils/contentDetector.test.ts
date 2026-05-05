import { beforeEach, describe, expect, it } from 'vitest'
import { findMainContent } from '@/entrypoints/utils/contentDetector'

const paragraph = 'This paragraph contains enough natural language, commas, and context to look like article body text. '

describe('contentDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('uses a single article as the content root', () => {
    document.body.innerHTML = `
      <nav><a>Home</a><a>Topics</a></nav>
      <article id="story">
        <header><h1>Readable article title</h1></header>
        <div class="article-body">
          <p>${paragraph.repeat(3)}</p>
        </div>
      </article>
      <aside>Related links</aside>
    `

    expect(findMainContent()).toBe(document.querySelector('#story'))
  })

  it('promotes a dense body container to the shell that includes its title', () => {
    document.body.innerHTML = `
      <div class="page">
        <nav><a>Home</a><a>Products</a><a>About</a></nav>
        <main id="reader-shell">
          <header>
            <h1>Readable page title</h1>
            <p>A short standfirst that belongs with the story.</p>
          </header>
          <div class="post-body">
            <p>${paragraph.repeat(4)}</p>
            <p>${paragraph.repeat(3)}</p>
          </div>
        </main>
      </div>
    `

    expect(findMainContent()).toBe(document.querySelector('#reader-shell'))
  })

  it('uses a single credible main as a fast content root', () => {
    document.body.innerHTML = `
      <header><nav><a>US</a><a>World</a><a>Politics</a></nav></header>
      <main id="cnn-live-root">
        <h1>Iran war news and live updates</h1>
        <section>
          <h2>Two reasons why Iran may have attacked the UAE on Monday</h2>
          <p>${paragraph.repeat(4)}</p>
          <p>${paragraph.repeat(3)}</p>
        </section>
      </main>
      <footer>Footer links</footer>
    `

    expect(findMainContent()).toBe(document.querySelector('#cnn-live-root'))
  })

  it('promotes to a shared article shell when the title is a sibling of the body', () => {
    document.body.innerHTML = `
      <header><nav><a>World</a><a>Science</a><a>Travel</a></nav></header>
      <div id="article-shell" class="article-shell">
        <section class="article-hero">
          <h1>Meteor shower peaks tonight. Here is how to watch it</h1>
          <p>A short summary that belongs with the story.</p>
        </section>
        <div class="article-content">
          <p>${paragraph.repeat(5)}</p>
          <p>${paragraph.repeat(4)}</p>
        </div>
      </div>
      <aside class="related"><a>Related story</a><a>Another story</a></aside>
    `

    expect(findMainContent()).toBe(document.querySelector('#article-shell'))
  })

  it('promotes a semantic article to a shared shell when the title sits outside article', () => {
    document.body.innerHTML = `
      <header><nav><a>World</a><a>Science</a><a>Travel</a></nav></header>
      <div id="content-shell" class="article-layout">
        <section class="article-top">
          <h1>May's meteor shower peaks tonight. Here is how to watch it</h1>
        </section>
        <section class="article-wrapper">
          <main>
            <article id="story" class="article">
              <div class="article-content">
                <p>${paragraph.repeat(5)}</p>
                <p>${paragraph.repeat(4)}</p>
              </div>
            </article>
          </main>
        </section>
      </div>
      <aside class="related"><a>Related story</a><a>Another story</a></aside>
    `

    expect(findMainContent()).toBe(document.querySelector('#content-shell'))
  })

  it('does not promote past the content shell into a noisy page layout', () => {
    document.body.innerHTML = `
      <div id="layout">
        <nav>
          <a>World</a><a>Business</a><a>Tech</a><a>Culture</a><a>Sports</a>
        </nav>
        <main id="main-content">
          <h1>Readable page title</h1>
          <div class="content">
            <p>${paragraph.repeat(4)}</p>
            <p>${paragraph.repeat(4)}</p>
          </div>
        </main>
        <aside class="related">
          <a>Related article</a><a>Another recommendation</a>
        </aside>
      </div>
    `

    expect(findMainContent()).toBe(document.querySelector('#main-content'))
  })

  it('falls back to body when there is not enough readable text', () => {
    document.body.innerHTML = `
      <div class="toolbar"><button>Save</button><button>Share</button></div>
      <div class="empty-state">No result</div>
    `

    expect(findMainContent()).toBe(document.body)
  })
})
