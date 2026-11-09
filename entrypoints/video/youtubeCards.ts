import { t } from '@/entrypoints/utils/i18n/content'
import { getYouTubeCardVideoId, YOUTUBE_PLAYER_PAGE } from './youtubeEmbed'

const LINK_SELECTOR = 'a[href*="youtube.com"], a[href*="youtu.be"], a[href^="https://t.co/"], a[href^="https://l.threads.com/"]'

function openPlayer(id: string, opener: HTMLButtonElement) {
    const dialog = document.createElement('dialog')
    dialog.dataset.onlytranslateYoutubeDialog = ''
    dialog.setAttribute('aria-label', t('video.youtubePlayerTitle'))
    dialog.style.cssText = 'width:min(880px,96vw);max-width:96vw;max-height:96dvh;padding:12px;border:0;border-radius:12px;background:#111;color:#fff;box-sizing:border-box;overflow:auto'

    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = t('selection.close')
    close.style.cssText = 'display:block;margin:0 0 8px auto;padding:5px 10px;background:#303030;color:#fff;border:0;border-radius:6px;cursor:pointer;font:14px system-ui,sans-serif'
    close.addEventListener('click', () => dialog.close())

    const player = document.createElement('iframe')
    player.title = t('video.youtubePlayerTitle')
    player.src = `${browser.runtime.getURL(YOUTUBE_PLAYER_PAGE)}#${id}`
    player.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'
    player.allowFullscreen = true
    player.style.cssText = 'display:block;width:100%;height:min(72dvh,54vw,480px);min-height:200px;border:0;background:#111'

    dialog.addEventListener('close', () => {
        dialog.remove()
        if (opener.isConnected) opener.focus({ preventScroll: true })
    }, { once: true })
    dialog.append(close, player)
    document.body.append(dialog)
    dialog.showModal()
    return dialog
}

function findCardLinks(): HTMLAnchorElement[] {
    const threads = location.hostname.endsWith('threads.com')
    const links = new Map<Element, Map<string, { anchor: HTMLAnchorElement; rich: boolean }>>()
    document.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR).forEach(anchor => {
        const id = getYouTubeCardVideoId(anchor)
        if (!id || !anchor.parentElement || anchor.parentElement.closest('a,button')) return
        const rich = Boolean(anchor.closest('[data-testid="card.wrapper"]') || anchor.querySelector('img,picture,[role="img"]'))
        // Threads displays an inline link and a preview for the same URL.
        if (threads && !rich) return
        const post = anchor.closest('article,[data-testid="tweet"]') ?? anchor.parentElement
        let videos = links.get(post)
        if (!videos) links.set(post, videos = new Map())
        const previous = videos.get(id)
        if (!previous || (rich && !previous.rich)) videos.set(id, { anchor, rich })
    })
    return [...links.values()].flatMap(videos => [...videos.values()].map(entry => entry.anchor))
}

export function mountYouTubeCards() {
    const buttons = new Map<HTMLAnchorElement, HTMLButtonElement>()
    let active: HTMLDialogElement | undefined
    let pendingScan: number | undefined
    const scan = () => {
        pendingScan = undefined
        const links = new Set(findCardLinks())
        for (const [anchor, button] of buttons) {
            if (links.has(anchor) && button.parentElement === anchor.parentElement) continue
            button.remove()
            buttons.delete(anchor)
        }
        for (const anchor of links) {
            if (buttons.has(anchor)) continue
            const button = document.createElement('button')
            button.type = 'button'
            button.dataset.onlytranslateYoutubeCard = ''
            button.textContent = t('video.youtubePlayInPage')
            button.style.cssText = 'display:inline-flex;vertical-align:middle;margin:4px 6px;padding:4px 8px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px;line-height:1.4;white-space:nowrap'
            button.addEventListener('click', event => {
                event.preventDefault()
                event.stopPropagation()
                const id = getYouTubeCardVideoId(anchor)
                if (!id) return
                active?.close()
                active = openPlayer(id, button)
            })
            anchor.after(button)
            buttons.set(anchor, button)
        }
    }

    const affectsLinks = (node: Node) => node instanceof Element
        && (node.matches(LINK_SELECTOR) || node.querySelector(LINK_SELECTOR) !== null)
    const observer = new MutationObserver(records => {
        if (pendingScan !== undefined) return
        if (records.some(record => (record.target instanceof Element && record.target.closest(LINK_SELECTOR))
            || [...record.addedNodes, ...record.removedNodes].some(affectsLinks))) {
            pendingScan = requestAnimationFrame(scan)
        }
    })
    scan()
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'title'] })
}
