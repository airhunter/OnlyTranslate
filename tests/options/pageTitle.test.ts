import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('options page title', () => {
  it('does not expose WebExtension message placeholders in the HTML title', () => {
    const html = readFileSync(resolve(process.cwd(), 'entrypoints/options/index.html'), 'utf8')
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? ''

    expect(title).toBeTruthy()
    expect(title).not.toContain('__MSG_')
  })
})
