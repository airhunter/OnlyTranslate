import { collectTranslationTargets, resolveAutoTranslationTarget } from '../../entrypoints/main/translationTarget/collect'
import { createScanContext } from '../../entrypoints/main/translationTarget/scanContext'
import { classifyContentUnit } from '../../entrypoints/utils/contentUnitClassifier'
import { getContentFilterDecision, invalidateContentFilterCache } from '../../entrypoints/utils/contentFilter'
import { DIRECT_TEXT_TARGET_ATTR, unwrapDirectTextTarget } from '../../entrypoints/main/dom'

type Mode = 'smart' | 'full'
type Root = Document | ShadowRoot
const round = (n: number) => Math.round(n * 100) / 100
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const owned = '[data-fr-translated], .only-translate-bilingual-content, [data-onlytranslate-shadow-audit]'
const blocked = 'script,style,noscript,template,input,textarea,select,button,nav,footer,form,dialog,[role="navigation"],[role="toolbar"],[role="menu"],[role="tab"],[role="tablist"],[role="dialog"],.notranslate,[translate="no"],[contenteditable="true"]'

function composedParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot
  if (el.parentElement) return el.parentElement
  const root = el.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

// Experimental boundary guard, not a replacement for the production classifier.
function boundaryAllowed(el: Element, cache = new WeakMap<Element, boolean>()): boolean {
  const chain: Element[] = []
  const finish = (allowed: boolean) => { for (const item of chain) cache.set(item, allowed); return allowed }
  for (let current: Element | null = el; current; current = composedParent(current)) {
    const cached = cache.get(current)
    if (cached !== undefined) return finish(cached)
    chain.push(current)
    if (current.matches(`${blocked},${owned},[hidden],[aria-hidden="true"]`)) return finish(false)
    if (current.getAttribute('role') === 'button' && current.getAttribute('aria-expanded') !== 'true') return finish(false)
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return finish(false)
  }
  return finish(true)
}

function path(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current) {
    let index = 1
    for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.localName === current.localName) index++
    }
    parts.unshift(`${current.localName}${current.id ? '#' + current.id : ''}:nth-of-type(${index})`)
    const root = current.getRootNode()
    if (!current.parentElement && root instanceof ShadowRoot) {
      parts.unshift('>>>')
      current = root.host
    } else current = current.parentElement
  }
  return parts.join(' ')
}

function describe(el: Element) {
  const root = el.getRootNode()
  return {
    path: path(el), tag: el.localName, class: el.getAttribute('class'),
    host: root instanceof ShadowRoot ? root.host.localName : null,
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }
}

async function discover(start: ParentNode = document) {
  const roots: ShadowRoot[] = []
  const walkers = [document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT)]
  let visited = 0, activeMs = 0, maxSliceMs = 0, yields = 0
  const started = performance.now()
  let index = 0
  if (start instanceof Element && start.shadowRoot) {
    roots.push(start.shadowRoot)
    walkers.push(document.createTreeWalker(start.shadowRoot, NodeFilter.SHOW_ELEMENT))
  }
  while (index < walkers.length) {
    const slice = performance.now()
    let work = 0
    while (index < walkers.length && work < 400 && performance.now() - slice < 4) {
      const el = walkers[index].nextNode() as Element | null
      if (!el) { index++; continue }
      work++; visited++
      if (el.shadowRoot && !el.matches(owned)) {
        roots.push(el.shadowRoot)
        walkers.push(document.createTreeWalker(el.shadowRoot, NodeFilter.SHOW_ELEMENT))
      }
    }
    const duration = performance.now() - slice
    activeMs += duration
    maxSliceMs = Math.max(maxSliceMs, duration)
    if (index < walkers.length) { yields++; await pause() }
  }
  return { roots, visited, activeMs: round(activeMs), maxSliceMs: round(maxSliceMs), yields, wallMs: round(performance.now() - started) }
}

function resetCaches(roots: Root[]) {
  // Deliberately outside timing: give each classifier run equally cold filter caches.
  for (const root of roots) for (const el of root.querySelectorAll('*')) invalidateContentFilterCache(el)
}

function cleanupWrappers(root: ParentNode, existing: Set<Element>) {
  for (const el of Array.from(root.querySelectorAll(`[${DIRECT_TEXT_TARGET_ATTR}]`)).reverse()) {
    if (!existing.has(el)) unwrapDirectTextTarget(el)
  }
}

function baseline(mode: Mode, onRoot?: (root: Element) => void) {
  const existing = new Set(document.querySelectorAll(`[${DIRECT_TEXT_TARGET_ATTR}]`))
  const start = performance.now()
  try {
    const result = resolveAutoTranslationTarget(mode)
    const ms = round(performance.now() - start)
    onRoot?.(result.contentRoot)
    return { ms, contentRoot: path(result.contentRoot), stats: result.stats, targets: result.nodes.map(describe) }
  } finally { cleanupWrappers(document, existing) }
}

