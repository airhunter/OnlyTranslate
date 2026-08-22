import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@/entrypoints/main/trans', () => ({
  handleBtnTranslation: vi.fn()
}))

import {
  cleanupDirectTextTargets,
  DIRECT_TEXT_TARGET_ATTR,
  getTranslatableHTML,
  getTranslatableText,
  getTranslatableTextWithProtectedInline,
  grabAllNode,
  grabNode,
  LLMStandardHTML,
  renderTextWithProtectedInline
} from '@/entrypoints/main/dom'
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter'
import { classifyContentUnit } from '@/entrypoints/utils/contentUnitClassifier'

describe('grabAllNode', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps default behavior when no subtree filter is provided', () => {
    document.body.innerHTML = `
      <article>
        <p id="keep">Readable article paragraph.</p>
        <section id="skip">
          <p id="also-keep">Promotional paragraph.</p>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).toContain('keep')
    expect(ids).toContain('also-keep')
  })

  it('rejects all text nodes inside a skipped subtree', () => {
    document.body.innerHTML = `
      <article>
        <p id="keep">Readable article paragraph.</p>
        <section id="skip">
          <p id="promo">Promotional paragraph.</p>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body, {
      shouldSkipSubtree: (element) => element.id === 'skip'
    }).map((node) => node.id)

    expect(ids).toContain('keep')
    expect(ids).not.toContain('promo')
  })

  it('excludes script source when extracting translatable text and html', () => {
    document.body.innerHTML = `
      <h1 id="year">1989 - <script>document.write(new Date().getFullYear())</script>2026</h1>
    `

    const node = document.querySelector('#year') as HTMLElement

    expect(getTranslatableText(node)).toBe('1989 - 2026')
    expect(getTranslatableHTML(node)).toBe('1989 - 2026')
    expect(LLMStandardHTML(node)).toBe('1989 - 2026')
  })

  it('preserves protected inline code when rendering translated text', () => {
    document.body.innerHTML = `
      <p id="intro"><strong>VS Code</strong> is mature. Run <code>code --install-extension Anthropic.claude-code</code>.</p>
    `

    const node = document.querySelector('#intro') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(node)
    const placeholder = result.protectedInlines[0].placeholder

    expect(result.text).toBe(`VS Code is mature. Run ${placeholder}.`)
    expect(result.text).not.toContain('code --install-extension')

    const fragment = renderTextWithProtectedInline(`VS Code 已成熟。运行 ${placeholder}。`, result.protectedInlines)
    const host = document.createElement('span')
    host.append(fragment as DocumentFragment)

    expect(host.innerHTML).toBe('VS Code 已成熟。运行 <code>code --install-extension Anthropic.claude-code</code>。')
  })

  it('translates long natural-language prose that is only styled with inline code tags', () => {
    document.body.innerHTML = `
      <blockquote id="research-task">
        <p><code>Put this sandbox through its paces as a fast secure environment. Explore what it would take to run untrusted Python and JavaScript code with strict limits on RAM, CPU time, network access, and filesystem access.</code></p>
        <p><code>Goal is to execute user-provided tasks safely for practical workflows such as recurring data transformations and document processing.</code></p>
      </blockquote>
    `

    const quote = document.querySelector('#research-task') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(quote)

    expect(result.protectedInlines).toHaveLength(0)
    expect(result.text).toContain('Put this sandbox through its paces')
    expect(result.text).toContain('Goal is to execute user-provided tasks safely')
  })

  it('keeps long source code protected outside prose-styled code tags', () => {
    document.body.innerHTML = `
      <blockquote id="source-example">
        <pre><code>const sandbox = createSandbox({ network: false, memory: 128 });
for (const task of userProvidedTasks) { sandbox.execute(task); }</code></pre>
      </blockquote>
    `

    const quote = document.querySelector('#source-example') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(quote)

    expect(result.protectedInlines).toHaveLength(1)
    expect(result.text.trim()).toBe(result.protectedInlines[0].placeholder)
  })

  it('preserves default keepSelector inline elements without preserving a link shell', () => {
    document.body.innerHTML = `
      <p id="intro">
        Open <a href="/docs">the <code>Config</code> guide</a>, set <var>targetLang</var>, and keep
        <span class="math">E = mc^2</span> unchanged.
      </p>
    `

    const node = document.querySelector('#intro') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(node)

    expect(result.protectedInlines).toHaveLength(3)
    expect(result.text).toContain('the ')
    expect(result.text).toContain(' guide')
    expect(result.text).not.toContain('Config')
    expect(result.text).not.toContain('targetLang')
    expect(result.text).not.toContain('E = mc^2')

    const [code, variable, formula] = result.protectedInlines
    const fragment = renderTextWithProtectedInline(
      `打开这份 ${code.placeholder} 指南，设置 ${variable.placeholder}，并保持 ${formula.placeholder} 不变。`,
      result.protectedInlines
    )
    const host = document.createElement('span')
    host.append(fragment as DocumentFragment)

    expect(host.innerHTML).toBe('打开这份 <code>Config</code> 指南，设置 <var>targetLang</var>，并保持 <span class="math">E = mc^2</span> 不变。')
    expect(host.querySelector('a')).toBeNull()
  })

  it('keeps MathJax v3 inline containers inside the complete paragraph', () => {
    document.body.innerHTML = `
      <p id="math-paragraph">Kaplan found <mjx-container jax="CHTML"><mjx-math aria-hidden="true"></mjx-math><mjx-assistive-mml><math><mi>N</mi><mo>proportional to</mo><mi>C</mi></math></mjx-assistive-mml></mjx-container> and concluded that model size should grow faster than dataset size.</p>
    `

    const node = document.querySelector('#math-paragraph') as HTMLElement
    const math = node.querySelector('mjx-container') as HTMLElement
    const targets = grabAllNode(document.body)
    const result = getTranslatableTextWithProtectedInline(node)
    const placeholder = result.protectedInlines[0].placeholder

    expect(grabNode(node)).toBe(node)
    expect(targets).toContain(node)
    expect(result.protectedInlines).toHaveLength(1)
    expect(result.text).toBe(`Kaplan found ${placeholder} and concluded that model size should grow faster than dataset size.`)

    const fragment = renderTextWithProtectedInline(
      `Kaplan 得出 ${placeholder}，并认为模型规模的增长速度应快于数据集规模。`,
      result.protectedInlines
    )
    const host = document.createElement('span')
    host.append(fragment as DocumentFragment)

    expect(host.querySelector('mjx-container')?.outerHTML).toBe(math.outerHTML)
  })

  it('returns null when protected inline placeholders are missing', () => {
    document.body.innerHTML = `
      <p id="intro">Run <code>npm install</code>.</p>
    `

    const node = document.querySelector('#intro') as HTMLElement
    const result = getTranslatableTextWithProtectedInline(node)

    expect(renderTextWithProtectedInline('运行 npm install。', result.protectedInlines)).toBeNull()
  })

  it('does not select date-only nodes because of script source text', () => {
    document.body.innerHTML = `
      <article>
        <h1 id="year">1989 - <script>document.write(new Date().getFullYear())</script>2026</h1>
        <p id="intro">This readable paragraph should still be translated.</p>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).not.toContain('year')
    expect(ids).toContain('intro')
  })

  it('delegates first-line text translation through an injected callback', () => {
    document.body.innerHTML = `
      <div id="host">Intro text that belongs to the first line <div>metadata</div></div>
    `

    const calls: Array<{ textNode: Text; text: string }> = []
    const host = document.querySelector('#host') as HTMLElement
    const result = grabNode(host, {
      translateFirstLineText: (textNode, text) => {
        calls.push({ textNode, text })
      }
    })

    expect(result).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0].text).toBe('Intro text that belongs to the first line ')
    expect(calls[0].textNode.nodeType).toBe(Node.TEXT_NODE)
  })

  it('delegates button text translation through an injected callback', () => {
    document.body.innerHTML = `
      <button id="action">Translate this action</button>
    `

    const calls: HTMLElement[] = []
    const button = document.querySelector('#action') as HTMLElement
    const result = grabNode(button, {
      translateButtonText: (element) => {
        calls.push(element)
      }
    })

    expect(result).toBe(false)
    expect(calls).toEqual([button])
  })

  it('uses the readable tweet quote when manual translation hits an Astro tweet embed host', () => {
    document.body.innerHTML = `
      <article>
        <astro-embed-tweet id="tweet-host">
          <blockquote id="tweet-blockquote" class="twitter-tweet" data-dnt="true" data-theme="light">
            <p lang="en" dir="ltr">
              So tired. Everyone is so tired.
              <br><br>
              Meetings keep getting cancelled because no one has a topic.
            </p>
            — Jay Conrod (@jayconrod)
            <a href="https://x.com/jayconrod/status/1428087609532686342">August 18, 2021</a>
          </blockquote>
        </astro-embed-tweet>
      </article>
    `

    const host = document.querySelector('#tweet-host') as HTMLElement
    const blockquote = document.querySelector('#tweet-blockquote') as HTMLElement

    expect(grabNode(host)).toBe(blockquote)
  })

  it('wraps the direct inline run when manual translation hits a nested list item prefix', () => {
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

    const label = document.querySelector('#first-label') as HTMLElement
    const target = grabNode(label) as HTMLElement

    expect(target.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(target.parentElement?.id).toBe('first-event')
    expect(target.textContent).toContain('Log Event:')
    expect(target.textContent).toContain('Pinging Server West-2 for redundancy check.')
    expect(target.textContent).not.toContain('Filter Verdict')

    const repeatedTarget = grabNode(label) as HTMLElement

    expect(repeatedTarget).toBe(target)
    expect(document.querySelectorAll('[data-fr-direct-text-target="true"]')).toHaveLength(1)
  })

  it('wraps the direct inline run when manual translation hits direct text after an inline label', () => {
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

    const label = document.querySelector('#first-label') as HTMLElement
    const directText = label.nextSibling as Text
    const target = grabNode(directText) as HTMLElement

    expect(target.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(target.parentElement?.id).toBe('first-event')
    expect(target.textContent).toContain('Pinging Server West-2 for redundancy check.')
    expect(target.textContent).not.toContain('Filter Verdict')
  })

  it('wraps direct prose that follows a block figure in an article body', () => {
    document.body.innerHTML = `
      <article id="story">
        <div id="article-body">
          <figure id="equipment-figure">
            <img src="/equipment.jpg" alt="Manufacturing equipment">
            <figcaption>FOMD system installed at the peptide manufacturing facility.</figcaption>
          </figure>
          Recently, demand for APIs has shifted from traditional high-volume small molecules to a broader need across biologics, peptides, oligonucleotides, viral vectors, and more.
        </div>
      </article>
    `

    const directText = document.querySelector('#equipment-figure')?.nextSibling as Text
    const target = grabNode(directText) as HTMLElement

    expect(target.getAttribute(DIRECT_TEXT_TARGET_ATTR)).toBe('true')
    expect(target.parentElement?.id).toBe('article-body')
    expect(target.textContent).toContain('Recently, demand for APIs has shifted')
    expect(target.textContent).not.toContain('FOMD system installed')
  })

  it('wraps long direct prose between article section blocks and keeps strikethrough inline', () => {
    document.body.innerHTML = `
      <article>
        <section id="intro">
          <p id="previous-paragraph">The previous paragraph is already a normal translation target.</p>
          Most companies I applied to invited me for interviews, with the exception of several research labs.
          I applied repeatedly and never heard back once, despite people in my own lab getting replies. My
          <s id="struck-word">love</s>
          cover letters were works of art. You can reach me at the email you already have on file, multiple times.
        </section>
        <section id="topics">
          <h2 id="topics-title">Technical Topics</h2>
          Here is a list of topics I created before I started interviewing. Personally, I was asked a lot about
          language models and reinforcement learning, reflecting my background. Make sure to cover everything well!
          <p></p>
          <div id="topic-grid"><h3>Machine Learning</h3></div>
        </section>
      </article>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(2)
    expect(wrappers[0].textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'Most companies I applied to invited me for interviews'
    )
    expect(wrappers[0].textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'My love cover letters were works of art.'
    )
    expect(document.querySelector('#struck-word')?.closest(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrappers[0])
    expect(wrappers[0].contains(document.querySelector('#previous-paragraph'))).toBe(false)
    expect(wrappers[1].textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'Here is a list of topics I created before I started interviewing.'
    )
    expect(wrappers[1].contains(document.querySelector('#topics-title'))).toBe(false)
    expect(wrappers[1].contains(document.querySelector('#topic-grid'))).toBe(false)
  })

  it('does not wrap long mixed-block direct text outside an article or main reading area', () => {
    document.body.innerHTML = `
      <section id="layout-section">
        <h2>Product navigation</h2>
        This layout description is intentionally long enough to resemble prose. It has sentence punctuation and
        more than enough characters, but it is outside an article or main reading area and must stay unwrapped.
      </section>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(0)
  })

  it('wraps legacy font inline flow into br-separated direct text targets', () => {
    document.body.innerHTML = `
      <article>
        <font id="essay-body" size="2" face="verdana">
          June 2026<br><br>
          <i id="intro-note">This is based on a talk I gave at the Oxford Union.</i><br><br>
          Since this is apparently the future prime ministers' club, I'm going
          to tell you about how people become billionaires. Starting a successful
          startup is the most <a id="inline-link" href="/richnow.html">common</a>
          way to become a billionaire.<br><br>
          Of course it's possible. It's <i id="inline-emphasis">hard</i>, but it's possible.
        </font>
      </article>
    `

    const nodes = grabAllNode(document.body)
    const wrappers = nodes.filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(4)
    expect(wrappers.map(node => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'June 2026',
      'This is based on a talk I gave at the Oxford Union.',
      "Since this is apparently the future prime ministers' club, I'm going to tell you about how people become billionaires. Starting a successful startup is the most common way to become a billionaire.",
      "Of course it's possible. It's hard, but it's possible."
    ])
    expect(nodes).not.toContain(document.querySelector('#inline-link'))
    expect(nodes).not.toContain(document.querySelector('#inline-emphasis'))
  })

  it('uses every authored br as a generic direct-text run boundary', () => {
    document.body.innerHTML = `
      <main>
        <div id="lyrics">
          A dream so real it takes her back<br>
          She's falling into her own past<br><br>
          <em id="emphasized-line">When will the light take over</em><br>
          These dark days
        </div>
      </main>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers.map(node => node.textContent?.trim())).toEqual([
      'A dream so real it takes her back',
      "She's falling into her own past",
      'When will the light take over',
      'These dark days'
    ])
    expect(document.querySelector('#lyrics')?.querySelectorAll(':scope > br')).toHaveLength(4)
    expect(document.querySelector('#emphasized-line')?.closest(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrappers[2])
  })

  it('splits br-separated runs inside nested inline containers', () => {
    document.body.innerHTML = `
      <article>
        <p id="verse"><span id="nested-flow">First nested line<br>Second <strong id="nested-emphasis">nested line</strong></span></p>
      </article>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers.map(node => node.textContent?.trim())).toEqual([
      'First nested line',
      'Second nested line'
    ])
    expect(document.querySelector('#nested-emphasis')?.closest(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBe(wrappers[1])
    expect(document.querySelector('#nested-flow')?.querySelectorAll(':scope > br')).toHaveLength(1)
  })

  it('does not split br-separated direct text inside navigation controls', () => {
    document.body.innerHTML = `
      <nav>
        <div id="navigation-lines">Browse songs<br>Browse artists</div>
      </nav>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(0)
    expect(document.querySelector('#navigation-lines')?.textContent).toBe('Browse songsBrowse artists')
  })

  it('splits legacy font prose around a blockquote boundary', () => {
    document.body.innerHTML = `
      <article>
        <font id="essay-body" size="2" face="verdana">
          The opening paragraph explains how to choose meaningful work and why curiosity matters.<br><br>
          <blockquote id="essay-quote">The best lack all conviction, while the worst are full of passionate intensity.</blockquote>
          The closing paragraph continues the essay after the quotation without merging both blocks.
        </font>
      </article>
    `

    const nodes = grabAllNode(document.body)
    const wrappers = nodes.filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(2)
    expect(wrappers.map(node => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'The opening paragraph explains how to choose meaningful work and why curiosity matters.',
      'The closing paragraph continues the essay after the quotation without merging both blocks.'
    ])
    expect(nodes).toContain(document.querySelector('#essay-quote'))
    expect(wrappers.every(wrapper => !wrapper.contains(document.querySelector('#essay-quote')))).toBe(true)
  })

  it('uses a single br as a hard boundary inside legacy font flows', () => {
    document.body.innerHTML = `
      <article>
        <font id="essay-body" size="2" face="verdana">
          First line of the same paragraph<br>
          continues with enough natural language to stay together.<br><br>
          Second paragraph has enough detail to become another target.
        </font>
      </article>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers.map(node => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'First line of the same paragraph',
      'continues with enough natural language to stay together.',
      'Second paragraph has enough detail to become another target.'
    ])
  })

  it('does not use legacy font wrapping without a br paragraph boundary', () => {
    document.body.innerHTML = `
      <article>
        <font id="essay-body" size="2" face="verdana">
          A short inline note without legacy paragraph breaks.
          <i id="inline-emphasis">Still inline.</i>
        </font>
      </article>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(0)
  })

  it('does not use legacy font wrapping inside navigation', () => {
    document.body.innerHTML = `
      <nav>
        <font id="nav-font" size="2" face="verdana">
          Home page introduction with many words.<br><br>
          Essays archive and other navigation labels.
        </font>
      </nav>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(0)
  })

  it('does not use legacy font wrapping for high link density text', () => {
    document.body.innerHTML = `
      <article>
        <font id="link-list" size="2" face="verdana">
          Browse <a href="/home">Home</a> <a href="/essays">Essays</a>
          <a href="/books">Books</a> <a href="/rss">RSS</a><br><br>
          More <a href="/bio">Bio</a> <a href="/twitter">Twitter</a>
          <a href="/mastodon">Mastodon</a>
        </font>
      </article>
    `

    const wrappers = grabAllNode(document.body)
      .filter(node => node.hasAttribute(DIRECT_TEXT_TARGET_ATTR))

    expect(wrappers).toHaveLength(0)
  })

  it('wraps the direct inline run even when a nested child block is long', () => {
    const nestedDetail = Array.from({ length: 120 }, () => 'Nested detail should not decide the prefix target.').join(' ')
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Compare the repair estimate.
            <ul>
              <li id="long-child">${nestedDetail}</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const target = grabNode(document.querySelector('#first-label')) as HTMLElement

    expect(target.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(target.textContent).toContain('Compare the repair estimate.')
    expect(target.textContent).not.toContain('Nested detail')
  })

  it('excludes hidden inline siblings from a direct text run wrapper', () => {
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <span style="display: none">Hidden prefix should not translate.</span>
            <span style="visibility: hidden">Invisible prefix should not translate.</span>
            <span style="visibility: collapse">Collapsed prefix should not translate.</span>
            <em id="first-label">Log Event:</em> Compare the repair estimate.
            <ul>
              <li>Nested child stays separate.</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const target = grabNode(document.querySelector('#first-label')) as HTMLElement

    expect(target.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(target.textContent).toContain('Log Event:')
    expect(target.textContent).not.toContain('Hidden prefix')
    expect(target.textContent).not.toContain('Invisible prefix')
    expect(target.textContent).not.toContain('Collapsed prefix')
  })

  it('keeps nested list item hits on the nested child target', () => {
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em>Log Event:</em> Pinging Server West-2 for redundancy check.
            <ul>
              <li id="first-verdict"><em id="verdict-label">Filter Verdict:</em> <strong>Hide.</strong> (Low Stakes, High Technicality).</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const verdictLabel = document.querySelector('#verdict-label') as HTMLElement
    const target = grabNode(verdictLabel) as HTMLElement

    expect(target.id).toBe('first-verdict')
    expect(target.getAttribute('data-fr-direct-text-target')).toBeNull()
  })

  it('wraps direct inline runs in generic mixed definition and quote blocks', () => {
    document.body.innerHTML = `
      <article>
        <dl>
          <dd id="definition">
            <strong id="term-label">Term:</strong> explanation before nested detail.
            <div id="definition-detail">Nested definition detail should stay separate.</div>
          </dd>
        </dl>
        <blockquote id="quote">
          <em id="quote-label">Quote:</em> direct quote before nested paragraph.
          <p id="quote-detail">Nested paragraph should stay separate.</p>
        </blockquote>
      </article>
    `

    const definitionTarget = grabNode(document.querySelector('#term-label')) as HTMLElement
    const quoteTarget = grabNode(document.querySelector('#quote-label')) as HTMLElement

    expect(definitionTarget.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(definitionTarget.parentElement?.id).toBe('definition')
    expect(definitionTarget.textContent).toContain('Term:')
    expect(definitionTarget.textContent).not.toContain('Nested definition detail')

    expect(quoteTarget.getAttribute('data-fr-direct-text-target')).toBe('true')
    expect(quoteTarget.parentElement?.id).toBe('quote')
    expect(quoteTarget.textContent).toContain('Quote:')
    expect(quoteTarget.textContent).not.toContain('Nested paragraph')
  })

  it('keeps flat list items and inline-link paragraphs as element targets', () => {
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="flat-item"><em id="flat-label">Memories</em> receives it and scans the image.</li>
        </ul>
        <p id="inline-paragraph">Read the <a id="inline-link" href="/guide">complete guide</a> before starting.</p>
      </article>
    `

    expect(grabNode(document.querySelector('#flat-label'))).toBe(document.querySelector('#flat-item'))
    expect(grabNode(document.querySelector('#inline-link'))).toBe(document.querySelector('#inline-paragraph'))
    expect(document.querySelector('[data-fr-direct-text-target="true"]')).toBeNull()
  })

  it('unwraps direct text wrappers when only an ancestor target is kept', () => {
    document.body.innerHTML = `
      <article>
        <ul>
          <li id="first-event">
            <em id="first-label">Log Event:</em> Compare the repair estimate.
            <ul>
              <li>Nested child stays separate.</li>
            </ul>
          </li>
        </ul>
      </article>
    `

    const host = document.querySelector('#first-event')!
    const wrapper = grabNode(document.querySelector('#first-label')) as HTMLElement

    cleanupDirectTextTargets(new Set([wrapper]), [host])

    expect(document.querySelector(`[${DIRECT_TEXT_TARGET_ATTR}="true"]`)).toBeNull()
    expect(document.querySelector('#first-label')?.parentElement).toBe(host)
  })

  it('keeps DOM utilities independent from translation execution', () => {
    const source = readFileSync(resolve(process.cwd(), 'entrypoints/main/dom.ts'), 'utf8')

    expect(source).not.toMatch(/entrypoints\/main\/trans["']/)
    expect(source).not.toMatch(/from\s+["'][^"']*\/trans["']/)
  })

  it('does not treat short readable identifiers as user names', () => {
    document.body.innerHTML = `
      <article>
        <h2 id="web3">web3</h2>
        <h2 id="step">step_2</h2>
        <h2 id="act">act_1</h2>
      </article>
    `

    const web3 = document.querySelector('#web3') as HTMLElement
    const step = document.querySelector('#step') as HTMLElement
    const act = document.querySelector('#act') as HTMLElement

    expect(grabNode(web3)).toBe(web3)
    expect(grabNode(step)).toBe(step)
    expect(grabNode(act)).toBe(act)
  })

  it('continues after a selected paragraph that contains multiple inline links', () => {
    document.body.innerHTML = `
      <article>
        <p id="previous">
          We do not have access to the internals of companies.
          Like this supposed <a href="/aws-outage">AI caused outage at AWS</a>.
          Which AWS immediately <a href="/corrected">corrected</a>.
          Only to then follow up internally with a <a href="/reset">90-day reset</a>.
        </p>
        <p id="middle">
          Satya Nadella, the CEO of Microsoft, has been going on about
          <a href="/ai-code">how much code is now being written by AI</a>
          at Microsoft. While we do not have direct evidence, there sure is a feeling that Windows is struggling.
          Microsoft itself seems to agree, based on this fine <a href="/blog-post">blog post</a>.
        </p>
        <p id="after">Companies claiming that all product code is written by AI keep shipping rough software.</p>
      </article>
    `

    const ids = grabAllNode(document.body).map((node) => node.id)

    expect(ids).toContain('previous')
    expect(ids).toContain('middle')
    expect(ids).toContain('after')
  })

  it('keeps strong readable leaves inside skip-self blocks without leaking actions', () => {
    document.body.innerHTML = `
      <section class="reader-comment">
        <p id="body">This readable paragraph sits inside a mixed container with enough text to translate safely.</p>
        <button id="share" type="button">Share</button>
      </section>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: getContentFilterDecision
    }).map((node) => node.id)

    expect(ids).toContain('body')
    expect(ids).not.toContain('share')
  })

  it('keeps site-profile content inside skip-self containers', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.reddit.com/r/digitalnomad/comments/1t3d0e0/china/'),
      configurable: true
    })
    document.body.innerHTML = `
      <shreddit-post id="post">
        <h1 id="post-title" slot="title">China</h1>
        <div id="post-body" slot="text-body" data-post-click-location="text-body">
          Considering spending a month in China. Wondering how much of a headache it is to work there.
        </div>
        <button id="share">Share</button>
      </shreddit-post>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: (element) => element.tagName.toLowerCase() === 'shreddit-post' ? 'skip-self' : 'keep',
      siteCompatMode: 'smart'
    }).map((node) => node.id)

    expect(ids).toContain('post-title')
    expect(ids).toContain('post-body')
    expect(ids).not.toContain('share')
  })

  it('skips TDS-like footer author, tags, share, and CTA descendants in smart filtering', () => {
    document.body.innerHTML = `
      <article>
        <p id="article-body">This paragraph is part of the actual article body. It has enough detail, context, and natural language to look like readable long-form content.</p>
        <section class="author-card">
          <p>WRITTEN BY</p>
          <h2>Ibrahim Salami</h2>
          <a href="/author/ibrahim-salami">See all from Ibrahim Salami</a>
        </section>
        <section class="post-topics">
          <a id="tag-data" href="/tag/data-science">Data Science</a>
          <a id="tag-pandas" href="/tag/pandas">Pandas</a>
          <a id="tag-productivity" href="/tag/productivity">Productivity</a>
          <a id="tag-python" href="/tag/python">Python</a>
        </section>
        <section class="share-this-article">
          <h2 id="share-title">Share This Article</h2>
          <a id="share-facebook" href="https://www.facebook.com/sharer/sharer.php">Share on Facebook</a>
          <a id="share-linkedin" href="https://www.linkedin.com/shareArticle">Share on LinkedIn</a>
          <a id="share-x" href="https://x.com/intent/tweet">Share to X</a>
        </section>
        <section class="author-social-links">
          <a id="social-medium" href="https://medium.com/@ibrahim-salami">Medium</a>
          <a id="social-linkedin" href="https://www.linkedin.com/in/ibrahim-salami">LinkedIn</a>
          <a id="social-twitter" href="https://twitter.com/ibrahim_salami">Twitter</a>
          <a id="social-youtube" href="https://www.youtube.com/@ibrahimsalami">YouTube</a>
        </section>
        <section class="author-program-promo">
          <p id="promo-text">Towards Data Science is a community publication. Submit your insights to reach our global audience and earn through the TDS Author Payment Program.</p>
          <a id="promo-button" href="/write-for-us">Write for TDS</a>
        </section>
      </article>
    `

    const ids = grabAllNode(document.body, {
      contentFilter: getContentFilterDecision
    }).map((node) => node.id)

    expect(ids).toContain('article-body')
    expect(ids).not.toContain('tag-data')
    expect(ids).not.toContain('share-title')
    expect(ids).not.toContain('share-facebook')
    expect(ids).not.toContain('social-medium')
    expect(ids).not.toContain('social-youtube')
    expect(ids).not.toContain('promo-text')
    expect(ids).not.toContain('promo-button')
  })

  it('keeps article header titles when the header also contains a share button', () => {
    document.body.innerHTML = `
      <div role="main" aria-label="Post">
        <article>
          <div role="region" aria-label="Post header">
            <h1 id="archive-title">We Spent 10 Days Touring Chinese AI Labs. Here's What We Saw.</h1>
            <h3 id="archive-subtitle">Sleeping Cots, Robot Pharmacies, and the Race for AGI</h3>
            <div>Lily Ottinger and Kai Williams</div>
            <div>May 08, 2026</div>
            <button>Share</button>
          </div>
          <div id="article-body">This paragraph is part of the actual article body. It has enough detail, context, and natural language to look like readable long-form content.</div>
        </article>
      </div>
    `

    const nodes = grabAllNode(document.body, {
      contentFilter: getContentFilterDecision,
      contentUnitClassifier: classifyContentUnit
    })
    const ids = nodes.map((node) => node.id)

    expect(ids).toContain('archive-title')
    expect(ids).toContain('archive-subtitle')
  })
})
