import { describe, expect, it } from 'vitest'
import { reconstructInlineMath } from '@/entrypoints/pdf/inlineMath'
import type { PdfTextSpan } from '@/entrypoints/pdf/layout'

function span(
  text: string,
  x: number,
  baseline: number,
  width: number,
  height: number,
  fontName: string,
): PdfTextSpan {
  return { text, x, y: baseline - height, width, height, baseline, fontName }
}

describe('PDF inline math reconstruction', () => {
  it('rebuilds real PDF baseline shifts as KaTeX subscripts and superscripts', () => {
    const firstLine = [
      span('(cur) sentences.', 72, 100, 69, 10.9, 'body'),
      span('e', 146, 100, 5, 10.9, 'math'),
      span('i', 151, 101.64, 3, 7.97, 'script'),
      span('indicates a target token.', 159, 100, 110, 10.9, 'body'),
    ]
    const secondLine = [
      span('and', 173, 120, 18, 10.9, 'body'),
      span('e', 197, 120, 5, 10.9, 'math'),
      span('i', 202, 115.41, 3, 7.97, 'script'),
      span('−', 205, 115.41, 6.5, 7.97, 'symbol'),
      span('1', 211.5, 115.41, 4.2, 7.97, 'script-number'),
      span('are already predicted.', 220, 120, 90, 10.9, 'body'),
    ]
    const subscriptLine = [span('1', 202, 123.12, 4.2, 7.97, 'script-number')]

    const result = reconstructInlineMath([
      { text: '(cur) sentences. ei indicates a target token.', spans: firstLine },
      { text: 'and ei−1 are already predicted.', spans: secondLine },
      { text: '1', spans: subscriptLine },
    ], 'page-2:block-1')

    expect(result?.expressions.map(expression => expression.latex)).toEqual([
      'e_{i}',
      'e_{1}^{i-1}',
    ])
    expect(result?.source).toContain('{{pdfmath:page-2:block-1:0}}')
    expect(result?.source).toContain('{{pdfmath:page-2:block-1:1}}')
    expect(result?.source).not.toMatch(/\s1\s/u)
  })

  it('keeps isolated mathematical variables in the paragraph flow', () => {
    const result = reconstructInlineMath([{
      text: 'We denote a source by f and its representation by H.',
      spans: [
        span('We denote a source by', 10, 30, 95, 11, 'body'),
        span('f', 108, 30, 4, 11, 'math-italic'),
        span('and its representation by', 116, 30, 105, 11, 'body'),
        span('H', 224, 30, 8, 11, 'math-bold'),
        span('.', 232, 30, 3, 11, 'body'),
      ],
    }], 'page-2:block-1')

    expect(result?.expressions.map(expression => expression.latex)).toEqual(['f', 'H'])
  })

  it('reconstructs a compound inline formula as one math island', () => {
    const mainLine = [
      span('where', 307.28, 456.54, 26.65, 10.91, 'body'),
      span('g', 337.28, 456.54, 5.2, 10.91, 'math'),
      span('=', 347.07, 456.54, 8.49, 10.91, 'operator'),
      span('σ', 359.75, 456.54, 6.23, 10.91, 'math'),
      span('W', 373.19, 456.54, 10.3, 10.91, 'math'),
      span('g', 383.5, 458.17, 4.03, 7.97, 'script'),
      span('H', 394.67, 456.54, 9.07, 10.91, 'math'),
      span(';', 404.63, 456.54, 3.03, 10.91, 'operator'),
      span('H', 409.48, 456.54, 9.07, 10.91, 'math'),
      span('cur', 418.55, 458.17, 10.18, 7.97, 'body'),
      span('+', 436.19, 456.54, 8.49, 10.91, 'operator'),
      span('b', 447.1, 456.54, 4.68, 10.91, 'math'),
      span('g', 451.78, 458.17, 4.03, 7.97, 'script'),
      span('is gating activation.', 464.95, 456.54, 85, 10.91, 'body'),
    ]
    const delimiterLine = [
      span('(', 368.19, 447.7, 5, 10.91, 'delimiter'),
      span('[', 390.13, 447.7, 4.55, 10.91, 'delimiter'),
      span(']', 429.22, 447.7, 4.55, 10.91, 'delimiter'),
      span(')', 456.6, 447.7, 5, 10.91, 'delimiter'),
    ]
    const accentLine = [span('¯', 397.53, 453.78, 5.45, 10.91, 'accent')]

    const result = reconstructInlineMath([
      { text: '([])', spans: delimiterLine },
      { text: '¯', spans: accentLine },
      { text: 'where g = σWgH;Hcur+bg is gating activation.', spans: mainLine },
    ], 'page-2:block-4')

    expect(result?.expressions.map(expression => expression.latex)).toEqual([
      'g=\\sigma(W_{g}[\\bar{H};H_{cur}]+b_{g})',
    ])
    expect(result?.source).toBe('where {{pdfmath:page-2:block-4:0}} is gating activation.')
  })

  it('falls back instead of emitting an unbalanced compound formula', () => {
    const result = reconstructInlineMath([{
      text: 'where g = (Wg remains incomplete.',
      spans: [
        span('where', 10, 30, 28, 11, 'body'),
        span('g', 42, 30, 5, 11, 'math'),
        span('=', 51, 30, 8, 11, 'operator'),
        span('(', 63, 22, 5, 11, 'delimiter'),
        span('W', 68, 30, 10, 11, 'math'),
        span('g', 78, 31.6, 4, 8, 'script'),
        span('remains incomplete.', 87, 30, 90, 11, 'body'),
      ],
    }], 'page-2:block-5')

    expect(result).toBeUndefined()
  })

  it('assigns adjacent subscripts to their nearest bases', () => {
    const result = reconstructInlineMath([{
      text: 'activation and Wg, bg are learnable parameters.',
      spans: [
        span('activation and', 307.28, 470.09, 46.55, 10.91, 'body'),
        span('W', 357.62, 470.09, 10.3, 10.91, 'math'),
        span('g', 367.92, 471.72, 4.03, 7.97, 'script'),
        span(', b', 372.73, 470.09, 9.53, 10.91, 'math'),
        span('g', 382.26, 471.72, 4.03, 7.97, 'script'),
        span('are learnable parameters.', 390.87, 470.09, 105, 10.91, 'body'),
      ],
    }], 'page-2:block-6')

    expect(result?.expressions.map(expression => expression.latex)).toEqual(['W_{g}, b_{g}'])
    expect(result?.source).toBe('activation and {{pdfmath:page-2:block-6:0}} are learnable parameters.')
  })
})
