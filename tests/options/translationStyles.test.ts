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

  it('uses the outer bilingual content node only as the managed insertion boundary', () => {
    const declarations = getRuleDeclarations('.only-translate-bilingual-content')

    expect(declarations).not.toContain('display: block')
  })

  it('keeps styled translations atomic unless layout handling overrides them', () => {
    const textDeclarations = getRuleDeclarations('.only-translate-bilingual-text')
    const markerDeclarations = getRuleDeclarations('.fluent-display-marker')

    expect(textDeclarations).toContain('display: inline-block')
    expect(markerDeclarations).toContain('display: inline')
    expect(markerDeclarations).toContain('box-decoration-break: clone')
  })
})
