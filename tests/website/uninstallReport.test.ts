import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it, vi } from 'vitest'

const reportHtml = readFileSync(
  resolve(process.cwd(), 'website/public/internal/uninstall-report/index.html'),
  'utf8',
)
const reportScript = reportHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
const reportMarkup = reportHtml.replace(/<script>[\s\S]*?<\/script>/, '')

describe('uninstall feedback report', () => {
  it('loads protected log files and renders valid anonymous responses', async () => {
    const window = new Window({
      url: 'https://admin:test-password@onlytranslate.top/internal/uninstall-report/',
    })
    const requestedUrls: string[] = []
    const submission = JSON.stringify({
      level: 'info',
      ts: Date.now() / 1000,
      logger: 'http.log.access.log0',
      msg: 'handled request',
      request: {
        uri: '/uninstall/thanks?reason=hard_to_start&locale=zh-CN&obstacle=service_setup&version=1.5.0',
      },
      status: 200,
    })

    window.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)

      if (url.endsWith('/data/')) {
        return new window.Response(JSON.stringify([
          {
            name: 'submissions.json',
            url: './submissions.json',
            is_dir: false,
          },
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/data/submissions.json')) {
        return new window.Response(`${submission}\n`, { status: 200 })
      }

      return new window.Response('', { status: 404 })
    }) as typeof window.fetch

    window.document.write(reportMarkup)
    window.eval(reportScript)
    await window.happyDOM.waitUntilComplete()
    await vi.waitFor(() => {
      expect(window.document.querySelector('#period-total')?.textContent).toBe('1')
    })

    expect(window.document.querySelector('#top-reason')?.textContent).toBe('不知道如何开始使用')
    expect(window.document.querySelector('#reasons')?.textContent).toContain('不知道如何开始使用')
    expect(window.document.querySelector('#obstacles')?.textContent).toContain('不会选择或配置翻译服务')
    expect(window.document.querySelector('#versions')?.textContent).toContain('1.5.0')
    expect(requestedUrls).toEqual([
      'https://onlytranslate.top/internal/uninstall-report/data/',
      'https://onlytranslate.top/internal/uninstall-report/data/submissions.json',
    ])

    await window.close()
  })
})
