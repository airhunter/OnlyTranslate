import { beforeEach, describe, expect, it } from 'vitest'

import { selectCompatFn, supplementalCompatFn } from '@/entrypoints/main/compat'

function redditResult(element: Element, mode: 'smart' | 'full' = 'smart') {
  return selectCompatFn['reddit.com']?.(element, { mode })
}

describe('reddit compat', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps new Reddit post text body translatable in smart mode', () => {
    document.body.innerHTML = `
      <shreddit-post>
        <div data-post-click-location="text-body" id="post-body">
          <p id="post-text">Considering spending a month in China. Wondering how much of a headache it is?</p>
        </div>
      </shreddit-post>
    `

    const paragraph = document.querySelector('#post-text') as Element

    expect(redditResult(paragraph, 'smart')).toBe(document.querySelector('#post-body'))
  })

  it('keeps new Reddit comment body translatable in smart mode', () => {
    document.body.innerHTML = `
      <shreddit-comment>
        <div slot="comment" id="comment-body">
          Very bad idea if you need to work and need access to the non-chinese internet.
        </div>
      </shreddit-comment>
    `

    const comment = document.querySelector('#comment-body') as Element

    expect(redditResult(comment, 'smart')).toBe(comment)
  })

  it('prefers structured text leaves over a media-heavy post wrapper', () => {
    document.body.innerHTML = `
      <shreddit-post view-context="CommentsPage" post-type="multi_media">
        <shreddit-post-text-body id="post-body-host" slot="text-body">
          <div slot="text-body" data-post-click-location="text-body">
            <div id="post-body" property="schema:articleBody">
              <p id="post-text">I have been learning C++ by building a small terminal game.</p>
              <figure id="video-player">
                <p id="video-error">This media could not be loaded.</p>
                <video></video>
              </figure>
            </div>
          </div>
        </shreddit-post-text-body>
      </shreddit-post>
    `

    const paragraph = document.querySelector('#post-text') as Element
    const mediaError = document.querySelector('#video-error') as Element

    expect(redditResult(paragraph, 'smart')).toBe(paragraph)
    expect(redditResult(mediaError, 'smart')).not.toBe(mediaError)
  })

  it('supplements the title and text body of a Reddit comments-page post', () => {
    document.body.innerHTML = `
      <shreddit-post view-context="CommentsPage" post-type="multi_media">
        <h1 id="post-title" slot="title">I am beginning to believe</h1>
        <shreddit-post-text-body slot="text-body">
          <div slot="text-body" data-post-click-location="text-body">
            <div id="post-body" property="schema:articleBody">
              <p id="post-first">I have been learning C++ by building a small terminal game.</p>
              <p id="post-second">I now understand more about memory management.</p>
              <figure id="video-player">
                <p id="video-error">This media could not be loaded.</p>
                <video></video>
              </figure>
            </div>
          </div>
        </shreddit-post-text-body>
      </shreddit-post>
    `

    const targets = supplementalCompatFn['reddit.com']?.(document.body, { mode: 'smart' }) ?? []

    expect(targets).toEqual([
      document.querySelector('#post-title'),
      document.querySelector('#post-first'),
      document.querySelector('#post-second')
    ])
    expect(targets).not.toContain(document.querySelector('#video-player'))
    expect(targets).not.toContain(document.querySelector('#video-error'))
  })

  it('still skips common Reddit action controls in smart mode', () => {
    document.body.innerHTML = `
      <div data-click-id="share" id="share">Share</div>
    `

    const share = document.querySelector('#share') as Element

    expect(redditResult(share, 'smart')).toEqual({ skip: true })
  })
})
