import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createAppI18n } from '../../entrypoints/utils/i18n'
import type { PdfRenderedPage } from '../../entrypoints/pdf/readerController'
import type { PdfOutlineItem, PdfOutlineTarget } from '../../entrypoints/pdf/outline'
import PdfApp from '../../entrypoints/pdf/App.vue'

const mocks = vi.hoisted(() => ({
  uiLocale: 'zh-CN',
  getOutline: vi.fn(), resolveOutlineTarget: vi.fn(), renderPage: vi.fn(),
  findBookBySourceUrl: vi.fn(), saveProgress: vi.fn(),
}))
vi.mock('webextension-polyfill', () => ({ default: { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } } }))
vi.mock('@/composables/useConfig', () => ({ useConfig: () => ({ config: ref({ on: false, theme: 'light', uiLocale: mocks.uiLocale }), loadConfig: async () => {} }) }))
vi.mock('@/composables/useTheme', () => ({ useTheme: () => {} }))
vi.mock('@/entrypoints/utils/option', () => ({ isServiceConfigured: () => false }))
vi.mock('@/entrypoints/ebook/export', () => ({ downloadOriginalBook: vi.fn() }))
vi.mock('@/entrypoints/ebook/settings', () => ({
  loadReaderSettings: async () => ({ fontScale: 100, lineHeight: 1.7, displayMode: 'bilingual' }),
  saveReaderSettings: async () => {},
}))
vi.mock('@/entrypoints/ebook/repository', () => ({ EbookRepository: class {
  findBookBySourceUrl = mocks.findBookBySourceUrl
  saveProgress = mocks.saveProgress
  getProgress = async () => undefined
  markOpened = async () => {}
  close() {}
} }))
vi.mock('@/entrypoints/pdf/library', () => ({ addPdfToLibrary: vi.fn() }))
vi.mock('@/entrypoints/pdf/url', () => ({ getRequestedPdfBookId: () => undefined, getRequestedPdfSource: () => 'https://example.com/book.pdf' }))
vi.mock('@/entrypoints/pdf/layoutModelStore', () => ({
  PDF_LAYOUT_MODEL: { size: 23000000 }, pdfLayoutModelStore: { getStatus: async () => ({ installed: false }), close() {} },
}))
vi.mock('@/entrypoints/pdf/translationCoordinator', () => ({ PdfTranslationCoordinator: class { cancel() {} } }))
vi.mock('@/entrypoints/pdf/readerController', () => ({
  PdfSourceError: class extends Error {},
  downloadRemotePdf: vi.fn(),
  PdfReaderController: class {
    openRemote = async () => 3
    openFile = async () => 3
    getOutline = mocks.getOutline
    resolveOutlineTarget = mocks.resolveOutlineTarget
    renderPage = mocks.renderPage
    extractPage = async () => ({ blocks: [] })
    renderThumbnail = async () => 'data:image/png;base64,'
    close() {}
  },
}))

const items: PdfOutlineItem[] = [
  { id: '0', title: 'Section A', dest: 'a', items: [] },
  { id: '1', title: 'Section B', dest: 'b', items: [] },
]
function rendered(pageNumber: number): PdfRenderedPage {
  return {
    pageNumber, pageCount: 3, width: 600, height: 800, layoutMode: 'heuristic',
    blocks: [200, 600].map((y, index) => ({
      id: `page-${pageNumber}-${index}`, text: 'This paragraph has enough readable prose to appear in the bilingual reading flow.',
      x: 60, y, width: 400, height: 80, kind: 'body', column: 'full', translatable: true,
    })),
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
let wrapper: VueWrapper | undefined
let scrollIntoView: ReturnType<typeof vi.fn>
async function openApp(locale: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<VueWrapper> {
  mocks.uiLocale = locale
  wrapper = mount(PdfApp, { global: { plugins: [createAppI18n(locale)] } })
  await flushPromises()
  return wrapper
}
async function clickSection(app: VueWrapper, index: number): Promise<void> {
  await app.findAll('.pdf-outline__title')[index].trigger('click')
  await flushPromises()
}
async function openAnotherFile(app: VueWrapper): Promise<void> {
  const input = app.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['%PDF-'], 'another.pdf', { type: 'application/pdf' })] })
  await input.trigger('change')
  await flushPromises()
}

