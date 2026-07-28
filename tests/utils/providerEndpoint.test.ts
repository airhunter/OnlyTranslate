import { describe, expect, it } from 'vitest'
import {
  getCustomProviderProtocol,
  resolveAnthropicCompatibleEndpoint,
  resolveCustomProviderEndpoint,
  resolveOpenAICompatibleEndpoint,
} from '@/entrypoints/utils/providerEndpoint'

describe('custom provider endpoint completion', () => {
  it.each([
    ['https://gateway.example', 'https://gateway.example/v1/chat/completions'],
    ['https://gateway.example/v1/', 'https://gateway.example/v1/chat/completions'],
    ['https://gateway.example/v1/chat/completions/', 'https://gateway.example/v1/chat/completions'],
    ['https://gateway.example/team/api', 'https://gateway.example/team/api/v1/chat/completions'],
    ['http://localhost:11434/api/generate', 'http://localhost:11434/api/generate'],
    ['https://gateway.example/v1?tenant=demo#section', 'https://gateway.example/v1/chat/completions?tenant=demo'],
  ])('completes OpenAI-compatible URL %s', (input, expected) => {
    expect(resolveOpenAICompatibleEndpoint(input)).toBe(expected)
  })

  it.each([
    ['https://gateway.example', 'https://gateway.example/v1/messages'],
    ['https://gateway.example/v1/', 'https://gateway.example/v1/messages'],
    ['https://gateway.example/v1/messages/', 'https://gateway.example/v1/messages'],
    ['https://gateway.example/team/api', 'https://gateway.example/team/api/v1/messages'],
  ])('completes Anthropic-compatible URL %s', (input, expected) => {
    expect(resolveAnthropicCompatibleEndpoint(input)).toBe(expected)
  })

  it('treats legacy providers without a protocol as OpenAI-compatible', () => {
    const provider = {
      url: 'https://legacy.example/v1',
    }

    expect(getCustomProviderProtocol({ protocol: undefined })).toBe('openai')
    expect(resolveCustomProviderEndpoint(provider)).toBe(
      'https://legacy.example/v1/chat/completions',
    )
  })
})
