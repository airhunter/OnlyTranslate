import { afterEach, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile, symlink, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const execute = promisify(execFile)
const folders: string[] = []
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }) })

it('renders previews outside the repository with only the tool declared runtime dependencies', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'reading-review-dependencies-')); folders.push(folder)
  const project = resolve(import.meta.dirname, '..')
  const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
  await writeFile(join(folder, 'package.json'), JSON.stringify(pkg))
  await writeFile(join(folder, 'preview.mjs'), await readFile(join(project, 'preview.mjs')))
  await mkdir(join(folder, 'node_modules'))
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    await symlink(await realpath(join(project, 'node_modules', name)), join(folder, 'node_modules', name), 'junction')
  }
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', `
    const { previewHtml } = await import('./preview.mjs');
    const snapshot = { id: 'snapshot', pageId: 'sample', url: 'https://example.org/', assets: [] };
    console.log(previewHtml('<html><body><p>isolated preview</p></body></html>', snapshot, 'http://127.0.0.1:4188'));
  `], { cwd: folder, timeout: 15000 })
  expect(stdout).toContain('isolated preview')
})
