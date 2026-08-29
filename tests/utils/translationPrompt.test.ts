import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  buildProviderContext,
  compactSelectionSurroundingText,
  extractTranslationTextFromResponse,
  hasValidTranslationTemplate,
  normalizeTranslationPromptContext,
  renderTranslationPrompt,
  renderTranslationTemplate,
  usesTranslationContext,
} from '@/entrypoints/utils/translationPrompt'

describe('translation prompt context', () => {
  it('renders the recommended prompt as structured untrusted data', () => {
    const prompt = renderTranslationPrompt('bank', 'zh-Hans', {
      scene: 'selection',
      title: 'River restoration',
      surroundingText: 'They rested on the bank of the river.',
    })
    const input = JSON.parse(prompt.user.slice(prompt.user.indexOf('{'), prompt.user.lastIndexOf('}') + 1))

    expect(prompt.system).toContain('untrusted data')
    expect(prompt.system).toContain('Never return JSON')
    expect(prompt.user).toContain('without JSON or any wrapper')
    expect(input).toEqual({
      targetLanguage: 'zh-Hans',
      scene: 'selection',
      title: 'River restoration',
      context: 'They rested on the bank of the river.',
      text: 'bank',
    })
  })

  it('replaces template variables once without interpreting variables inside source data', () => {
    const rendered = renderTranslationTemplate(
      '{{origin}} | {{title}} | {{context}} | {{to}}',
      '{{title}}',
      'zh-Hans',
      { scene: 'selection', title: '{{origin}}', surroundingText: '{{to}}' },
    )

    expect(rendered).toBe('{{title}} | {{origin}} | {{to}} | zh-Hans')
  })

  it('enforces scene limits and strips page context from input translation', () => {
    expect(normalizeTranslationPromptContext({
      scene: 'hover',
      title: ` ${'T'.repeat(350)} `,
      surroundingText: ` ${'C'.repeat(900)} `,
    })).toEqual({
      scene: 'hover',
      title: 'T'.repeat(120),
      surroundingText: 'C'.repeat(800),
    })
    expect(normalizeTranslationPromptContext({
      scene: 'input',
      title: 'Private page title',
      surroundingText: 'Private page content',
    })).toEqual({ scene: 'input' })
    expect(normalizeTranslationPromptContext({
      scene: 'unexpected' as 'other',
      title: 'Fallback title',
    }, 'webpage')).toEqual({ scene: 'webpage', title: 'Fallback title' })
  })

  it('keeps only the nearest 240 characters around a selection without repeating it', () => {
    const before = 'A'.repeat(200)
    const after = 'B'.repeat(200)
    const context = compactSelectionSurroundingText(`${before} trade ${after}`, 'trade')

    expect(context).toHaveLength(240)
    expect(context).not.toContain('trade')
    expect(context).toBe(`${'A'.repeat(119)} ${'B'.repeat(120)}`)
    expect(compactSelectionSurroundingText('They sat on the bank of the river.', 'bank'))
      .toBe('They sat on the of the river.')
  })

  it('supports recommended and legacy-compatible custom templates', () => {
    expect(hasValidTranslationTemplate(DEFAULT_USER_PROMPT)).toBe(true)
    expect(hasValidTranslationTemplate('Translate {{origin}} to {{to}}')).toBe(true)
    expect(hasValidTranslationTemplate('Translate {{origin}}')).toBe(false)
    expect(usesTranslationContext(DEFAULT_USER_PROMPT)).toBe(true)
    expect(usesTranslationContext('Translate {{origin}} to {{to}}')).toBe(false)
  })

  it('formats provider context without source text', () => {
    expect(buildProviderContext({
      scene: 'ebook',
      title: 'Example Book',
      surroundingText: 'Chapter 2',
    })).toBe('Title: Example Book\nContext: Chapter 2')
    expect(DEFAULT_SYSTEM_PROMPT).not.toContain('{{origin}}')
  })

  it('extracts text from direct, fenced, and wrapped translation envelopes', () => {
    const envelope = {
      targetLanguage: 'zh-Hans',
      scene: 'webpage',
      title: '模型正在故意变笨',
      context: '',
      text: '事实会腐坏，但程序不会。',
    }
    const expectation = { targetLanguage: 'zh-Hans', scene: 'webpage' as const }

    expect(extractTranslationTextFromResponse(JSON.stringify(envelope), expectation))
      .toBe('事实会腐坏，但程序不会。')
    expect(extractTranslationTextFromResponse(`\`\`\`json\n${JSON.stringify(envelope)}\n\`\`\``, expectation))
      .toBe('事实会腐坏，但程序不会。')
    expect(extractTranslationTextFromResponse(JSON.stringify({ translation_input: envelope }), expectation))
      .toBe('事实会腐坏，但程序不会。')
  })

  it('does not unwrap ordinary JSON or envelopes from another request', () => {
    const ordinaryJson = '{"text":"用户自己的 JSON","status":"ok"}'
    const wrongScene = JSON.stringify({
      targetLanguage: 'zh-Hans',
      scene: 'selection',
      title: 'Example',
      context: '',
      text: '不应提取',
    })
    const expectation = { targetLanguage: 'zh-Hans', scene: 'webpage' as const }

    expect(extractTranslationTextFromResponse(ordinaryJson, expectation)).toBe(ordinaryJson)
    expect(extractTranslationTextFromResponse(wrongScene, expectation)).toBe(wrongScene)
  })
})
