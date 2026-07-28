import { describe, expect, it, vi } from 'vitest'
import { customModelString, services } from '@/entrypoints/utils/option'
import {
  appendCustomModelOption,
  buildModelsEndpoint,
  canFetchProviderModels,
  fetchProviderModels,
  getStaticModelOptions
} from '@/entrypoints/utils/modelCatalog'

describe('modelCatalog', () => {
  it('builds model list endpoint from OpenAI-compatible chat URL', () => {
    expect(buildModelsEndpoint('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1/models')
    expect(buildModelsEndpoint('https://openrouter.ai/api/v1/chat/completions')).toBe('https://openrouter.ai/api/v1/models')
    expect(buildModelsEndpoint('https://example.com/v1')).toBe('https://example.com/v1/models')
    expect(buildModelsEndpoint('http://localhost:11434/api/generate')).toBe('http://localhost:11434/api/tags')
    expect(buildModelsEndpoint('https://example.com/v1/messages?tenant=demo')).toBe('https://example.com/v1/models?tenant=demo')
  })

  it('keeps custom model option as fallback', () => {
    expect(appendCustomModelOption(['gpt-4o-mini', 'gpt-4o-mini'])).toEqual(['gpt-4o-mini', customModelString])
    expect(getStaticModelOptions(services.openai)).toContain(customModelString)
    expect(getStaticModelOptions(services.deepseek)).toEqual([customModelString])
  })

  it('fetches the current DeepSeek model catalog instead of relying on static model names', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'deepseek-v4-flash' },
          { id: 'deepseek-v4-pro' }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderModels(services.deepseek, { token: 'test-key' })).resolves.toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      customModelString
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/models',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer test-key' }
      })
    )

    vi.unstubAllGlobals()
  })

  it('fetches and normalizes Gemini model names', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderModels(services.gemini, { token: 'test-key' })).resolves.toEqual([
      'gemini-2.5-flash',
      customModelString
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models?key=test-key',
      expect.objectContaining({ method: 'GET' })
    )

    vi.unstubAllGlobals()
  })

  it('fetches models from a custom OpenAI-compatible provider without requiring a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'local-model' }]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderModels('custom_openai', {
      protocol: 'openai',
      url: 'http://localhost:8080/v1'
    })).resolves.toEqual(['local-model', customModelString])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: {}
      })
    )

    vi.unstubAllGlobals()
  })

  it('uses native Anthropic headers for a custom Anthropic-compatible provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'claude-custom' }]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchProviderModels('custom_anthropic', {
      protocol: 'anthropic',
      url: 'https://gateway.example',
      token: 'anthropic-token'
    })).resolves.toEqual(['claude-custom', customModelString])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'x-api-key': 'anthropic-token',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      })
    )

    vi.unstubAllGlobals()
  })

  it('reports supported provider model catalogs', () => {
    expect(canFetchProviderModels(services.openai)).toBe(true)
    expect(canFetchProviderModels('custom_gateway')).toBe(true)
    expect(canFetchProviderModels(services.deepL)).toBe(false)
  })
})
