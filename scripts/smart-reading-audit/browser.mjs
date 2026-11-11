export async function capture(page, sample, screenshot) {
  const styleResponses = new Map()
  const onResponse = response => {
    if (response.request().resourceType() !== 'stylesheet' || !response.ok()) return
    styleResponses.set(response.url(), response.text().then(body => ({
      url: response.url(),
      type: response.headers()['content-type'] || 'text/css',
      body
    })).catch(() => null))
  }
  const settle = async () => {
    let last = ''
    let stable = 0
    for (let attempt = 0; attempt < 20; attempt++) {
      const current = await page.evaluate(() => JSON.stringify([
        document.body.innerText.length,
        document.documentElement.scrollHeight,
        document.querySelectorAll('.topic-post').length
      ]))
      stable = current === last ? stable + 1 : 0
      if (stable === 3) return
      last = current
      await page.waitForTimeout(400)
    }
    throw new Error(`Page did not settle: ${page.url()}`)
  }
  const inspect = () => page.evaluate(probes => {
    const text = document.body.innerText.replace(/\s+/g, ' ')
    return {
      scrollY: window.scrollY,
      posts: Array.from(document.querySelectorAll('.topic-post .cooked'), post =>
        post.closest('.topic-post')?.id || post.closest('article')?.id || ''),
      cloakedPosts: Array.from(document.querySelectorAll('.post-stream--cloaked'), post => post.id),
      probes: probes.map(probe => ({ text: probe, inVisibleText: text.includes(probe) }))
    }
  }, sample.probes)
  const saveState = async () => ({ ...await inspect(), html: await page.content() })

  page.on('response', onResponse)
  try {
    const response = await page.goto(sample.url, { waitUntil: sample.corpus ? 'domcontentloaded' : 'load', timeout: sample.corpus ? 17000 : 40000 })
    if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status()}: ${sample.url}`)
    await page.locator(sample.ready).first().waitFor({ state: 'visible', timeout: 20000 })
    await settle()
    const initial = sample.focus ? await saveState() : undefined

    // Scroll progressively so intersection-driven content can load along the way.
    let bottom = false
    for (let step = 0; step < 80; step++) {
      bottom = await page.evaluate(scrollToEnd => {
        const root = document.scrollingElement
        if (!root) return true
        if (root.scrollTop + innerHeight >= root.scrollHeight - 2) return true
        window.scrollBy({ top: scrollToEnd ? root.scrollHeight : innerHeight * 0.85, behavior: 'instant' })
        return false
      }, Boolean(sample.scrollToEnd))
      if (bottom) break
      await page.waitForTimeout(140)
    }
    if (!bottom) throw new Error(`Scroll did not reach the bottom: ${page.url()}`)
    await settle()
    let focused
    if (sample.focus) {
      await page.locator(sample.focus.anchor).scrollIntoViewIfNeeded({ timeout: 10000 })
      await page.locator(sample.focus.content).first().waitFor({ state: 'visible', timeout: 10000 })
      await settle()
      focused = await saveState()
      await page.screenshot({
        path: screenshot.replace(/-full\.png$/, '-focused-full.png'),
        fullPage: true,
        animations: 'disabled',
        timeout: 20000
      })
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await settle()
    const html = await page.content()
    const final = await inspect()
    const stylesheets = (await Promise.all(styleResponses.values())).filter(Boolean)
    const url = page.url()
    const viewport = page.viewportSize()
    if (screenshot) await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled', timeout: 20000 })
    return { url, viewport, html, stylesheets, initial, focused, final }
  } finally {
    page.off('response', onResponse)
  }
}

export async function replay(page, snapshot, bundle, probes, enabled) {
  const assets = new Map(snapshot.stylesheets.map(asset => [asset.url, asset]))
  const documentUrl = new URL(snapshot.url)
  documentUrl.hash = ''
  await page.route('**/*', async route => {
    const request = route.request()
    const url = request.url()
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && url === documentUrl.href) {
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': "script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'" },
        body: snapshot.html
      })
      return
    }
    const asset = request.resourceType() === 'stylesheet' && assets.get(url)
    if (asset) await route.fulfill({ contentType: asset.type, body: asset.body })
    else await route.abort()
  })
  if (snapshot.viewport) await page.setViewportSize(snapshot.viewport)
  const response = await page.goto(snapshot.url, { waitUntil: 'load', timeout: 20000 })
  if (!response?.ok()) throw new Error(`Snapshot replay failed: ${snapshot.url}`)
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), snapshot.scrollY)
  await page.evaluate(bundle)
  return page.evaluate(({ enabled, probes }) => window.onlyTranslateSmartReadingAudit(enabled, probes), { enabled, probes })
}
