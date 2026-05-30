import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/entrypoints/utils/config', () => ({
  config: {
    translationScope: 'smart'
  }
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  cancelAllTranslations: vi.fn(),
  translateText: vi.fn()
}))

vi.mock('@/entrypoints/utils/icon', () => ({
  insertFailedTip: vi.fn(),
  insertLoadingSpinner: vi.fn(() => ({ remove: vi.fn() }))
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect'

interface TranslationTargetFixture {
  name: string
  url: string
  scope: 'smart' | 'full'
  html: string
  contentRoot?: string
  contentRootContains?: string[]
  contentRootExcludes?: string[]
  include?: string[]
  exclude?: string[]
  textIncludes?: string[]
  textExcludes?: string[]
  grabOptions?: {
    siteCompatMode?: 'smart' | 'full'
  }
  nodesEveryElement?: boolean
}

const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/translation-target')

function readFixtures(): TranslationTargetFixture[] {
  return fs.readdirSync(fixtureDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => {
      const fixturePath = path.join(fixtureDir, file)
      return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as TranslationTargetFixture
    })
}

describe('translation target fixtures', () => {
  const originalLocation = window.location

  beforeEach(() => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true
    })
  })

  for (const fixture of readFixtures()) {
    it(fixture.name, () => {
      Object.defineProperty(window, 'location', {
        value: new URL(fixture.url),
        configurable: true
      })
      document.body.innerHTML = fs.readFileSync(path.join(fixtureDir, fixture.html), 'utf8')

      const target = resolveAutoTranslationTarget(fixture.scope)
      const ids = target.nodes.map(node => node.id).filter(Boolean)
      const translatedText = target.nodes.map(node => node.textContent).join(' ')

      if (fixture.contentRoot) {
        expect(target.contentRoot).toBe(document.querySelector(fixture.contentRoot))
      }
      for (const selector of fixture.contentRootContains ?? []) {
        expect(target.contentRoot.contains(document.querySelector(selector))).toBe(true)
      }
      for (const selector of fixture.contentRootExcludes ?? []) {
        expect(target.contentRoot.contains(document.querySelector(selector))).toBe(false)
      }
      expect(ids).toEqual(expect.arrayContaining(fixture.include ?? []))
      for (const id of fixture.exclude ?? []) {
        expect(ids).not.toContain(id)
      }
      for (const text of fixture.textIncludes ?? []) {
        expect(translatedText).toContain(text)
      }
      for (const text of fixture.textExcludes ?? []) {
        expect(translatedText).not.toContain(text)
      }
      if (fixture.grabOptions?.siteCompatMode) {
        expect(target.grabOptions?.siteCompatMode).toBe(fixture.grabOptions.siteCompatMode)
      }
      if (fixture.nodesEveryElement) {
        expect(target.nodes.every(node => node instanceof Element)).toBe(true)
      }
    })
  }
})
