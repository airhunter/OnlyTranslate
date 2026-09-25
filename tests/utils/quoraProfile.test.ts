import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/utils/config', () => ({
  config: { translationScope: 'smart', display: 1 }
}))
vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  translateText: vi.fn()
}))
vi.mock('@/entrypoints/utils/icon', () => ({
  insertFailedTip: vi.fn(),
  insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() }))
}))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }))

import { getTranslatableText } from '@/entrypoints/main/dom'
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'
import { collectDynamicTranslationNodes } from '@/entrypoints/main/translationTarget/dynamic'
import { invalidateContentFilterCache } from '@/entrypoints/utils/contentFilter'

const fixture = fs.readFileSync(path.resolve('tests/fixtures/translation-target/quora-answer-comments.html'), 'utf8')

describe('Quora answer targets', () => {
  const originalLocation = window.location

  beforeEach(() => {
    document.body.innerHTML = fixture
    invalidateContentFilterCache(document.body)
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.quora.com/Does-corruption-exist-in-Japan/answer/Ken-Hower'),
      configurable: true
    })
  })

  it('keeps the question, answer, and comment bodies as separate targets', () => {
    const result = resolveAutoTranslationTarget('smart')
    expect(result.nodes.map(node => node.id || `${node.tagName}.${node.className}`)).toEqual([
      'answer-body', 'answer-body-2', 'answer-body-3', 'answer-body-4', 'answer-body-5',
      'question-title', 'comment-body', 'reply-body', 'truncated-comment'
    ])
    expect(result.contentRoot.contains(document.querySelector('#comment-body'))).toBe(false)
    expect(getTranslatableText(document.querySelector('#truncated-comment')!)).not.toContain('(more)')
  })

  it('includes the title and comments in full-page mode', () => {
    const ids = resolveAutoTranslationTarget('full').nodes.map(node => node.id)
    expect(ids).toEqual(expect.arrayContaining([
      'question-title', 'comment-body', 'reply-body', 'truncated-comment'
    ]))
  })

  it('collects a comment added after the initial scan', () => {
    const initial = resolveAutoTranslationTarget('smart')
    const card = document.createElement('div')
    card.className = 'q-box qu-pt--small qu-bg--raised'
    card.innerHTML = '<a href="/answer/Ken-Hower?comment_id=999&amp;comment_type=2">Sep 25</a><p id="new-comment" class="q-text qu-display--block qu-wordBreak--break-word">A newly loaded comment about corruption in Japan.</p>'
    document.querySelector('#mainContent')!.appendChild(card)

    const nodes = collectDynamicTranslationNodes(card, document.querySelector('#answer-body')!, 'smart', initial.grabOptions)
    expect(nodes.map(node => node.id)).toContain('new-comment')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })
})
