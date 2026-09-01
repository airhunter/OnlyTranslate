import type { PdfInlineMathExpression, PdfTextSpan } from './layout'

export interface PdfInlineMathLine {
  text: string
  spans: PdfTextSpan[]
}

export interface PdfInlineMathParagraph {
  source: string
  expressions: PdfInlineMathExpression[]
}

interface MathCandidate {
  base: PdfTextSpan
  scripts: PdfTextSpan[]
  expression: PdfInlineMathExpression
}

const MATH_ATOM = /^[A-Za-zα-ωΑ-Ω]$/u
const MATH_SCRIPT = /^[A-Za-z0-9α-ωΑ-Ω+−–—\-=,.]+$/u
const GREEK_LATEX: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\epsilon', ζ: '\\zeta', η: '\\eta',
  θ: '\\theta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi',
  π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', υ: '\\upsilon', φ: '\\phi', χ: '\\chi',
  ψ: '\\psi', ω: '\\omega', Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi',
  Π: '\\Pi', Σ: '\\Sigma', Υ: '\\Upsilon', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
}

function proseHeight(values: number[]): number {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.floor((ordered.length - 1) * 0.7)]
}

function baseline(span: PdfTextSpan): number {
  return span.baseline ?? span.y + span.height
}

function normalizeLatexToken(value: string): string {
  return [...value].map(character => {
    if (GREEK_LATEX[character]) return GREEK_LATEX[character]
    if (character === '−' || character === '–' || character === '—') return '-'
    if (character === '∞') return '\\infty'
    return character.replace(/[{}\\]/g, match => `\\${match}`)
  }).join('')
}

function dominantFont(spans: PdfTextSpan[], typicalHeight: number): string | undefined {
  const weights = new Map<string, number>()
  spans.forEach(span => {
    if (!span.fontName || span.height < typicalHeight * 0.84) return
    const weight = span.text.match(/\p{L}/gu)?.length ?? 0
    if (weight) weights.set(span.fontName, (weights.get(span.fontName) ?? 0) + weight)
  })
  return [...weights].sort((left, right) => right[1] - left[1])[0]?.[0]
}

function scriptCandidates(base: PdfTextSpan, spans: PdfTextSpan[], typicalHeight: number): PdfTextSpan[] {
  const right = base.x + base.width
  return spans.filter(span => {
    const text = span.text.trim()
    if (
      span === base
      || !text
      || text.length > 12
      || !MATH_SCRIPT.test(text)
      || span.height > base.height * 0.86
    ) return false
    const horizontal = span.x >= base.x + base.width * 0.52
      && span.x <= right + typicalHeight * 1.65
    const vertical = Math.abs((span.y + span.height / 2) - (base.y + base.height / 2)) <= base.height * 1.25
    const shifted = Math.abs(baseline(span) - baseline(base)) >= base.height * 0.07
    return horizontal && vertical && shifted
  })
}

function candidateLatex(base: PdfTextSpan, scripts: PdfTextSpan[]): string {
  const threshold = base.height * 0.07
  const superscript = scripts
    .filter(span => baseline(span) < baseline(base) - threshold)
    .sort((left, right) => left.x - right.x)
    .map(span => span.text.trim())
    .join('')
  const subscript = scripts
    .filter(span => baseline(span) > baseline(base) + threshold)
    .sort((left, right) => left.x - right.x)
    .map(span => span.text.trim())
    .join('')
  return `${normalizeLatexToken(base.text.trim())}${subscript ? `_{${normalizeLatexToken(subscript)}}` : ''}${superscript ? `^{${normalizeLatexToken(superscript)}}` : ''}`
}

function shouldInsertSpace(
  previous: { text: string; x: number; width: number; height: number },
  current: { text: string; x: number; width: number; height: number },
): boolean {
  const gap = current.x - (previous.x + previous.width)
  if (gap <= Math.max(1.5, Math.min(previous.height, current.height) * 0.13)) return false
  return !/^[,.;:!?%)\]}]/.test(current.text) && !/[([{/]$/.test(previous.text)
}

function normalizeLines(lines: string[]): string {
  let result = ''
  lines.filter(Boolean).forEach((line, index) => {
    if (!index) result = line
    else if (/[A-Za-z]{2,}-$/.test(result) && /^[a-z]/.test(line)) result = result.slice(0, -1) + line
    else result += ` ${line}`
  })
  return result.replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim()
}

export function reconstructInlineMath(
  lines: PdfInlineMathLine[],
  tokenNamespace: string,
): PdfInlineMathParagraph | undefined {
  const spans = [...new Set(lines.flatMap(line => line.spans))].filter(span => span.text.trim() && span.height > 0)
  if (!spans.length) return undefined
  const typicalHeight = Math.max(1, proseHeight(spans.map(span => span.height)))
  const proseFont = dominantFont(spans, typicalHeight)
  const consumed = new Set<PdfTextSpan>()
  const byBase = new Map<PdfTextSpan, MathCandidate>()
  const expressions: PdfInlineMathExpression[] = []

  for (const base of spans.sort((left, right) => right.height - left.height || left.y - right.y || left.x - right.x)) {
    const text = base.text.trim()
    if (
      consumed.has(base)
      || base.height < typicalHeight * 0.84
      || !MATH_ATOM.test(text)
    ) continue
    const scripts = scriptCandidates(base, spans, typicalHeight).filter(span => !consumed.has(span))
    const alternateMathFont = Boolean(proseFont && base.fontName && base.fontName !== proseFont)
    if (!scripts.length && !alternateMathFont) continue
    const token = `{{pdfmath:${tokenNamespace}:${expressions.length}}}`
    const latex = candidateLatex(base, scripts)
    const source = latex.replace(/_\{([^{}]+)\}/g, '_$1').replace(/\^\{([^{}]+)\}/g, '^$1')
    const expression = { token, latex, source }
    expressions.push(expression)
    byBase.set(base, { base, scripts, expression })
    scripts.forEach(span => consumed.add(span))
  }

  if (!expressions.length) return undefined
  const richLines = lines.map(line => {
    const units: Array<{ text: string; x: number; width: number; height: number }> = []
    for (const span of [...line.spans].sort((left, right) => left.x - right.x)) {
      if (consumed.has(span)) continue
      const candidate = byBase.get(span)
      if (candidate) {
        const members = [candidate.base, ...candidate.scripts]
        const left = Math.min(...members.map(item => item.x))
        const right = Math.max(...members.map(item => item.x + item.width))
        units.push({ text: candidate.expression.token, x: left, width: right - left, height: candidate.base.height })
      }
      else units.push({ text: span.text, x: span.x, width: span.width, height: span.height })
    }
    return units.reduce((text, unit, index) => {
      if (!index) return unit.text
      return `${text}${shouldInsertSpace(units[index - 1], unit) ? ' ' : ''}${unit.text}`
    }, '').trim()
  })

  return { source: normalizeLines(richLines), expressions }
}
