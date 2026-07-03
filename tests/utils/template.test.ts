import { describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'openai',
  model: {
    openai: 'gpt-5-mini'
  } as Record<string, string>,
  customModel: {} as Record<string, string>,
  customProviders: []
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

import { commonBatchMsgTemplate } from '@/entrypoints/utils/template'

describe('translation templates', () => {
  it('tells batch translation to preserve protected inline placeholders', () => {
    const payload = JSON.parse(commonBatchMsgTemplate([
      'Open __ONLY_TRANSLATE_INLINE_0_abc__ before continuing.'
    ], 'zh-Hans')) as {
      messages: Array<{ role: string; content: string }>
    }

    const userContent = payload.messages.find(message => message.role === 'user')?.content ?? ''

    expect(userContent).toContain('__ONLY_TRANSLATE_INLINE_')
    expect(userContent).toContain('preserve')
    expect(userContent).toContain('exactly once')
  })
})
