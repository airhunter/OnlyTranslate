// Independent of the smart recognizer: every source text node is indexed before collection.
export function installCatalogue() {
  if (window.__readingReview) return window.__readingReview.catalogue
  const refs = new WeakMap(), elements = new Map(), texts = [], blocks = new Map()
  let elementNumber = 0
  document.querySelectorAll('body, body *').forEach(element => {
    if (!element.hasAttribute('data-ot-review-node')) element.setAttribute('data-ot-review-node', 'e' + elementNumber)
    elementNumber++
    elements.set(element.getAttribute('data-ot-review-node'), element)
  })
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\s+/g, ' ').trim(), parent = node.parentElement
    if (!text || !parent || parent.closest('script, style, noscript, template, svg')) continue
    const id = 't' + texts.length
    refs.set(node, id)
    texts.push({ id, text })
    const element = parent.closest('p, li, blockquote, figcaption, dd, dt, h1, h2, h3, h4, h5, h6, button, a, label, strong, aside, header, div, section, article, body') || parent
    const blockId = element.getAttribute('data-ot-review-node')
    if (!blocks.has(blockId)) {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      blocks.set(blockId, { id: blockId, tag: element.localName, text: '', textIds: [], visible: Boolean(rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none'), x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height })
    }
    const block = blocks.get(blockId)
    block.text += (block.text ? ' ' : '') + text
    block.textIds.push(id)
  }
  const catalogue = { texts, blocks: [...blocks.values()] }
  window.__readingReview = { refs, elements, catalogue }
  return catalogue
}
