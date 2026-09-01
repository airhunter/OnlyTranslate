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
})
