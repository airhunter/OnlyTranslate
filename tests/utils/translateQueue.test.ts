import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  maxConcurrentTranslations: 1
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

import {
  clearTranslationQueue,
  enqueueTranslation,
  getQueueStatus
} from '@/entrypoints/utils/translateQueue'

describe('translateQueue priority scheduling', () => {
  beforeEach(() => {
    clearTranslationQueue()
    mockConfig.maxConcurrentTranslations = 1
  })

  it('starts foreground work before queued background work when a slot opens', async () => {
    const events: string[] = []
    let finishActive!: () => void
    let finishForeground!: () => void

    const active = enqueueTranslation(() => new Promise<string>(resolve => {
      events.push('active-start')
      finishActive = () => resolve('active')
    }))
    const background = enqueueTranslation(async () => {
      events.push('background-start')
      return 'background'
    }, { priority: 'background' })
    const foreground = enqueueTranslation(() => new Promise<string>(resolve => {
      events.push('foreground-start')
      finishForeground = () => resolve('foreground')
    }), { priority: 'high' })

    expect(events).toEqual(['active-start'])

    finishActive()
    await expect(active).resolves.toBe('active')
    await Promise.resolve()

    expect(events).toEqual(['active-start', 'foreground-start'])

    finishForeground()
    await expect(foreground).resolves.toBe('foreground')
    await expect(background).resolves.toBe('background')
    expect(events).toEqual(['active-start', 'foreground-start', 'background-start'])
  })

  it('uses remaining slots for background work while reserving foreground capacity', async () => {
    mockConfig.maxConcurrentTranslations = 6
    const events: string[] = []
    const finishBackground: Array<() => void> = []
    let finishForeground!: () => void

    const backgrounds = Array.from({ length: 5 }, (_, index) => enqueueTranslation(() => new Promise<string>(resolve => {
      events.push(`background-${index + 1}-start`)
      finishBackground[index] = () => resolve(`background-${index + 1}`)
    }), { priority: 'background' }))

    await Promise.resolve()

    expect(events).toEqual([
      'background-1-start',
      'background-2-start',
      'background-3-start',
      'background-4-start'
    ])
    expect(getQueueStatus()).toMatchObject({
      activeTranslations: 4,
      activeBackgroundTranslations: 4,
      pendingTranslations: 1,
      pendingBackgroundTranslations: 1
    })

    const foreground = enqueueTranslation(() => new Promise<string>(resolve => {
      events.push('foreground-start')
      finishForeground = () => resolve('foreground')
    }), { priority: 'high' })

    await Promise.resolve()

    expect(events).toEqual([
      'background-1-start',
      'background-2-start',
      'background-3-start',
      'background-4-start',
      'foreground-start'
    ])
    expect(getQueueStatus()).toMatchObject({
      activeTranslations: 5,
      activeBackgroundTranslations: 4,
      pendingTranslations: 1,
      pendingBackgroundTranslations: 1
    })

    finishForeground()
    await expect(foreground).resolves.toBe('foreground')

    finishBackground[0]()
    await expect(backgrounds[0]).resolves.toBe('background-1')
    await Promise.resolve()

    expect(events).toEqual([
      'background-1-start',
      'background-2-start',
      'background-3-start',
      'background-4-start',
      'foreground-start',
      'background-5-start'
    ])
  })
})
