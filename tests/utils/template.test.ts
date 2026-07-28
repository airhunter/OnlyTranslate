import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  service: 'openai',
  model: {
    openai: 'gpt-5-mini',
    deepseek: 'deepseek-v4-pro',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-sonnet-4-0'
  } as Record<string, string>,
  customModel: {} as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    model: string
    customModel: string
  }>,
  system_role: {} as Record<string, string>,
  user_role: {} as Record<string, string>,
  thinking: {} as Record<string, boolean>
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

import {
    commonBatchMsgTemplate,
    commonMsgTemplate,
    commonSubtitleBatchMsgTemplate,
    claudeMsgTemplate,
    claudeSubtitleBatchMsgTemplate,
    deepseekMsgTemplate,
    geminiMsgTemplate,
    geminiSubtitleBatchMsgTemplate,
} from '@/entrypoints/utils/template'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const subtitleJob: SubtitleTranslationJob = {
  trackKey: 'youtube|video|en|||',
  sessionId: '1',
  title: 'Example video',
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
  promptVersion: 'subtitle-context-v1',
  entries: [
    { id: 'context', role: 'context', text: 'Sarah tested it.' },
    { id: 'target', role: 'target', text: 'She said it worked.' },
  ],
}

describe('translation templates', () => {
  beforeEach(() => {
    mockConfig.service = 'openai'
    mockConfig.model.openai = 'gpt-5-mini'
    mockConfig.model.deepseek = 'deepseek-v4-pro'
    mockConfig.model.gemini = 'gemini-2.5-flash'
    mockConfig.customProviders = []
    mockConfig.thinking = {}
  })

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

  it('uses the lowest supported reasoning effort for fast OpenAI reasoning-model requests', () => {
    const payload = JSON.parse(commonMsgTemplate('Hello', 'zh-Hans', true))

    expect(payload.reasoning_effort).toBe('minimal')
    expect(payload.temperature).toBeUndefined()
  })

  it('uses the lowest supported reasoning effort when thinking is disabled', () => {
    const payload = JSON.parse(commonMsgTemplate('Hello', 'zh-Hans'))

    expect(payload.reasoning_effort).toBe('minimal')
    expect(payload.temperature).toBeUndefined()
  })

  it('disables DeepSeek thinking for subtitle requests without changing the selected model', () => {
    mockConfig.service = 'deepseek'

    const single = JSON.parse(deepseekMsgTemplate('Hello', 'zh-Hans', true))
    const batch = JSON.parse(commonBatchMsgTemplate(['Hello', 'World'], 'zh-Hans', true))

    expect(single).toMatchObject({
      model: 'deepseek-v4-pro',
      thinking: { type: 'disabled' },
    })
    expect(batch).toMatchObject({
      model: 'deepseek-v4-pro',
      thinking: { type: 'disabled' },
    })
  })

  it('uses DeepSeek thinking controls for normal batch requests', () => {
    mockConfig.service = 'deepseek'
    mockConfig.thinking.deepseek = true

    const payload = JSON.parse(commonBatchMsgTemplate(['Hello'], 'zh-Hans'))

    expect(payload).toMatchObject({
      model: 'deepseek-v4-pro',
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
    })
    expect(payload.temperature).toBeUndefined()
  })

  it('disables Gemini 2.5 Flash thinking for fast subtitle requests', () => {
    mockConfig.service = 'gemini'

    const payload = JSON.parse(geminiMsgTemplate('Hello', 'zh-Hans', true))

    expect(payload.generationConfig).toEqual({
      thinkingConfig: { thinkingBudget: 0 },
    })
  })

  it('builds a minimal-reasoning structured OpenAI subtitle request', () => {
    const payload = JSON.parse(commonSubtitleBatchMsgTemplate(subtitleJob, true))
    const user = JSON.parse(payload.messages[1].content)

    expect(payload.reasoning_effort).toBe('minimal')
    expect(payload.temperature).toBeUndefined()
    expect(payload.messages[0].content).toContain('Context entries are read-only')
    expect(user).toMatchObject({
      videoTitle: 'Example video',
      sourceLanguage: 'en',
      targetLanguage: 'zh-Hans',
      entries: subtitleJob.entries,
    })
  })

  it('uses native structured subtitle payloads for Gemini and Claude', () => {
    mockConfig.service = 'gemini'
    const gemini = JSON.parse(geminiSubtitleBatchMsgTemplate(subtitleJob, true))
    expect(gemini.generationConfig).toEqual({
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    })
    expect(gemini.systemInstruction.parts[0].text).toContain('untrusted data')

    mockConfig.service = 'claude'
    const claude = JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob))
    expect(claude).toMatchObject({
      model: 'claude-sonnet-4-0',
      temperature: 0.2,
    })
    expect(claude.thinking).toBeUndefined()
    expect(claude.system).toContain('untrusted data')
  })

  it('applies Claude thinking only when subtitle speed priority is disabled', () => {
    mockConfig.service = 'claude'
    mockConfig.thinking.claude = true

    const fast = JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, true))
    expect(fast.thinking).toBeUndefined()
    expect(fast.temperature).toBe(0.2)

    const quality = JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob, false))
    expect(quality.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 })
    expect(quality.temperature).toBeUndefined()
  })

  it('uses the selected custom model in Anthropic-compatible payloads', () => {
    mockConfig.service = 'custom_anthropic'
    mockConfig.customProviders = [{
      id: 'custom_anthropic',
      model: '自定义模型',
      customModel: 'claude-custom-model',
    }]

    const single = JSON.parse(claudeMsgTemplate('Hello', 'zh-Hans'))
    const subtitle = JSON.parse(claudeSubtitleBatchMsgTemplate(subtitleJob))

    expect(single.model).toBe('claude-custom-model')
    expect(subtitle.model).toBe('claude-custom-model')
  })
})
