// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const releaseIt = fileURLToPath(new URL('../../node_modules/release-it/bin/release-it.js', import.meta.url))
const releaseConfig = JSON.parse(readFileSync(new URL('../../.release-it.json', import.meta.url), 'utf8'))

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

it.each([
  { failure: 'verify', version: '1.0.0', steps: ['verify'] },
  { failure: 'zip', version: '1.0.1', steps: ['verify', 'zip'] },
  { failure: 'check', version: '1.0.1', steps: ['verify', 'zip', 'check'] },
])('stops before the release commit, tag and push on $failure failure', ({ failure, version, steps }) => {
  const folder = mkdtempSync(join(tmpdir(), 'onlytranslate-release-'))
  const repo = join(folder, 'repo')
  const remote = join(folder, 'remote')
  mkdirSync(repo)
  mkdirSync(remote)

  try {
    git(remote, 'init', '--bare', '--initial-branch=main')
    git(repo, 'init', '--initial-branch=main')
    git(repo, 'config', 'user.name', 'Release test')
    git(repo, 'config', 'user.email', 'release-test@example.invalid')
    git(repo, 'config', 'commit.gpgsign', 'false')
    git(repo, 'remote', 'add', 'origin', remote)
    writeFileSync(join(repo, '.release-it.json'), JSON.stringify({
      ...releaseConfig, github: { release: false }, plugins: {},
    }))
    writeFileSync(join(repo, 'package.json'), JSON.stringify({
      name: 'onlytranslate-release-test',
      version: '1.0.0',
      private: true,
      scripts: {
        verify: 'node step.cjs verify',
        'zip:all': 'node step.cjs zip',
        'release:check': 'node step.cjs check',
      },
    }))
    writeFileSync(join(repo, 'step.cjs'), [
      "const { appendFileSync } = require('node:fs')",
      'const step = process.argv[2]',
      "appendFileSync('steps.log', step + '\\n')",
      `if (step === ${JSON.stringify(failure)}) process.exit(23)`,
    ].join('\n'))
    git(repo, 'add', '.')
    git(repo, 'commit', '-m', 'test: 准备隔离发布仓库')
    git(repo, 'push', '-u', 'origin', 'main')
    const originalHead = git(repo, 'rev-parse', 'HEAD')

    const result = spawnSync(process.execPath, [releaseIt, 'patch', '--ci'], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 15_000,
    })

    expect(result.status, result.stderr).toBe(1)
    expect(readFileSync(join(repo, 'steps.log'), 'utf8').trim().split('\n')).toEqual(steps)
    expect(JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version).toBe(version)
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(originalHead)
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(originalHead)
    expect(git(repo, 'tag', '--list')).toBe('')
    expect(git(remote, 'tag', '--list')).toBe('')
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}, 20_000)
