import type { PdfInlineMathExpression, PdfTextSpan } from './layout'

export interface PdfInlineMathLine {
  text: string
  spans: PdfTextSpan[]
}

export interface PdfInlineMathParagraph {
  source: string
  expressions: PdfInlineMathExpression[]
}

interface LogicalMathRow {
  baseline: number
  spans: PdfTextSpan[]
}

interface MathIsland {
  anchor: PdfTextSpan
  members: PdfTextSpan[]
  expression: PdfInlineMathExpression
}

const MATH_ATOM = /^[A-Za-zα-ωΑ-Ω]$/u
const MATH_SCRIPT = /^[A-Za-z0-9α-ωΑ-Ω+−–—\-=,.∗*]+$/u
const MATH_RUN = /^[A-Za-z0-9α-ωΑ-Ω∞+−–—=,.;:()[\]{}|¯×÷·∗*\s]+$/u
const MATH_OPERATOR = /^[∞+−–—=()[\]{}|¯×÷·]+$/u
const MATH_ACCENT = /^[¯‾]$/u
const SHIFTED_DELIMITER = /^[()[\]{}]$/u
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
    if (character === '×') return '\\times '
    if (character === '÷') return '\\div '
    if (character === '·') return '\\cdot '
    if (character === '∗' || character === '*') return '\\ast '
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

function trailingMathAtom(value: string): { prefix: string; atom: string } | undefined {
  const match = value.match(/^(.*?)([A-Za-zα-ωΑ-Ω])$/u)
  return match ? { prefix: match[1], atom: match[2] } : undefined
}

function isMathLikeSpan(span: PdfTextSpan, proseFont: string | undefined, typicalHeight: number): boolean {
  const text = span.text.trim()
  if (!text || text.length > 18 || !MATH_RUN.test(text)) return false
  if (MATH_OPERATOR.test(text)) return true
  if (span.height < typicalHeight * 0.84 && MATH_SCRIPT.test(text)) return true
  return Boolean(proseFont && span.fontName && span.fontName !== proseFont)
}

function isEligibleBase(span: PdfTextSpan, proseFont: string | undefined, typicalHeight: number): boolean {
  const text = span.text.trim()
  if (span.height < typicalHeight * 0.84 || !trailingMathAtom(text)) return false
  if (MATH_ATOM.test(text)) return Boolean(proseFont && span.fontName && span.fontName !== proseFont)
  return text.length <= 4 && Boolean(proseFont && span.fontName && span.fontName !== proseFont)
}

function createLogicalRows(spans: PdfTextSpan[], typicalHeight: number): LogicalMathRow[] {
  const anchorBaselines: number[] = []
  const anchors = spans
    .filter(span => (
      span.height >= typicalHeight * 0.84
      && !MATH_ACCENT.test(span.text.trim())
      && !SHIFTED_DELIMITER.test(span.text.trim())
    ))
    .sort((left, right) => baseline(left) - baseline(right))

  anchors.forEach(span => {
    const value = baseline(span)
    const existingIndex = anchorBaselines.findIndex(candidate => Math.abs(candidate - value) <= typicalHeight * 0.32)
    if (existingIndex < 0) anchorBaselines.push(value)
    else anchorBaselines[existingIndex] = (anchorBaselines[existingIndex] + value) / 2
  })

  const rows = anchorBaselines
    .sort((left, right) => left - right)
    .map(value => ({ baseline: value, spans: [] as PdfTextSpan[] }))
  spans.forEach(span => {
    const row = [...rows]
      .sort((left, right) => Math.abs(left.baseline - baseline(span)) - Math.abs(right.baseline - baseline(span)))[0]
    if (row && Math.abs(row.baseline - baseline(span)) <= typicalHeight * 1.05) row.spans.push(span)
  })
  return rows.filter(row => row.spans.length)
}

