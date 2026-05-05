import { beforeEach, describe, expect, it } from 'vitest'

import { selectCompatFn } from '@/entrypoints/main/compat'

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

  it('still skips common Reddit action controls in smart mode', () => {
    document.body.innerHTML = `
      <div data-click-id="share" id="share">Share</div>
    `

    const share = document.querySelector('#share') as Element

    expect(redditResult(share, 'smart')).toEqual({ skip: true })
  })
})
