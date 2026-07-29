import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(resolve(process.cwd(), 'entrypoints/style.css'), 'utf8')

function getRuleDeclarations(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))

  expect(match, `Expected ${selector} to exist in entrypoints/style.css`).not.toBeNull()
  return match?.[1] ?? ''
}

describe('bilingual translation styles', () => {
  it('draws the dotted underline on translated text instead of the full block box', () => {
    const declarations = getRuleDeclarations('.fluent-display-dot-underline')

    expect(declarations).toContain('text-decoration-line: underline')
    expect(declarations).toContain('text-decoration-style: dotted')
    expect(declarations).toContain('text-decoration-color: #93a2b7')
    expect(declarations).toContain('text-decoration-thickness: 1px')
    expect(declarations).not.toContain('border-bottom')
  })

  it('keeps bilingual translations in their existing block layout', () => {
    const declarations = getRuleDeclarations('.only-translate-bilingual-content')

    expect(declarations).toContain('display: block')
  })
})
