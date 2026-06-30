import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCommonBatchMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"batch"}]}'))
const mockCommonMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"single"}]}'))
const mockDeepseekMsgTemplate = vi.hoisted(() => vi.fn(() => '{"messages":[{"role":"user","content":"deepseek-single"}]}'))
const mockContentPostHandler = vi.hoisted(() => vi.fn((content: string) => `clean:${content}`))
const mockConfig = vi.hoisted(() => ({
  service: 'deepseek',
  token: {
    deepseek: 'deepseek-token',
    newapi: 'newapi-token'
  } as Record<string, string>,
  proxy: {} as Record<string, string>,
  newApiUrl: 'https://newapi.example.com'
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/constant', () => ({
  method: {
    POST: 'POST'
  },
  urls: {
    deepseek: 'https://api.deepseek.com/chat/completions'
  }
}))

vi.mock('@/entrypoints/utils/template', () => ({
  commonBatchMsgTemplate: mockCommonBatchMsgTemplate,
  commonMsgTemplate: mockCommonMsgTemplate,
  deepseekMsgTemplate: mockDeepseekMsgTemplate
}))

vi.mock('@/entrypoints/utils/check', () => ({
  contentPostHandler: mockContentPostHandler
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

import deepseek from '@/entrypoints/service/deepseek'
import newapi from '@/entrypoints/service/newapi'

describe('OpenAI-compatible batch service adapters', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    mockConfig.service = 'deepseek'
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '["你好","世界"]'
            }
          }
        ]
      })
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the common batch template for DeepSeek batch messages', async () => {
    await expect(deepseek({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    } as any)).resolves.toEqual(['你好', '世界'])

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans')
    expect(mockDeepseekMsgTemplate).not.toHaveBeenCalled()
  })

  it('uses the common batch template for NewAPI batch messages', async () => {
    mockConfig.service = 'newapi'

    await expect(newapi({
      type: 'BATCH_TRANSLATION',
      origins: ['Hello', 'World'],
      targetLang: 'zh-Hans'
    } as any)).resolves.toEqual(['你好', '世界'])

    expect(mockCommonBatchMsgTemplate).toHaveBeenCalledWith(['Hello', 'World'], 'zh-Hans')
    expect(mockCommonMsgTemplate).not.toHaveBeenCalled()
  })
})
