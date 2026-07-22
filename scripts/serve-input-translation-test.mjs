import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const testPagePath = fileURLToPath(new URL('../tests/manual/input-box-translation.html', import.meta.url))
const port = Number.parseInt(process.env.ONLYTRANSLATE_INPUT_TEST_PORT || '4173', 10)

const server = createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/input-box-translation.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8'
  })
  createReadStream(testPagePath).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`OnlyTranslate 输入翻译测试页：http://127.0.0.1:${port}`)
  console.log('保持此命令运行；测试结束后按 Ctrl+C 退出。')
})
