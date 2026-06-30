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

  it('keeps background work to one reserved slot', async () => {
    mockConfig.maxConcurrentTranslations = 3
    const events: string[] = []
    let finishFirst!: () => void

    const first = enqueueTranslation(() => new Promise<string>(resolve => {
      events.push('background-1-start')
      finishFirst = () => resolve('background-1')
    }), { priority: 'background' })
    const second = enqueueTranslation(async () => {
      events.push('background-2-start')
      return 'background-2'
    }, { priority: 'background' })

    await Promise.resolve()

    expect(events).toEqual(['background-1-start'])
    expect(getQueueStatus()).toMatchObject({
      activeTranslations: 1,
      activeBackgroundTranslations: 1,
      pendingTranslations: 1,
      pendingBackgroundTranslations: 1
    })

    finishFirst()
    await expect(first).resolves.toBe('background-1')
    await expect(second).resolves.toBe('background-2')
    expect(events).toEqual(['background-1-start', 'background-2-start'])
  })
})
