import { beforeEach, describe, expect, it } from 'vitest'
import { selectCompatFn } from '@/entrypoints/main/compat'

function githubSkipResult(element: Element, mode: 'smart' | 'full') {
  return selectCompatFn['github.com']?.(element, { mode })
}

describe('GitHub compat rules', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('skips repository navigation tabs in full mode', () => {
    document.body.innerHTML = `
      <nav aria-label="Repository">
        <a class="UnderlineNav-item" href="/HKUDS/nanobot/pulls">
          <span id="pulls">Pull requests</span>
          <span class="Counter">597</span>
        </a>
        <a class="UnderlineNav-item" href="/HKUDS/nanobot/security">
          <span id="security">Security and quality</span>
          <span class="Counter">3</span>
        </a>
      </nav>
    `

    expect(githubSkipResult(document.querySelector('#pulls')!, 'full')).toEqual({ skip: true })
    expect(githubSkipResult(document.querySelector('#security')!, 'full')).toEqual({ skip: true })
  })

  it('keeps full mode lighter than smart mode for broad GitHub UI containers', () => {
    document.body.innerHTML = `
      <main>
        <div class="BorderGrid-row">
          <p id="about">This project explores agent workflows and provides a readable overview for developers.</p>
        </div>
      </main>
    `

    const about = document.querySelector('#about')!

    expect(githubSkipResult(about, 'full')).toBe(false)
    expect(githubSkipResult(about, 'smart')).toEqual({ skip: true })
  })

  it('skips repository sidebar metadata in full mode to avoid partial UI translation', () => {
    document.body.innerHTML = `
      <aside class="Layout-sidebar">
        <div class="BorderGrid-row">
          <a id="security-policy" href="/owner/repo/security/policy">Security policy</a>
          <a id="custom-properties" href="/owner/repo/custom-properties">Custom properties</a>
          <a id="report-repository" href="/contact/report-content?content_url=https://github.com/owner/repo">Report repository</a>
        </div>
      </aside>
    `

    expect(githubSkipResult(document.querySelector('#security-policy')!, 'full')).toEqual({ skip: true })
    expect(githubSkipResult(document.querySelector('#custom-properties')!, 'full')).toEqual({ skip: true })
    expect(githubSkipResult(document.querySelector('#report-repository')!, 'full')).toEqual({ skip: true })
  })

  it('skips repository release widgets in full mode', () => {
    document.body.innerHTML = `
      <aside class="Layout-sidebar">
        <div class="release-entry">
          <a id="release-title" href="/owner/repo/releases/tag/v0.1.5.post3">v0.1.5.post3</a>
          <span id="latest">Latest</span>
          <a id="more-releases" href="/owner/repo/releases">+ 14 releases</a>
        </div>
      </aside>
    `

    expect(githubSkipResult(document.querySelector('#release-title')!, 'full')).toEqual({ skip: true })
    expect(githubSkipResult(document.querySelector('#latest')!, 'full')).toEqual({ skip: true })
    expect(githubSkipResult(document.querySelector('#more-releases')!, 'full')).toEqual({ skip: true })
  })

  it('keeps non-sidebar BorderGrid content available in full mode', () => {
    document.body.innerHTML = `
      <main>
        <div class="BorderGrid-row">
          <p id="about">This project explores agent workflows and provides a readable overview for developers.</p>
        </div>
      </main>
    `

    const about = document.querySelector('#about')!

    expect(githubSkipResult(about, 'full')).toBe(false)
  })

  it('uniformly skips About sidebar entries in full mode regardless of label length', () => {
    document.body.innerHTML = `
      <aside class="Layout-sidebar">
        <div class="BorderGrid-row">
          <div class="BorderGrid-cell">
            <ul class="list-style-none">
              <li><a id="readme" href="#readme-ov-file">Readme</a></li>
              <li><a id="license" href="/owner/repo/blob/HEAD/LICENSE">AGPL-3.0, MIT licenses found</a></li>
              <li><a id="conduct" href="/owner/repo/blob/HEAD/CODE_OF_CONDUCT.md">Code of conduct</a></li>
              <li><a id="contributing" href="/owner/repo/blob/HEAD/CONTRIBUTING.md">Contributing</a></li>
              <li><a id="security" href="/owner/repo/security/policy">Security policy</a></li>
              <li><a id="activity" href="/owner/repo/activity">Activity</a></li>
              <li><a id="custom-properties" href="/owner/repo/custom-properties">Custom properties</a></li>
              <li><a id="report" href="/contact/report-content?content_url=https://github.com/owner/repo">Report repository</a></li>
            </ul>
          </div>
        </div>
      </aside>
    `

    const ids = ['readme', 'license', 'conduct', 'contributing', 'security', 'activity', 'custom-properties', 'report']
    for (const id of ids) {
      expect(githubSkipResult(document.querySelector(`#${id}`)!, 'full')).toEqual({ skip: true })
    }
  })

  it('keeps smart mode stricter for non-sidebar BorderGrid content', () => {
    document.body.innerHTML = `
      <main>
        <div class="BorderGrid-row">
        <p id="about">This project explores agent workflows and provides a readable overview for developers.</p>
        </div>
      </main>
    `

    const about = document.querySelector('#about')!

    expect(githubSkipResult(about, 'smart')).toEqual({ skip: true })
  })
})
