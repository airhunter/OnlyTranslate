import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { mountYouTubeCards } from '@/entrypoints/video/youtubeCards'

describe('YouTube cards', () => {
  it('loads the embedded player from the extension bundle in development and production', () => {
    const page = document.createElement('template')
    page.innerHTML = readFileSync(resolve(process.cwd(), 'public/youtube-player.html'), 'utf8')
    expect([...page.content.querySelectorAll('script')].map(script => script.getAttribute('src'))).toEqual(['/youtube-player.js'])
    expect(existsSync(resolve(process.cwd(), 'entrypoints/youtube-player.ts'))).toBe(true)
  })

  it('adds one button beside the Threads preview and only creates a player after a click', () => {
    window.location.href = 'https://www.threads.com/@apple_geek_actu/post/DfaPdAUjfvq'
    document.body.innerHTML = `
      <article>
        <a href="https://l.threads.com/?u=https%3A%2F%2Fyoutube.com%2Flive%2FB93JLId4emc">YouTube</a>
        <div><a id="preview" href="https://l.threads.com/?u=https%3A%2F%2Fyoutube.com%2Flive%2FB93JLId4emc"><img alt="Preview"></a></div>
      </article>`
    const getURL = vi.fn(() => 'about:blank')
    vi.stubGlobal('browser', { runtime: { getURL } })
    try {
      mountYouTubeCards()
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-onlytranslate-youtube-card]')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].previousElementSibling?.id).toBe('preview')
      expect(document.querySelector('iframe')).toBeNull()

      buttons[0].click()
      expect(document.querySelector('dialog')?.open).toBe(true)
      expect(getURL).toHaveBeenCalledWith('/youtube-player.html')
      expect(document.querySelector('iframe')?.src).toBe('about:blank#B93JLId4emc')
      expect(location.hostname).toBe('www.threads.com')
      document.querySelector('dialog')?.close()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
