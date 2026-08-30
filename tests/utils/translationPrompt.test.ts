import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BATCH_SYSTEM_PROMPT,
  DEFAULT_SELECTION_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  buildProviderContext,
  buildTargetMarkedContext,
  hasValidTranslationTemplate,
  isLikelySelectionOvertranslation,
  markTargetInContext,
  normalizeTranslationPromptContext,
  renderBatchTranslationPrompt,
  renderTranslationPrompt,
  renderTranslationTemplate,
  usesTranslationContext,
} from '@/entrypoints/utils/translationPrompt'

describe('translation prompt context', () => {
  it('uses the enhanced official prompt only for a target-marked selection', () => {
    const prompt = renderTranslationPrompt('bank', 'zh-Hans', {
      scene: 'selection',
      title: 'River restoration',
      surroundingText: 'They rested on the <target>bank</target> of the river.',
    })

    expect(prompt.system).toBe(DEFAULT_SELECTION_SYSTEM_PROMPT)
    expect(prompt.system).toContain('untrusted data')
    expect(prompt.system).toContain('Return only the translation')
    expect(prompt.user).toBe(`Target language:
zh-Hans

Page title:
River restoration

Selected text to translate:
bank

Surrounding text (the selection is marked with <target> tags):
They rested on the <target>bank</target> of the river.`)
  })

  it('uses the minimal 1.8.2-style webpage prompt with title-only context', () => {
    const webpagePrompt = renderTranslationPrompt('A paragraph.', 'zh-Hans', {
      scene: 'webpage',
      title: 'Example article',
      surroundingText: 'A neighboring paragraph that must not be included.',
    })

    expect(webpagePrompt.system).toBe(`You are a professional, authentic machine translation engine.
Translate only the source text. The page title is context only and must never appear in the output.`)
    expect(webpagePrompt.user).toBe(`Page title for context only:
Example article

Translate the following source text into zh-Hans. If translation is unnecessary, return the original text. Return only the translation:

A paragraph.`)
    expect(webpagePrompt.user).not.toContain('A neighboring paragraph')

    const inputPrompt = renderTranslationPrompt('你好', 'en', {
      scene: 'input',
      title: 'Private page',
      surroundingText: 'Private content',
    })
    expect(inputPrompt.user).toBe(`Translate the following source text into en. If translation is unnecessary, return the original text. Return only the translation:

你好`)
    expect(inputPrompt.user).not.toContain('Private page')
    expect(inputPrompt.user).not.toContain('Private content')
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
      scene: 'ebook',
      title: 'Example Book',
      surroundingText: 'C'.repeat(400),
    })).toEqual({
      scene: 'ebook',
      title: 'Example Book',
      surroundingText: 'C'.repeat(320),
    })
  })

  it('marks the target in its semantic block and preserves the nearest context under the limit', () => {
    expect(markTargetInContext('They sat on the bank of the river.', 'bank'))
      .toBe('They sat on the <target>bank</target> of the river.')
    expect(markTargetInContext('bank', 'bank')).toBe('')
    expect(markTargetInContext('They crossed the river.', 'bank')).toBe('')

    const context = buildTargetMarkedContext('A'.repeat(1200), 'trade', 'B'.repeat(1200), 1600)
    expect(context.length).toBeLessThanOrEqual(1600)
    expect(context).toContain('<target>trade</target>')
    expect(context.startsWith('A')).toBe(true)
    expect(context.endsWith('B')).toBe(true)
  })

  it('detects a surrounding paragraph returned for a short selection without rejecting normal expansion', () => {
    expect(isLikelySelectionOvertranslation(
      'the score of the next best model',
      '推理分数持续攀升，而每个 token 的计算量却在不断下降。'.repeat(8),
    )).toBe(true)
    expect(isLikelySelectionOvertranslation(
      'the score of the next best model',
      '次优模型的得分',
    )).toBe(false)
    expect(isLikelySelectionOvertranslation(
      'A complete paragraph with enough source material to translate naturally and faithfully.',
      '一段具有足够原文信息、可以自然且忠实翻译的完整段落。',
    )).toBe(false)
  })

  it('requires target language and source text in custom templates', () => {
    expect(hasValidTranslationTemplate(DEFAULT_USER_PROMPT)).toBe(true)
    expect(hasValidTranslationTemplate('Translate {{origin}} to {{to}}')).toBe(true)
    expect(hasValidTranslationTemplate('Translate {{origin}}')).toBe(false)
    expect(usesTranslationContext(DEFAULT_USER_PROMPT)).toBe(true)
    expect(usesTranslationContext('Translate {{origin}} to {{to}}')).toBe(false)
  })

  it('formats provider context without duplicating source text', () => {
    expect(buildProviderContext({
      scene: 'ebook',
      title: 'Example Book',
      surroundingText: 'Chapter 2',
    })).toBe('Title: Example Book\nContext: Chapter 2')
    expect(DEFAULT_SYSTEM_PROMPT).not.toContain('{{origin}}')
  })

  it('renders validated JSON transport for internal batch translation', () => {
    const prompt = renderBatchTranslationPrompt(['Hello', 'World'], 'zh-Hans', {
      scene: 'webpage',
      title: 'Example article',
    })
    const request = JSON.parse(prompt.user.slice(prompt.user.indexOf('{')))

    expect(prompt.system).toBe(DEFAULT_BATCH_SYSTEM_PROMPT)
    expect(prompt.system).toContain('same length and order')
    expect(prompt.user).toContain('__ONLY_TRANSLATE_INLINE_0_abc__')
    expect(request).toEqual({
      targetLanguage: 'zh-Hans',
      contextTitle: 'Example article',
      targetTexts: ['Hello', 'World'],
    })
  })
})