function splitMathIslands(
  row: LogicalMathRow,
  proseFont: string | undefined,
  typicalHeight: number,
): PdfTextSpan[][] {
  const islands: PdfTextSpan[][] = []
  let current: PdfTextSpan[] = []
  const flush = () => {
    if (current.length) islands.push(current)
    current = []
  }

  for (const span of [...row.spans].sort((left, right) => left.x - right.x || left.y - right.y)) {
    if (!isMathLikeSpan(span, proseFont, typicalHeight)) {
      flush()
      continue
    }
    const previous = current.at(-1)
    const gap = previous ? span.x - (previous.x + previous.width) : 0
    if (previous && gap > typicalHeight * 1.15) flush()
    current.push(span)
  }
  flush()
  return islands
}

function assignScripts(
  members: PdfTextSpan[],
  proseFont: string | undefined,
  typicalHeight: number,
): Map<PdfTextSpan, PdfTextSpan[]> {
  const assignments = new Map<PdfTextSpan, PdfTextSpan[]>()
  const bases = members.filter(span => isEligibleBase(span, proseFont, typicalHeight))
  const scripts = members.filter(span => (
    span.height < typicalHeight * 0.84
    && MATH_SCRIPT.test(span.text.trim())
  ))

  scripts.forEach(script => {
    const candidates = bases.filter(base => {
      const right = base.x + base.width
      const shifted = Math.abs(baseline(script) - baseline(base)) >= base.height * 0.07
      return shifted
        && script.x >= base.x + base.width * 0.45
        && script.x <= right + typicalHeight * 0.9
    }).sort((left, right) => (
      (right.x + right.width) - (left.x + left.width)
    ))
    const owner = candidates[0]
    if (!owner) return
    const assigned = assignments.get(owner) ?? []
    assigned.push(script)
    assignments.set(owner, assigned)
  })
  return assignments
}

function assignShiftedScriptDelimiters(
  members: PdfTextSpan[],
  assignments: Map<PdfTextSpan, PdfTextSpan[]>,
  typicalHeight: number,
): void {
  const delimiters = members.filter(span => (
    span.height < typicalHeight * 0.84
    && SHIFTED_DELIMITER.test(span.text.trim())
  ))
  assignments.forEach((scripts, base) => {
    delimiters.forEach(delimiter => {
      const delimiterOffset = baseline(delimiter) - baseline(base)
      const sharesScriptLevel = scripts.some(script => {
        const scriptOffset = baseline(script) - baseline(base)
        return Math.sign(scriptOffset) === Math.sign(delimiterOffset)
          && Math.abs(baseline(script) - baseline(delimiter)) <= typicalHeight * 0.35
      })
      if (!sharesScriptLevel) return
      const scriptRight = Math.max(...scripts.map(script => script.x + script.width))
      if (
        delimiter.x >= base.x + base.width * 0.4
        && delimiter.x <= scriptRight + typicalHeight * 0.65
      ) scripts.push(delimiter)
    })
  })
}

function assignAccents(
  members: PdfTextSpan[],
  proseFont: string | undefined,
  typicalHeight: number,
): Map<PdfTextSpan, PdfTextSpan> {
  const assignments = new Map<PdfTextSpan, PdfTextSpan>()
  const bases = members.filter(span => isEligibleBase(span, proseFont, typicalHeight))
  members.filter(span => MATH_ACCENT.test(span.text.trim())).forEach(accent => {
    const candidates = bases.map(base => {
      const overlap = Math.max(
        0,
        Math.min(base.x + base.width, accent.x + accent.width) - Math.max(base.x, accent.x),
      )
      return { base, overlap }
    }).filter(candidate => (
      candidate.overlap > 0
      && baseline(accent) < baseline(candidate.base) - candidate.base.height * 0.05
    )).sort((left, right) => right.overlap - left.overlap)
    if (candidates[0]) assignments.set(candidates[0].base, accent)
  })
  return assignments
}

