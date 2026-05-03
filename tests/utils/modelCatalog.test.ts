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
  })

  it('keeps custom model option as fallback', () => {
    expect(appendCustomModelOption(['gpt-4o-mini', 'gpt-4o-mini'])).toEqual(['gpt-4o-mini', customModelString])
    expect(getStaticModelOptions(services.openai)).toContain(customModelString)
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

  it('reports supported provider model catalogs', () => {
    expect(canFetchProviderModels(services.openai)).toBe(true)
    expect(canFetchProviderModels(services.deepL)).toBe(false)
  })
})
