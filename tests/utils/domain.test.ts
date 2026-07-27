import { describe, expect, it } from 'vitest'

import { getMainDomain } from '@/entrypoints/utils/domain'
import { getMainDomain as getCompatMainDomain } from '@/entrypoints/main/compat'

describe('domain utils', () => {
  it('normalizes common page URLs to their main domain', () => {
    expect(getMainDomain('https://www.github.com/openai/codex')).toBe('github.com')
    expect(getMainDomain(new URL('https://asteriskmag.com/issues/14/the-mystery-in-the-medicine-cabinet'))).toBe('asteriskmag.com')
    expect(getMainDomain('https://docs.python.org')).toBe('python.org')
    expect(getMainDomain('https://news.bbc.co.uk/story')).toBe('bbc.co.uk')
  })

  it('keeps x.com and twitter.com normalized to the x.com profile key', () => {
    expect(getMainDomain('https://twitter.com/openai/status/1')).toBe('x.com')
    expect(getMainDomain('https://www.twitter.com/openai/status/1')).toBe('x.com')
    expect(getMainDomain('https://x.com/openai/status/1')).toBe('x.com')
    expect(getMainDomain('https://www.x.com/openai/status/1')).toBe('x.com')
  })

  it('keeps the Hacker News subdomain as its site profile key', () => {
    expect(getMainDomain('https://news.ycombinator.com/item?id=47555081')).toBe('news.ycombinator.com')
    expect(getMainDomain(new URL('https://news.ycombinator.com/newest'))).toBe('news.ycombinator.com')
  })

  it('keeps the legacy compat facade on the same parser', () => {
    expect(getCompatMainDomain).toBe(getMainDomain)
  })
})