function renderBase(
  base: PdfTextSpan,
  scripts: PdfTextSpan[],
  accented: boolean,
): string {
  const atom = trailingMathAtom(base.text.trim())
  if (!atom) return normalizeLatexToken(base.text.trim())
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
  const baseLatex = normalizeLatexToken(atom.atom)
  const decorated = accented ? `\\bar{${baseLatex}}` : baseLatex
  return `${normalizeLatexToken(atom.prefix)}${decorated}${subscript ? `_{${normalizeLatexToken(subscript)}}` : ''}${superscript ? `^{${normalizeLatexToken(superscript)}}` : ''}`
}

function hasBalancedDelimiters(members: PdfTextSpan[]): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: string[] = []
  for (const character of [...members]
    .sort((left, right) => left.x - right.x || left.y - right.y)
    .map(span => span.text)
    .join('')) {
    if (character === '(' || character === '[' || character === '{') stack.push(character)
    else if (pairs[character]) {
      if (stack.pop() !== pairs[character]) return false
    }
  }
  return stack.length === 0
}

function buildMathIsland(
  members: PdfTextSpan[],
  proseFont: string | undefined,
  typicalHeight: number,
  token: string,
): MathIsland | undefined {
  const bases = members.filter(span => isEligibleBase(span, proseFont, typicalHeight))
  if (!bases.length || !hasBalancedDelimiters(members)) return undefined
  const scripts = assignScripts(members, proseFont, typicalHeight)
  assignShiftedScriptDelimiters(members, scripts, typicalHeight)
  const accents = assignAccents(members, proseFont, typicalHeight)
  const consumed = new Set<PdfTextSpan>([
    ...[...scripts.values()].flat(),
    ...accents.values(),
  ])
  const unassignedScripts = members.filter(span => (
    span.height < typicalHeight * 0.84
    && MATH_SCRIPT.test(span.text.trim())
    && !consumed.has(span)
  ))
  if (unassignedScripts.length) return undefined

  const ordered = [...members].sort((left, right) => left.x - right.x || left.y - right.y)
  const latex = ordered.map(span => {
    if (consumed.has(span)) return ''
    if (bases.includes(span)) return renderBase(span, scripts.get(span) ?? [], accents.has(span))
    return normalizeLatexToken(span.text.trim())
  }).join('')
  if (!latex || !/[A-Za-z\\]/.test(latex)) return undefined
  const anchor = [...bases].sort((left, right) => left.x - right.x || right.height - left.height)[0]
  return {
    anchor,
    members,
    expression: { token, latex, source: latex },
  }
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
  const islands: MathIsland[] = []

  createLogicalRows(spans, typicalHeight).forEach(row => {
    splitMathIslands(row, proseFont, typicalHeight).forEach(members => {
      const island = buildMathIsland(
        members,
        proseFont,
        typicalHeight,
        `{{pdfmath:${tokenNamespace}:${islands.length}}}`,
      )
      if (island) islands.push(island)
    })
  })

  if (!islands.length) return undefined
  const consumed = new Set(islands.flatMap(island => island.members.filter(span => span !== island.anchor)))
  const byAnchor = new Map(islands.map(island => [island.anchor, island]))
  const richLines = lines.map(line => {
    const units: Array<{ text: string; x: number; width: number; height: number }> = []
    for (const span of [...line.spans].sort((left, right) => left.x - right.x)) {
      if (consumed.has(span)) continue
      const island = byAnchor.get(span)
      if (island) {
        const left = Math.min(...island.members.map(item => item.x))
        const right = Math.max(...island.members.map(item => item.x + item.width))
        units.push({ text: island.expression.token, x: left, width: right - left, height: span.height })
      }
      else units.push({ text: span.text, x: span.x, width: span.width, height: span.height })
    }
    return units.reduce((text, unit, index) => {
      if (!index) return unit.text
      return `${text}${shouldInsertSpace(units[index - 1], unit) ? ' ' : ''}${unit.text}`
    }, '').trim()
  })

  return { source: normalizeLines(richLines), expressions: islands.map(island => island.expression) }
}
