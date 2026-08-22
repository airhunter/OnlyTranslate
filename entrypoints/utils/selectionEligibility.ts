import { shouldTranslateText } from '@/entrypoints/utils/translationDirection'

const EXPLICIT_ADDRESS_PATTERN = /^(?:(?:https?|ftp):\/\/|\/\/|www\.)\S+$/iu
const EMAIL_PATTERN = /^(?:mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/u
const PHONE_LINK_PATTERN = /^(?:tel|sms):[+\d][\d\s().-]*$/iu
const BARE_DOMAIN_PATTERN = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:[a-z]{2,63}|xn--[a-z\d-]{2,59})(?::\d{1,5})?(?:[/?#]\S*)?$/iu
const EAST_ASIAN_CHARACTER_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
const LETTER_PATTERN = /\p{L}/gu
const SCRIPT_PATTERNS = [
  /\p{Script=Latin}/u,
  /\p{Script=Cyrillic}/u,
  /\p{Script=Greek}/u,
  /\p{Script=Arabic}/u,
  /\p{Script=Hebrew}/u,
  /\p{Script=Devanagari}/u,
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  /\p{Script=Hangul}/u,
]

function normalizeAddressCandidate(text: string): string {
  return text
    .trim()
    .replace(/^[\s<\[({"'“‘]+/u, '')
    .replace(/[\s>\])}"'”’.,!?;:，。！？；：]+$/u, '')
}

function closestLink(node: Node | null | undefined): HTMLAnchorElement | null {
  const element = node instanceof Element ? node : node?.parentElement
  return element?.closest<HTMLAnchorElement>('a[href]') ?? null
}

function getContainingLink(range?: Range): HTMLAnchorElement | null {
  if (!range) return null
  const startLink = closestLink(range.startContainer)
  const endLink = closestLink(range.endContainer)
  return startLink && startLink === endLink ? startLink : null
}

function linkLabelMatchesAddress(candidate: string, range?: Range): boolean {
  if (!BARE_DOMAIN_PATTERN.test(candidate)) return false
  const link = getContainingLink(range)
  const href = link?.getAttribute('href')
  if (!link || !href) return false

  // Domain labels are often linked to a site filter instead of the domain itself
  // (for example, Hacker News source labels). Lowercase labels are unambiguous
  // enough to suppress without comparing the destination URL.
  if (candidate === candidate.toLowerCase()) return true

  try {
    const url = new URL(href, link.ownerDocument.baseURI)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const normalizedCandidate = candidate.toLowerCase().replace(/\/$/u, '')
    const host = url.host.toLowerCase()
    const hostAndPath = `${host}${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`
      .toLowerCase()
      .replace(/\/$/u, '')
    return normalizedCandidate === host || normalizedCandidate === hostAndPath
  } catch {
    return false
  }
}

export function isAddressLikeSelection(text: string, range?: Range): boolean {
  const candidate = normalizeAddressCandidate(text)
  if (!candidate || /\s/u.test(candidate)) return false
  return EXPLICIT_ADDRESS_PATTERN.test(candidate)
    || EMAIL_PATTERN.test(candidate)
    || PHONE_LINK_PATTERN.test(candidate)
    || linkLabelMatchesAddress(candidate, range)
}

function hasReliableLanguageSample(text: string): boolean {
  const scriptCount = SCRIPT_PATTERNS.filter(pattern => pattern.test(text)).length
  if (scriptCount > 1) return false

  const eastAsianCharacterCount = text.match(EAST_ASIAN_CHARACTER_PATTERN)?.length ?? 0
  if (eastAsianCharacterCount >= 2) return true

  const letterCount = text.match(LETTER_PATTERN)?.length ?? 0
  const wordCount = text.match(WORD_PATTERN)?.length ?? 0
  return letterCount >= 20 && wordCount >= 3
}

export function shouldShowSelectionToolbar(text: string, range?: Range): boolean {
  if (isAddressLikeSelection(text, range)) return false
  if (!hasReliableLanguageSample(text)) return true
  return shouldTranslateText(text)
}
