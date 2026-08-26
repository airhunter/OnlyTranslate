import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TRANSLATION_ONLY_BACKUP_CLASS,
  hasTranslationOnlyRecord,
  hideOriginalForTranslationOnly,
  prepareTranslationOnly,
  restoreAllTranslationOnly,
  restoreTranslationOnly,
} from '@/entrypoints/main/translationOnly'

describe('translation-only DOM backup', () => {
  beforeEach(() => {
    restoreAllTranslationOnly()
    document.body.innerHTML = ''
  })

  it('hides original nodes in a template and restores their identity', () => {
    document.body.innerHTML = '<p id="target">Read <a href="/docs">the docs</a>.</p>'
    const target = document.querySelector('#target') as HTMLElement
    const link = target.querySelector('a')!
    const listener = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', listener)

    const originalNodes = Array.from(target.childNodes)
    const prepared = prepareTranslationOnly(target, target)
    const insertion = document.createElement('span')
    insertion.textContent = '阅读文档。'
    target.appendChild(insertion)

    expect(prepared.originalNodes).toEqual(originalNodes)
    expect(hideOriginalForTranslationOnly(prepared, insertion)).toBe(true)
    expect(hasTranslationOnlyRecord(target)).toBe(true)
    expect(target.textContent).toBe('阅读文档。')
    expect(target.querySelector('a')).toBeNull()
    expect(insertion.querySelector<HTMLTemplateElement>(`template.${TRANSLATION_ONLY_BACKUP_CLASS}`)?.content.querySelector('a')).toBe(link)

    expect(restoreTranslationOnly(target)).toBe('restored')
    expect(target.innerHTML).toBe('Read <a href="/docs">the docs</a>.')
    expect(target.querySelector('a')).toBe(link)

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite host content when the original anchor was replaced', () => {
    document.body.innerHTML = '<p id="target">Original content</p>'
    const target = document.querySelector('#target') as HTMLElement
    const prepared = prepareTranslationOnly(target, target)
    const insertion = document.createElement('span')
    insertion.textContent = '译文'
    target.appendChild(insertion)

    expect(hideOriginalForTranslationOnly(prepared, insertion)).toBe(true)
    target.innerHTML = '<strong>Updated by host</strong>'

    expect(restoreTranslationOnly(target)).toBe('discarded')
    expect(target.innerHTML).toBe('<strong>Updated by host</strong>')
  })
})
