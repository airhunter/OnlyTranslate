import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'

const mockClaudeMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"single"}]}'))
const mockClaudeSubtitleBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"subtitle-batch"}]}'))
const mockConfig = vi.hoisted(() => ({
  service: 'claude',
  token: {
    claude: 'claude-token'
  } as Record<string, string>,
  proxy: {} as Record<string, string>,
  customProviders: [] as Array<{
    id: string
    protocol?: 'openai' | 'anthropic'
    url: string
    token: string
  }>,
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  },
  urls: {
    claude: 'https://api.anthropic.com/v1/messages'
  }
}))

vi.mock('@/entrypoints/utils/template', () => ({
  claudeMsgTemplate: mockClaudeMsgTemplate,
  claudeSubtitleBatchMsgTemplate: mockClaudeSubtitleBatchMsgTemplate
}))

vi.mock('@/entrypoints/utils/option', () => ({
  services: {
    claude: 'claude'
  }
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import claude from '@/entrypoints/service/claude'

const subtitleJob: SubtitleTranslationJob = {
  trackKey: 'youtube:video-1:en',
  sessionId: 'session-1',
  title: 'Test video',
  sourceLanguage: 'en',
  targetLanguage: 'zh-Hans',
  promptVersion: 'subtitle-context-v1',
  entries: [
    { id: 'segment-0', role: 'context', text: 'Sarah called yesterday.' },
    { id: 'segment-1', role: 'target', text: 'She said it was ready.' },
    { id: 'segment-2', role: 'target', text: 'So I picked it up.' }
  ]
}

describe('Claude service adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockConfig.service = 'claude'
    mockConfig.token = { claude: 'claude-token' }
    mockConfig.proxy = {}
    mockConfig.customProviders = []
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'plain translation' }]
      })
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the subtitle template and parses native Claude content for fast subtitle jobs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'thinking', text: 'internal reasoning' }, {
          type: 'text',
          text: '[{"id":"segment-1","translation":"\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002"},{"id":"segment-2","translation":"\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002"}]'
        }]
      })
    })

    await expect(claude({
      type: 'SUBTITLE_BATCH_TRANSLATION',
      job: subtitleJob,
      fastMode: true
    })).resolves.toEqual([
      { id: 'segment-1', translatedText: '\u5979\u8bf4\u5df2\u7ecf\u51c6\u5907\u597d\u4e86\u3002' },
      { id: 'segment-2', translatedText: '\u6240\u4ee5\u6211\u628a\u5b83\u53d6\u4e86\u56de\u6765\u3002' }
    ])

    expect(mockClaudeSubtitleBatchMsgTemplate).toHaveBeenCalledWith(subtitleJob)
    expect(mockClaudeMsgTemplate).not.toHaveBeenCalled()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe('{"messages":[{"role":"user","content":"subtitle-batch"}]}')
  })

  it('keeps ordinary single translation on the original Claude path', async () => {
    await expect(claude({
      origin: 'Hello',
      targetLang: 'zh-Hans'
    })).resolves.toBe('plain translation')

    expect(mockClaudeMsgTemplate).toHaveBeenCalledWith('Hello', 'zh-Hans')
    expect(mockClaudeSubtitleBatchMsgTemplate).not.toHaveBeenCalled()
  })

  it('uses a completed Anthropic endpoint and provider token for custom services', async () => {
    mockConfig.service = 'custom_anthropic'
    mockConfig.customProviders = [{
      id: 'custom_anthropic',
      protocol: 'anthropic',
      url: 'https://gateway.example/v1',
      token: 'custom-token',
    }]

    await claude({ origin: 'Hello', targetLang: 'zh-Hans' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(url).toBe('https://gateway.example/v1/messages')
    expect(headers.get('x-api-key')).toBe('custom-token')
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
    expect(headers.get('Authorization')).toBeNull()
  })

  it('continues to reject ordinary batch translation messages', async () => {
    await expect(claude({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    })).rejects.toThrow('Batch translation is not supported by this service')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockClaudeSubtitleBatchMsgTemplate).not.toHaveBeenCalled()
  })
})
