import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'openai',
  to: 'zh-Hans',
  model: {
    openai: 'gpt-5-mini',
    deepseek: 'deepseek-chat',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-sonnet-4-0',
    minimax: 'MiniMax-M3'
  } as Record<string, string>,
  customModel: {} as Record<string, string>,
  customProviders: [],
  system_role: {} as Record<string, string>,
  user_role: {} as Record<string, string>,
  thinking: {} as Record<string, boolean>
}))

vi.mock('@/entrypoints/utils/config', () => ({ config: mockConfig }))
vi.mock('@/entrypoints/utils/option', () => ({
  customModelString: 'custom',
  services: { claude: 'claude' },
  defaultOption: {
    system_role: 'Translate faithfully.',
    user_role: 'Translate {{origin}} into {{to}}.'
  }
}))

import {
  claudeMsgTemplate,
  commonBatchMsgTemplate,
  commonMsgTemplate,
  deepseekMsgTemplate,
  geminiMsgTemplate,
  minimaxTemplate
} from '@/entrypoints/utils/template'

describe('per-service thinking request configuration', () => {
  beforeEach(() => {
    mockConfig.service = 'openai'
    mockConfig.thinking = {}
  })

  it('explicitly disables reasoning for OpenAI-compatible single and batch requests by default', () => {
    expect(JSON.parse(commonMsgTemplate('Hello'))).toMatchObject({ reasoning_effort: 'none' })
    expect(JSON.parse(commonBatchMsgTemplate(['Hello']))).toMatchObject({ reasoning_effort: 'none' })
  })

  it('enables medium reasoning only for the selected OpenAI-compatible service', () => {
    mockConfig.thinking.openai = true

    expect(JSON.parse(commonMsgTemplate('Hello'))).toMatchObject({ reasoning_effort: 'medium' })
  })

  it('uses DeepSeek native thinking controls', () => {
    mockConfig.service = 'deepseek'
    expect(JSON.parse(deepseekMsgTemplate('Hello'))).toMatchObject({ thinking: { type: 'disabled' } })

    mockConfig.thinking.deepseek = true
    expect(JSON.parse(deepseekMsgTemplate('Hello'))).toMatchObject({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    })
  })

  it('uses explicit Gemini, Claude, and MiniMax thinking controls', () => {
    mockConfig.service = 'gemini'
    expect(JSON.parse(geminiMsgTemplate('Hello'))).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
    })

    mockConfig.thinking.gemini = true
    expect(JSON.parse(geminiMsgTemplate('Hello'))).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingBudget: 1024 } }
    })

    mockConfig.service = 'claude'
    expect(JSON.parse(claudeMsgTemplate('Hello'))).toMatchObject({ thinking: { type: 'disabled' } })
    mockConfig.thinking.claude = true
    expect(JSON.parse(claudeMsgTemplate('Hello'))).toMatchObject({
      thinking: { type: 'enabled', budget_tokens: 1024 }
    })

    mockConfig.service = 'minimax'
    expect(JSON.parse(minimaxTemplate('Hello'))).toMatchObject({ thinking: { type: 'disabled' } })
    mockConfig.thinking.minimax = true
    expect(JSON.parse(minimaxTemplate('Hello'))).toMatchObject({ thinking: { type: 'adaptive' } })
  })
})
