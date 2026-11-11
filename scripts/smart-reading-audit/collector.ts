import { getTranslatableText } from '../../entrypoints/main/dom'
import * as profiles from '../../entrypoints/main/siteProfiles'
import { resolveAutoTranslationTarget } from '../../entrypoints/main/translationTarget/collect'

declare const __AUDIT_REVISION__: string
declare const __AUDIT_SOURCE_DIRTY__: boolean
declare const __AUDIT_GIT_DIFF_HASH__: string
declare const __AUDIT_SOURCE_HASH__: string

function selectorPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element
  while (current) {
    let position = 1
    for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.localName === current.localName) position++
    }
    const id = current.id ? `#${CSS.escape(current.id)}` : ''
    parts.unshift(`${CSS.escape(current.localName)}${id}:nth-of-type(${position})`)
    const root = current.getRootNode()
    if (!current.parentElement && root instanceof ShadowRoot) {
      parts.unshift('>>>')
      current = root.host
    } else {
      current = current.parentElement
    }
  }
  return parts.join(' > ').replaceAll(' > >>> > ', ' >>> ')
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
const probeKey = (text: string) => text.replace(/\s+/g, '')

async function collect(siteProfilesEnabled: boolean, probes: string[]) {
  // Each invocation runs in a fresh replay page. Clear both registry access paths.
  if (!siteProfilesEnabled) {
    profiles.siteProfiles.length = 0
    for (const [name, map] of Object.entries(profiles)) {
      if (!name.startsWith('siteProfile') || !name.endsWith('Fns')) continue
      for (const domain of Object.keys(map)) delete (map as Record<string, unknown>)[domain]
    }
  }

  const started = performance.now()
  const result = resolveAutoTranslationTarget('smart')
  const elapsedMs = performance.now() - started
  const decisions = new Map(result.decisions.map(decision => [decision.target, decision]))
  const textByTarget = result.nodes.map(node => normalize(getTranslatableText(node)))
  const targets = await Promise.all(result.nodes.map(async (node, index) => {
    const text = textByTarget[index]
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const decision = decisions.get(node)
    return {
      tag: node.localName,
      path: selectorPath(node),
      text: text.slice(0, 200),
      textHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
      source: decision?.source,
      reasons: decision?.reasons ?? []
    }
  }))
  const body = document.body.cloneNode(true) as HTMLElement
  body.querySelectorAll('script, style, template, noscript').forEach(element => element.remove())
  const bodyText = probeKey(body.textContent ?? '')
  const probeTargets = textByTarget.map(probeKey)
  return {
    revision: __AUDIT_REVISION__,
    sourceDirty: __AUDIT_SOURCE_DIRTY__,
    gitDiffHash: __AUDIT_GIT_DIFF_HASH__,
    sourceHash: __AUDIT_SOURCE_HASH__,
    url: location.href,
    siteProfilesEnabled,
    contentRoot: selectorPath(result.contentRoot),
    elapsedMs,
    stats: result.stats,
    targets,
    probes: probes.map(text => {
      const key = probeKey(text)
      return {
        text,
        inDocument: bodyText.includes(key),
        selectedPaths: targets.filter((_, index) => probeTargets[index].includes(key)).map(target => target.path)
      }
    })
  }
}

Object.assign(window, { onlyTranslateSmartReadingAudit: collect })
