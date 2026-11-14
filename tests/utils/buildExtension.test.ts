// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildExtension } from '../../scripts/build-extension.mjs'

const folders: string[] = []
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }) })

describe('formal extension build orchestration', () => {
  it.each(['build', 'zip'])('rejects alternate inputs for %s before either subprocess starts', async command => {
    const rejected = [
      ['another-project'], ['.'], ['--root', 'another-project'], ['--cwd=another-project'],
      ['--config', 'alternate.config.ts'], ['--config=alternate.config.ts'],
      ['-c', 'alternate.config.ts'], ['-calternate.config.ts'], ['-c=alternate.config.ts'],
      ['--', 'another-project'], ['--filter-entrypoint', 'popup'], ['-e', 'popup'],
      ['--unknown'], ['__proto__', 'production'], ['toString', 'production'],
      ['--browser'], ['--mode'], ['--browser='], ['--mode='],
      ['--browser', '--config'], ['--browser', 'another-project'], ['--mode', 'custom'],
      ['-b', 'edge', '--browser=firefox'], ['-m', 'production', '--mode=development'],
    ]
    for (const extra of rejected) {
      const run = vi.fn(async () => {})
      await expect(buildExtension([command, ...extra], { run })).rejects.toThrow()
      expect(run).not.toHaveBeenCalled()
    }
  })

  it.each(['build', 'zip'])('checks before %s and pins the source/config while forwarding browser/mode', async command => {
    const run = vi.fn(async () => {})
    const root = resolve('.')
    const args = [command, '-b', 'firefox', '--mode', 'development']
    await buildExtension(args, { root, run })
    expect(run.mock.calls).toEqual([
      [join(root, 'tools/reading-review/check.mjs'), [], root],
      [join(root, 'node_modules/wxt/bin/wxt.mjs'), [command, root, '--config', join(root, 'wxt.config.ts'), '--browser', 'firefox', '--mode', 'development'], root],
    ])
  })

  it.each([
    ['--browser=edge', '-m=production'], ['-b', 'edge', '--mode', 'production'],
    ['--browser', 'edge', '--mode=production'],
  ])('accepts supported browser/mode spellings %j without forwarding raw arguments', async (...extra) => {
    const root = resolve('.'), run = vi.fn(async () => {})
    await buildExtension(['zip', ...extra], { root, run })
    expect(run.mock.calls[1]).toEqual([join(root, 'node_modules/wxt/bin/wxt.mjs'), ['zip', root, '--config', join(root, 'wxt.config.ts'), '--browser', 'edge', '--mode', 'production'], root])
  })

  it.each(['build', 'zip'])('never launches %s after a failed check', async command => {
    const run = vi.fn(async () => { throw new Error('missing corpus') })
    await expect(buildExtension([command], { run })).rejects.toThrow('正式构建已停止')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported commands and preserves packaging failures', async () => {
    const run = vi.fn(async () => {})
    await expect(buildExtension(['serve'], { run })).rejects.toThrow('只接受 build 或 zip')
    expect(run).not.toHaveBeenCalled()
    run.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('packaging failed'))
    await expect(buildExtension(['zip'], { run })).rejects.toThrow('packaging failed')
  })

  it('fails closed on missing checks, nonzero exits and terminated checks, then builds only on success', async () => {
    const root = await mkdtemp(join(tmpdir(), 'extension-orchestration-')); folders.push(root)
    const check = join(root, 'tools/reading-review/check.mjs')
    const wxt = join(root, 'node_modules/wxt/bin/wxt.mjs')
    const built = join(root, 'built.json')
    await mkdir(join(root, 'node_modules/wxt/bin'), { recursive: true })
    await mkdir(join(root, 'tools/reading-review'), { recursive: true })
    await writeFile(wxt, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(built)},JSON.stringify(process.argv.slice(2)))`)
    for (const body of [null, 'process.exitCode=1', "process.kill(process.pid, 'SIGTERM')"]) {
      if (body !== null) await writeFile(check, body)
      await expect(buildExtension(['zip'], { root })).rejects.toThrow('正式构建已停止')
      await expect(readFile(built)).rejects.toMatchObject({ code: 'ENOENT' })
    }
    await writeFile(check, 'process.exitCode=0')
    await buildExtension(['zip', '-b', 'edge'], { root })
    expect(JSON.parse(await readFile(built, 'utf8'))).toEqual(['zip', root, '--config', join(root, 'wxt.config.ts'), '--browser', 'edge'])
  })

  it('keeps every public build/zip entry gated and development independent', async () => {
    const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
    for (const command of ['build', 'zip']) {
      expect(pkg.scripts[command]).toBe(`node scripts/build-extension.mjs ${command}`)
      for (const browser of ['edge', 'firefox']) expect(pkg.scripts[`${command}:${browser}`]).toBe(`node scripts/build-extension.mjs ${command} -b ${browser}`)
    }
    expect(pkg.scripts['zip:all']).toBe('pnpm zip && pnpm zip:edge && pnpm zip:firefox')
    expect(pkg.scripts.dev).toBe('wxt')
    const config = await readFile(new URL('../../wxt.config.ts', import.meta.url), 'utf8')
    expect(config).not.toContain('reading-review')
    expect(config).not.toContain('enforceReadingCheck')
  })
})
