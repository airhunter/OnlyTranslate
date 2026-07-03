import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const serviceFiles = [
  '_service.ts',
  'chrome-translator.ts',
  'claude.ts',
  'common.ts',
  'custom.ts',
  'deepl.ts',
  'deepseek.ts',
  'gemini.ts',
  'google.ts',
  'microsoft.ts',
  'minimax.ts',
  'newapi.ts',
  'zhipu.ts'
]

describe('service adapter type boundaries', () => {
  it('uses explicit translation service message/result types instead of any', () => {
    for (const file of serviceFiles) {
      const source = readFileSync(resolve(process.cwd(), 'entrypoints/service', file), 'utf8')

      expect(source, file).not.toMatch(/\bmessage:\s*any\b/)
      expect(source, file).not.toMatch(/\bPromise<any>\b/)
      expect(source, file).not.toMatch(/ServiceFunction\s*=\s*\(message:\s*any\)\s*=>\s*Promise<any>/)
    }
  })

  it('does not keep a standalone Grok adapter because Grok routes through the OpenAI-compatible adapter', () => {
    const serviceSource = readFileSync(resolve(process.cwd(), 'entrypoints/service/_service.ts'), 'utf8')

    expect(serviceSource).not.toMatch(/from\s+['"]\.\/grok['"]/)
    expect(existsSync(resolve(process.cwd(), 'entrypoints/service/grok.ts'))).toBe(false)
  })
})