async function scanShadow(roots: ShadowRoot[], mode: Mode, scopeRoot?: Element) {
  const targets: (ReturnType<typeof describe> & { withinExistingContentRoot?: boolean })[] = []
  const perRoot: object[] = []
  let activeMs = 0, maxRootMs = 0, eligibleRoots = 0, maxSliceMs = 0, yields = 0
  const boundaryCache = new WeakMap<Element, boolean>()
  const started = performance.now()
  let sliceStart = started
  for (const root of roots) {
    const start = performance.now()
    let nodes: Element[] = []
    let stats: ReturnType<typeof createScanContext>['stats'] | undefined
    if (root.host.isConnected && boundaryAllowed(root.host, boundaryCache) && hasOwnText(root)) {
      eligibleRoots++
      const scanContext = createScanContext()
      const grabOptions = {
        siteCompatMode: mode, scanContext,
        // Diagnostic scans must not move website text during MutationObserver measurements.
        enableDirectTextRunWrapper: false,
        ...(mode === 'smart' ? { contentFilter: getContentFilterDecision, contentUnitClassifier: classifyContentUnit } : {}),
      }
      nodes = collectTranslationTargets(root, {
        mode, scope: mode, contentRoot: root.host, grabOptions,
      }, { includeSupplemental: false }).map(d => d.target).filter(el => boundaryAllowed(el, boundaryCache))
      stats = scanContext.stats
    }
    const ms = performance.now() - start
    activeMs += ms
    maxRootMs = Math.max(maxRootMs, ms)
    // Serialization excluded from classifier CPU timing.
    targets.push(...nodes.map(node => ({ ...describe(node), ...(scopeRoot ? { withinExistingContentRoot: composedContains(scopeRoot, node) } : {}) })))
    if (nodes.length || ms >= 2) perRoot.push({ host: root.host.localName, path: path(root.host), count: nodes.length, ms: round(ms), stats })
    // Resume after a time slice, including serialization. Never discard remaining roots.
    const sliceMs = performance.now() - sliceStart
    maxSliceMs = Math.max(maxSliceMs, sliceMs)
    if (sliceMs >= 4) {
      yields++
      await pause()
      sliceStart = performance.now()
    }
  }
  return { activeMs: round(activeMs), maxRootMs: round(maxRootMs), maxSliceMs: round(maxSliceMs), yields, wallMs: round(performance.now() - started), eligibleRoots, targets, perRoot }
}

function composedContains(ancestor: Element, node: Element): boolean {
  for (let current: Element | null = node; current; current = composedParent(current)) if (current === ancestor) return true
  return false
}

function hasOwnText(root: ShadowRoot): boolean {
  // Discovery already visits nested roots independently. An empty layout root can
  // skip classification without hiding descendants from discovery.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element) return node.matches('script,style,template,noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })
  return Boolean(walker.nextNode())
}

async function run(mode: Mode = 'smart', runs = 3) {
  if (!['smart', 'full'].includes(mode) || runs < 1 || runs > 10) throw new Error('Invalid audit arguments')
  const rounds = []
  const longTasks: { start: number; duration: number }[] = []
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) longTasks.push({ start: round(entry.startTime), duration: round(entry.duration) })
  })
  observer.observe({ type: 'longtask' })
  try {
    for (let i = 0; i < runs; i++) {
      const discovery = await discover()
      resetCaches([document, ...discovery.roots])
      let contentRoot: Element = document.body
      const before = baseline(mode, root => { contentRoot = root })
      resetCaches([document, ...discovery.roots])
      const shadow = await scanShadow(discovery.roots, mode, contentRoot)
      resetCaches([document, ...discovery.roots])
      const after = baseline(mode)
      const signature = (rows: ReturnType<typeof describe>[]) => rows.map(r => `${r.path}\n${r.text}`).sort().join('\n')
      rounds.push({
        discovery: { ...discovery, roots: discovery.roots.length },
        baseline: before, shadow,
        baselineUnchanged: signature(before.targets) === signature(after.targets),
        baselineAfterMs: after.ms,
      })
      await pause()
    }
  } finally { observer.disconnect() }
  return { url: location.href, title: document.title, mode, date: new Date().toISOString(), userAgent: navigator.userAgent, rounds, longTasks }
}

