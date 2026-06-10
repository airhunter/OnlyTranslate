import { beforeEach, describe, expect, it } from 'vitest'

import {
  getProseEvidence,
  getStructuralHint,
  hasReadableSentence,
  MAX_INTERACTIVE_DENSITY,
  PROSE_TEXT_MIN,
  PROSE_TEXT_MIN_SHORT
} from '@/entrypoints/utils/proseSignals'

describe('proseSignals', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  function renderElement(html: string): Element {
    document.body.innerHTML = html
    const element = document.body.firstElementChild
    if (!element) throw new Error('Expected fixture element')
    return element
  }

  it('classifies prose strength from a single threshold table', () => {
    const cases = [
      {
        name: 'long semantic paragraph',
        html: `<p>${'Readable article prose with a complete sentence and enough detail. '.repeat(2)}</p>`,
        strength: 'strong'
      },
      {
        name: 'short complete paragraph',
        html: `<p>${'Short policy update sentence with enough detail to translate.'}</p>`,
        strength: 'strong'
      },
      {
        name: 'dense interactive block',
        html: `<section><a href="/a">Share on Facebook</a><a href="/b">Share on LinkedIn</a><a href="/c">Subscribe today</a></section>`,
        strength: 'none'
      },
      {
        name: 'non paragraph text',
        html: `<section>${'Readable words without paragraph shape but still long enough to be weak evidence for scoring decisions.'}</section>`,
        strength: 'weak'
      }
    ] as const

    for (const item of cases) {
      expect(getProseEvidence(renderElement(item.html)).strength, item.name).toBe(item.strength)
    }
  })

  it('treats pure text divs and inline-only divs as paragraph-like prose', () => {
    const pureText = renderElement(`<div class="promo-copy">This promotion paragraph is actual article prose. It explains the policy instead of asking the reader to sign up.</div>`)
    const inlineOnly = renderElement(`
      <div class="newsletter-note">
        <span>The newsletter format includes readable inline text, </span>
        <a href="/context">a supporting context link</a>
        <span>, and a complete sentence that should be translated.</span>
      </div>
    `)

    expect(getProseEvidence(pureText).isParagraphLike).toBe(true)
    expect(getProseEvidence(pureText).strength).toBe('strong')
    expect(getProseEvidence(inlineOnly).isParagraphLike).toBe(true)
    expect(getProseEvidence(inlineOnly).strength).toBe('strong')
  })

  it('counts buttons as interactive density instead of a hard veto', () => {
    const element = renderElement(`
      <section class="share-section">
        <p>${'This readable article block has enough body text to survive a small copy control. '.repeat(2)}</p>
        <button>Copy</button>
      </section>
    `)

    const evidence = getProseEvidence(element)

    expect(evidence.buttonCount).toBe(1)
    expect(evidence.interactiveDensity).toBeLessThan(MAX_INTERACTIVE_DENSITY)
    expect(evidence.strength).toBe('strong')
  })

  it('keeps prose strength independent from noisy structural names and action words', () => {
    const cases = [
      {
        name: 'strong prose with noisy class and subscribe link',
        html: `
          <section class="newsletter-update">
            <p>
              This archive paragraph describes why some teams subscribe to annual support contracts during migration projects.
              It includes enough surrounding context to read as article prose, and the link is part of the sentence instead of a call-to-action module.
              <a href="/plans">Subscribe plan details</a>
            </p>
          </section>
        `,
        strength: 'strong'
      },
      {
        name: 'dense interactive subscription module',
        html: `
          <section class="newsletter-signup">
            <a href="/newsletter">Subscribe</a>
            <a href="/plans">Join now</a>
            <button>Sign up</button>
          </section>
        `,
        strength: 'none'
      },
      {
        name: 'long text without paragraph shape',
        html: `<section>${'Readable words can still be useful evidence, but without paragraph shape this remains a weaker signal for root scoring. '.repeat(2)}</section>`,
        strength: 'weak'
      }
    ] as const

    for (const item of cases) {
      expect(getProseEvidence(renderElement(item.html)).strength, item.name).toBe(item.strength)
    }
  })

  it('keeps structural hints separate from visible prose text', () => {
    const element = renderElement(`
      <p id="policy-copy" class="article-body" aria-label="Article paragraph">
        Teams subscribe to annual contracts because procurement is easier, and this article compares the related billing tradeoffs.
      </p>
    `)

    const hint = getStructuralHint(element)

    expect(hint).toContain('policy-copy')
    expect(hint).toContain('article-body')
    expect(hint).not.toContain('subscribe')
    expect(hint).not.toContain('related')
  })

  it('exports the shared prose thresholds used by other layers', () => {
    expect(PROSE_TEXT_MIN).toBe(80)
    expect(PROSE_TEXT_MIN_SHORT).toBe(40)
    expect(MAX_INTERACTIVE_DENSITY).toBe(0.45)
    expect(hasReadableSentence('A complete sentence.')).toBe(true)
  })
})