describe('PDF reader outline navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOutline.mockReset().mockResolvedValue(items)
    mocks.resolveOutlineTarget.mockReset().mockImplementation(async (entry: PdfOutlineItem) => ({ pageNumber: 2, x: 0.1, y: entry.id === '0' ? 0.25 : 0.75 }))
    mocks.renderPage.mockReset().mockImplementation(async (page: number) => rendered(page))
    mocks.findBookBySourceUrl.mockReset().mockResolvedValue(undefined)
    scrollIntoView = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
  })

  it('defaults to contents and navigates to different sections on the same page without rendering again', async () => {
    const app = await openApp()
    expect(app.get('.pdf-navigation__switch button[aria-pressed="true"]').text()).toBe('目录')
    await clickSection(app, 0)
    expect(app.get('.reader-title span').text()).toBe('第 2 / 3 页')
    expect(app.get('.pdf-original-panel').element.scrollTop).toBe(200)
    expect(app.get('.pdf-block--active').attributes('data-reading-block-id')).toBe('page-2-0')
    const renders = mocks.renderPage.mock.calls.length
    await clickSection(app, 1)
    expect(mocks.renderPage).toHaveBeenCalledTimes(renders)
    expect(app.get('.pdf-original-panel').element.scrollTop).toBe(600)
    expect(app.get('.pdf-block--active').attributes('data-reading-block-id')).toBe('page-2-1')
    expect(app.get('[aria-current="location"]').text()).toBe('Section B')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('keeps the same sidebar width when switching between Contents and Pages', async () => {
    const app = await openApp('en-US')
    const width = () => (app.get('.pdf-shell').element as HTMLElement).style.getPropertyValue('--pdf-navigation-width')
    expect(width()).toBe('280px')
    const tabs = app.findAll('.pdf-navigation__switch button')
    expect(tabs.map(tab => tab.text())).toEqual(['Contents', 'Pages'])
    await tabs[1].trigger('click')
    expect(width()).toBe('280px')
    expect(app.get('.pdf-navigation__switch button[aria-pressed="true"]').text()).toBe('Pages')
    await tabs[0].trigger('click')
    expect(width()).toBe('280px')
  })

  it('uses the latest selection when destination lookups complete out of order', async () => {
    const old = deferred<PdfOutlineTarget>()
    mocks.resolveOutlineTarget.mockImplementation((entry: PdfOutlineItem) => entry.id === '0'
      ? old.promise : Promise.resolve({ pageNumber: 3, x: 0.1, y: 0.75 }))
    const app = await openApp()
    await clickSection(app, 0)
    await clickSection(app, 1)
    old.resolve({ pageNumber: 2, x: 0.1, y: 0.25 })
    await flushPromises()
    expect(app.get('.reader-title span').text()).toBe('第 3 / 3 页')
    expect(app.get('[aria-current="location"]').text()).toBe('Section B')
    expect(mocks.renderPage.mock.calls.map(call => call[0])).toEqual([1, 3])
  })

  it('waits for an active canvas render and applies the last click afterward', async () => {
    const inFlight = deferred<PdfRenderedPage>()
    mocks.renderPage.mockImplementation((page: number) => page === 2 ? inFlight.promise : Promise.resolve(rendered(page)))
    mocks.resolveOutlineTarget.mockImplementation(async (entry: PdfOutlineItem) => ({ pageNumber: entry.id === '0' ? 2 : 3, x: 0.1, y: 0.25 }))
    const app = await openApp()
    await clickSection(app, 0)
    await clickSection(app, 1)
    expect(mocks.renderPage.mock.calls.map(call => call[0])).toEqual([1, 2])
    inFlight.resolve(rendered(2))
    await flushPromises()
    expect(mocks.renderPage.mock.calls.map(call => call[0])).toEqual([1, 2, 3])
    expect(app.get('.reader-title span').text()).toBe('第 3 / 3 页')
    expect(app.get('[aria-current="location"]').text()).toBe('Section B')
  })

  it.each(['empty', 'failed'])('keeps page navigation working when the outline is %s', async (state) => {
    if (state === 'empty') mocks.getOutline.mockResolvedValue([])
    else mocks.getOutline.mockRejectedValue(new Error('broken outline'))
    const app = await openApp()
    expect(app.get('.pdf-navigation__switch button[aria-pressed="true"]').text()).toBe('页面')
    await app.get('[data-thumbnail-page="2"]').trigger('click')
    await flushPromises()
    expect(app.get('.reader-title span').text()).toBe('第 2 / 3 页')
    await app.findAll('.pdf-navigation__switch button')[0].trigger('click')
    expect(app.get('.pdf-navigation__notice').text()).toContain(state === 'empty' ? '没有内嵌目录' : '无法读取目录')
  })

  it('reports a broken entry without blocking subsequent navigation', async () => {
    mocks.resolveOutlineTarget.mockResolvedValueOnce(undefined)
    const app = await openApp()
    await clickSection(app, 0)
    expect(app.get('.reader-title span').text()).toBe('第 1 / 3 页')
    expect(app.get('.pdf-outline-panel [role="status"]').text()).toContain('无法定位')
    await clickSection(app, 1)
    expect(app.get('[aria-current="location"]').text()).toBe('Section B')
    expect(app.find('.pdf-outline-panel [role="status"]').exists()).toBe(false)
  })

  it('keeps the selected section in bilingual, translation-only and original modes', async () => {
    const app = await openApp()
    await clickSection(app, 1)
    for (const index of [1, 2, 0]) {
      await app.findAll('.pdf-display-switch button')[index].trigger('click')
      await flushPromises()
      expect(app.get('.reader-title span').text()).toBe('第 2 / 3 页')
      expect(app.get('.pdf-original-panel').element.scrollTop).toBe(600)
      expect(app.get('[aria-current="location"]').text()).toBe('Section B')
    }
  })

  it('does not override a navigation tab chosen while the directory is loading', async () => {
    const loading = deferred<PdfOutlineItem[]>()
    mocks.getOutline.mockReturnValue(loading.promise)
    const app = await openApp()
    await app.findAll('.pdf-navigation__switch button')[1].trigger('click')
    loading.resolve(items)
    await flushPromises()
    expect(app.get('.pdf-navigation__switch button[aria-pressed="true"]').text()).toBe('页面')
  })

  it('saves the destination page as the reading progress for a stored PDF', async () => {
    mocks.findBookBySourceUrl.mockResolvedValue({
      bookId: 'stored', format: 'pdf', title: 'Stored PDF', filename: 'stored.pdf',
      fileBlob: new Blob(['%PDF-'], { type: 'application/pdf' }),
    })
    const app = await openApp()
    mocks.saveProgress.mockClear()
    await clickSection(app, 0)
    expect(mocks.saveProgress).toHaveBeenCalledWith(expect.objectContaining({ bookId: 'stored', pageNumber: 2, percentage: 0.5 }))
  })

  it('closes compact navigation after selecting a section', async () => {
    const app = await openApp()
    await app.get('.pdf-navigation-toggle').trigger('click')
    expect(app.get('.pdf-shell').attributes('data-navigation-open')).toBe('true')
    await clickSection(app, 0)
    expect(app.get('.pdf-shell').attributes('data-navigation-open')).toBe('false')
  })

  it('reserves the wider directory sidebar when resizing the original pane', async () => {
    const app = await openApp()
    await app.get('.pdf-original-toggle').trigger('click')
    await flushPromises()
    Object.defineProperty(app.get('.pdf-workspace').element, 'clientWidth', { configurable: true, value: 1680 })
    Object.defineProperty(app.get('.pdf-navigation').element, 'offsetWidth', { configurable: true, value: 280 })
    Object.defineProperty(app.get('.pdf-original-panel').element, 'clientWidth', { configurable: true, value: 1100 })
    await app.get('.pdf-pane-resizer').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect((app.get('.pdf-shell').element as HTMLElement).style.getPropertyValue('--pdf-original-panel-width')).toBe('1032px')
  })

  it('discards the previous document directory and destination results after opening another file', async () => {
    const lookup = deferred<PdfOutlineTarget>()
    mocks.resolveOutlineTarget.mockReturnValue(lookup.promise)
    const app = await openApp()
    await clickSection(app, 0)
    mocks.getOutline.mockResolvedValue([{ ...items[0], title: 'New document' }])
    await openAnotherFile(app)
    lookup.resolve({ pageNumber: 3, x: 0.1, y: 0.25 })
    await flushPromises()
    expect(app.get('.pdf-outline__title').text()).toBe('New document')
    expect(app.get('.reader-title span').text()).toBe('第 1 / 3 页')
    expect(app.find('[aria-current="location"]').exists()).toBe(false)
  })

  it('discards an old directory response after switching files', async () => {
    const old = deferred<PdfOutlineItem[]>()
    mocks.getOutline.mockReturnValueOnce(old.promise)
    const app = await openApp()
    mocks.getOutline.mockResolvedValue([{ ...items[0], title: 'New document' }])
    await openAnotherFile(app)
    old.resolve(items)
    await flushPromises()
    expect(app.get('.pdf-outline__title').text()).toBe('New document')
  })
})