async function compareProduction(mode: Mode = 'smart', runs = 10) {
  const roots = await discover()
  const timings = { disabled: [] as number[], enabled: [] as number[] }
  let disabledTargets = 0, enabledTargets = 0
  const measure = (enabled: boolean) => {
    resetCaches([document, ...roots.roots])
    const started = performance.now()
    const result = resolveAutoTranslationTarget(mode, { includeOpenShadowRoots: enabled })
    const elapsed = performance.now() - started
    timings[enabled ? 'enabled' : 'disabled'].push(elapsed)
    if (enabled) enabledTargets = result.nodes.length
    else disabledTargets = result.nodes.length
  }
  measure(false); measure(true)
  timings.disabled.length = 0; timings.enabled.length = 0
  for (let index = 0; index < runs; index++) {
    if (index % 2 === 0) { measure(false); measure(true) }
    else { measure(true); measure(false) }
    await pause()
  }
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return round((sorted[(sorted.length - 1) >> 1]! + sorted[sorted.length >> 1]!) / 2)
  }
  return {
    url: location.href, mode, runs, roots: roots.roots.length,
    disabledTargets, enabledTargets,
    disabledMedianMs: median(timings.disabled), enabledMedianMs: median(timings.enabled),
    deltaMedianMs: round(median(timings.enabled) - median(timings.disabled)),
    raw: { disabled: timings.disabled.map(round), enabled: timings.enabled.map(round) }
  }
}

let stopWatch: (() => Promise<object>) | undefined
async function watch(mode: Mode = 'smart') {
  if (stopWatch) await stopWatch()
  const initial = await discover()
  const before = await scanShadow(initial.roots, mode)
  const known = new Set(initial.roots)
  const dirty = new Set<ShadowRoot>()
  const added = new Set<Element>()
  const stats = { mutations: 0, callbacks: 0, callbackMs: 0, flushes: 0, scannedRoots: 0, newRoots: 0, discoveryMs: 0, scanMs: 0, maxRootMs: 0, maxCallbackMs: 0 }
  const targets = new Map<string, ReturnType<typeof describe>[]>()
  let timer: ReturnType<typeof setTimeout> | undefined, stopped = false
  let running: Promise<void> | undefined
  const schedule = () => {
    if (!timer && !running && !stopped) timer = setTimeout(() => { timer = undefined; running = flush().finally(() => { running = undefined; if (dirty.size || added.size) schedule() }) }, 150)
  }
  const observer = new MutationObserver(records => {
    const start = performance.now()
    stats.callbacks++; stats.mutations += records.length
    for (const record of records) {
      const el = record.target instanceof Element ? record.target : record.target.parentElement
      if (el?.closest(owned)) continue
      const root = record.target.getRootNode()
      if (root instanceof ShadowRoot) dirty.add(root)
      for (const node of record.addedNodes) if (node instanceof Element) added.add(node)
    }
    const ms = performance.now() - start
    stats.callbackMs += ms; stats.maxCallbackMs = Math.max(stats.maxCallbackMs, ms)
    schedule()
  })
  const observe = (root: Node) => {
    if (!stopped) observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'aria-expanded'] })
  }
  observe(document.body)
  for (const root of known) observe(root)
  async function flush() {
    stats.flushes++
    const newElements = [...added].filter(e => e.isConnected)
    added.clear()
    for (const el of newElements) {
      if (newElements.some(other => other !== el && other.contains(el))) continue
      const result = await discover(el)
      stats.discoveryMs += result.activeMs
      for (const root of result.roots) if (!known.has(root)) {
        known.add(root); observe(root); dirty.add(root); stats.newRoots++
      }
    }
    const work = [...dirty].filter(r => r.host.isConnected)
    dirty.clear()
    resetCaches(work)
    for (const root of work) {
      const result = await scanShadow([root], mode)
      stats.scannedRoots++; stats.scanMs += result.activeMs
      stats.maxRootMs = Math.max(stats.maxRootMs, result.maxRootMs)
      targets.set(path(root.host), result.targets)
    }
  }
  stopWatch = async () => {
    stopped = true
    observer.disconnect()
    if (timer) clearTimeout(timer)
    if (running) await running
    if (dirty.size || added.size) await flush()
    stopWatch = undefined
    const finalRoots = await discover()
    resetCaches(finalRoots.roots)
    const after = await scanShadow(finalRoots.roots, mode)
    const signature = (target: ReturnType<typeof describe>) => `${target.path}\n${target.text}`
    const beforeSet = new Set(before.targets.map(signature))
    const incrementalTargets = [...targets.values()].flat()
    const incrementalSet = new Set(incrementalTargets.map(signature))
    const expectedNew = after.targets.filter(target => !beforeSet.has(signature(target)))
    return {
      url: location.href, stats, observedRoots: known.size,
      connectedRoots: [...known].filter(root => root.host.isConnected).length,
      beforeTargets: before.targets.length, afterTargets: after.targets.length,
      expectedNew, missedNew: expectedNew.filter(target => !incrementalSet.has(signature(target))),
      targets: incrementalTargets,
    }
  }
  return { observedRoots: known.size, note: 'One observer; root-level coalescing prototype. Late attachShadow and slotchange discovery are not implemented.' }
}

Object.assign(window, { OnlyTranslateShadowAudit: { run, compareProduction, watch, stop: () => stopWatch?.(), discover } })
