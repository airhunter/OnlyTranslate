import { spawn } from 'node:child_process'
import { join } from 'node:path'

function runCheck(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts/reading-review/check.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`人工验证集未通过，正式构建已停止（${signal || code}）。查看校验报告或运行 pnpm review:reading；不要修改裁决来绕过检查。`))
    })
  })
}

export async function enforceReadingCheck(command, root, run = runCheck) {
  if (command === 'serve') return
  await run(root)
}
