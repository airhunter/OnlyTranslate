import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockShouldTranslateText = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/entrypoints/utils/translationDirection', () => ({
  shouldTranslateText: mockShouldTranslateText,
}))

import {
  isAddressLikeSelection,
  shouldShowSelectionToolbar,
} from '@/entrypoints/utils/selectionEligibility'

describe('selection toolbar eligibility', () => {
  beforeEach(() => {
    mockShouldTranslateText.mockReset()
    mockShouldTranslateText.mockReturnValue(true)
    document.body.innerHTML = ''
  })

  it.each([
    'https://example.com/docs',
    'www.example.com/docs',
    'reader@example.com',
    'mailto:reader@example.com',
  ])('recognizes explicit address text: %s', text => {
    expect(isAddressLikeSelection(text)).toBe(true)
  })

  it('recognizes a bare domain only when it labels the containing link', () => {
    const link = document.createElement('a')
    link.href = 'https://example.com/'
    link.textContent = 'Example.com'
    document.body.appendChild(link)
    const range = document.createRange()
    range.selectNodeContents(link)

    expect(isAddressLikeSelection('Example.com', range)).toBe(true)
    expect(isAddressLikeSelection('Example.com')).toBe(false)
  })

  it('recognizes a lowercase domain label linked to an internal site filter', () => {
    const link = document.createElement('a')
    link.href = '/from?site=example.com'
    link.textContent = 'example.com'
    document.body.appendChild(link)
    const range = document.createRange()
    range.selectNodeContents(link)

    expect(isAddressLikeSelection('example.com', range)).toBe(true)
  })

  it('does not treat a natural-language link title or product name as an address', () => {
    const link = document.createElement('a')
    link.href = 'https://nodejs.org/en'
    link.textContent = 'Node.js documentation'
    document.body.appendChild(link)
    const range = document.createRange()
    range.selectNodeContents(link)

    expect(isAddressLikeSelection('Node.js documentation', range)).toBe(false)
  })

  it('suppresses a reliably detected selection that does not need translation', () => {
    mockShouldTranslateText.mockReturnValue(false)

    expect(shouldShowSelectionToolbar('这段内容已经是目标语言')).toBe(false)
    expect(mockShouldTranslateText).toHaveBeenCalledOnce()
  })

  it('keeps short or mixed-language selections when detection is uncertain', () => {
    mockShouldTranslateText.mockReturnValue(false)

    expect(shouldShowSelectionToolbar('Hello world')).toBe(true)
    expect(shouldShowSelectionToolbar('这是 OpenAI 的官网')).toBe(true)
    expect(mockShouldTranslateText).not.toHaveBeenCalled()
  })
})
