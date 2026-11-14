import { spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

function fixedBuildArgs(args, root) {
  if (!['build', 'zip'].includes(args[0])) throw new Error('正式构建入口只接受 build 或 zip')
  const options = new Map()
  for (let index = 1; index < args.length; index++) {
    const token = args[index], equals = token.indexOf('=')
    const flag = equals < 0 ? token : token.slice(0, equals)
    const key = ['-b', '--browser'].includes(flag) ? 'browser' : ['-m', '--mode'].includes(flag) ? 'mode' : null
    if (!key) throw new Error('正式构建只允许 browser 和 mode 参数，不能变更项目目录、配置或入口')
    if (options.has(key)) throw new Error('正式构建参数不能重复：' + key)
    const value = equals < 0 ? args[++index] : token.slice(equals + 1)
    const allowed = key === 'browser' ? ['chrome', 'edge', 'firefox'] : ['production', 'development']
    if (!allowed.includes(value)) throw new Error('无效的正式构建参数：' + key)
    options.set(key, value)
  }
  return [args[0], root, '--config', join(root, 'wxt.config.ts'), ...[...options].flatMap(([key, value]) => ['--' + key, value])]
}

export function runNode(script, args, root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`命令未通过（${signal || code}）：${script}`))
    })
  })
}

// Repository orchestration: the extension's WXT configuration has no tool dependency.
export async function buildExtension(args, { root = repositoryRoot, run = runNode } = {}) {
  root = resolve(root)
  const buildArgs = fixedBuildArgs(args, root)
  try {
    await run(join(root, 'tools/reading-review/check.mjs'), [], root)
  } catch (error) {
    throw new Error('人工验证集未通过，正式构建已停止。查看校验报告或运行 pnpm review:reading；不要修改裁决来绕过检查。', { cause: error })
  }
  await run(join(root, 'node_modules/wxt/bin/wxt.mjs'), buildArgs, root)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildExtension(process.argv.slice(2)) }
  catch (error) { console.error(error.message); if (error.cause) console.error(error.cause.message); process.exitCode = 1 }
}
