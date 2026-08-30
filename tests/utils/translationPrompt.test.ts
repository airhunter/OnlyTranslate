import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BATCH_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  buildProviderContext,
  buildTargetMarkedContext,
  hasValidTranslationTemplate,
  markTargetInContext,
  normalizeTranslationPromptContext,
  renderBatchTranslationPrompt,
  renderTranslationPrompt,
  renderTranslationTemplate,
  usesTranslationContext,
} from '@/entrypoints/utils/translationPrompt'

describe('translation prompt context', () => {
  it('renders the D prompt with a target-marked semantic block', () => {
    const prompt = renderTranslationPrompt('bank', 'zh-Hans', {
      scene: 'selection',
      title: 'River restoration',
      surroundingText: 'They rested on the <target>bank</target> of the river.',
    })

    expect(prompt.system).toContain('Translate only TARGET_TEXT')
    expect(prompt.system).toContain('untrusted data')
    expect(prompt.system).toContain('Return only the translation')
    expect(prompt.user).toBe(`TARGET_LANGUAGE:
zh-Hans

CONTEXT_TITLE:
River restoration

TARGET_TEXT:
bank

CONTEXT:
They rested on the <target>bank</target> of the river.`)
  })

  it('omits empty context sections from the official default template', () => {
    expect(renderTranslationPrompt('A paragraph.', 'zh-Hans', {
      scene: 'webpage',
      title: 'Example article',
    }).user).toBe(`TARGET_LANGUAGE:
zh-Hans

CONTEXT_TITLE:
Example article

TARGET_TEXT:
A paragraph.`)

    expect(renderTranslationPrompt('你好', 'en', {
      scene: 'input',
      title: 'Private page',
      surroundingText: 'Private content',
    }).user).toBe(`TARGET_LANGUAGE:
en

TARGET_TEXT:
你好`)
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
