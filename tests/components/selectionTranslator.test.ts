import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import SelectionTranslator from '@/components/SelectionTranslator.vue'

const mockTranslateText = vi.hoisted(() => vi.fn())
const mockAnalyzeSelectionText = vi.hoisted(() => vi.fn())
const mockComputePosition = vi.hoisted(() => vi.fn().mockResolvedValue({
  x: 12,
  y: 24,
  placement: 'right',
  middlewareData: {
    hide: { referenceHidden: false }
  }
}))
const mockAutoUpdate = vi.hoisted(() => vi.fn((_: unknown, __: unknown, update: () => void) => {
  void update()
  return vi.fn()
}))
const mockConfig = vi.hoisted(() => ({
  animations: false,
  selectionTranslatorMode: 'bilingual',
  theme: 'light',
  service: 'google',
  token: { openai: 'token' },
  model: { openai: 'gpt-5-mini' },
  customModel: {},
  customProviders: [],
  useCache: true,
  ttsEngine: 'system',
  ttsVoice: {},
  ttsVoiceGender: 'auto',
  to: 'zh-Hans',
  bidirectionalTranslation: false,
  bidirectionalTarget: 'en'
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: { setItem: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('@/entrypoints/utils/ttsClient', () => ({
  speakText: vi.fn().mockResolvedValue({ engine: 'system', fallback: false }),
  stopTts: vi.fn()
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  analyzeSelectionText: mockAnalyzeSelectionText,
  isTranslationCancelledError: (error: unknown) => (
    typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'TranslationCancelledError'
  ),
  translateText: mockTranslateText
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@floating-ui/dom', () => ({
  autoPlacement: vi.fn(() => ({})),
  autoUpdate: mockAutoUpdate,
  computePosition: mockComputePosition,
  flip: vi.fn(() => ({})),
  hide: vi.fn(() => ({})),
  inline: vi.fn(() => ({})),
  offset: vi.fn(() => ({})),
  shift: vi.fn(() => ({}))
}))

interface PendingTranslation {
  text: string
  signal: AbortSignal
  useCache?: boolean
  resolve: (value: string) => void
}

describe('SelectionTranslator', () => {
  let wrapper: VueWrapper | null = null
  let currentSelection: Selection | null = null
  let getSelectionSpy: ReturnType<typeof vi.spyOn>
  let pendingTranslations: PendingTranslation[] = []
  let writeClipboard: ReturnType<typeof vi.fn>

  const setSelection = async (text: string, range = {} as Range) => {
    currentSelection = {
      rangeCount: text ? 1 : 0,
      toString: () => text,
      getRangeAt: () => range
    } as unknown as Selection

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()
    await flushPromises()
  }

  const openTooltip = async () => {
    const translateButton = document.querySelector<HTMLElement>('.fr-toolbar-btn--primary')
    expect(translateButton).not.toBeNull()
    translateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()
  }

  const openAnalysis = async () => {
    const analysisButton = document.querySelector<HTMLElement>('button[title="selection.analyze"]')
    expect(analysisButton).not.toBeNull()
    analysisButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    document.title = 'Selection test page'
    currentSelection = null
    pendingTranslations = []
    mockConfig.service = 'google'
    mockConfig.to = 'zh-Hans'
    mockConfig.bidirectionalTranslation = false
    mockConfig.bidirectionalTarget = 'en'
    mockTranslateText.mockReset()
    mockAnalyzeSelectionText.mockReset()
    mockAnalyzeSelectionText.mockResolvedValue({
      kind: 'term',
      term: 'ephemeral',
      pronunciation: '/ɪˈfem.ər.əl/',
      partOfSpeech: 'adjective',
      definition: '短暂的',
      contextualMeaning: '在语境中指持续时间很短',
      example: 'ephemeral beauty',
      difficulty: 'C1',
      translation: '',
      overview: '',
      structure: '',
      grammarPoints: [],
      expressions: [],
      notes: [],
      summary: '',
    })
    mockComputePosition.mockReset()
    mockComputePosition.mockResolvedValue({
      x: 12,
      y: 24,
      placement: 'right',
      middlewareData: {
        hide: { referenceHidden: false }
      }
    })
    mockAutoUpdate.mockClear()
    mockTranslateText.mockImplementation((text: string, _: string, options: { signal: AbortSignal; useCache?: boolean }) => (
      new Promise<string>(resolve => {
        pendingTranslations.push({ text, signal: options.signal, useCache: options.useCache, resolve })
      })
    ))
    writeClipboard = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeClipboard }
    })
    getSelectionSpy = vi.spyOn(window, 'getSelection').mockImplementation(() => currentSelection)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })

    wrapper = mount(SelectionTranslator, {
      attachTo: document.body
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    getSelectionSpy.mockRestore()
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('aborts the previous selection and ignores its late result', async () => {
    await setSelection('first selection')
    await openTooltip()

    expect(pendingTranslations).toHaveLength(1)
    expect(pendingTranslations[0].text).toBe('first selection')

    await setSelection('second selection')

    expect(pendingTranslations).toHaveLength(1)
    expect(pendingTranslations[0].signal.aborted).toBe(true)
    await openTooltip()

    expect(pendingTranslations).toHaveLength(2)
    expect(pendingTranslations[1].text).toBe('second selection')

    pendingTranslations[1].resolve('第二个译文')
    await flushPromises()
    expect(document.querySelector('.fr-translation-text')?.textContent).toBe('第二个译文')

    pendingTranslations[0].resolve('迟到的第一个译文')
    await flushPromises()
    expect(document.querySelector('.fr-translation-text')?.textContent).toBe('第二个译文')
  })

  it('aborts the active request when the tooltip is closed', async () => {
    await setSelection('close request')
    await openTooltip()

    const request = pendingTranslations[0]
    expect(request.signal.aborted).toBe(false)

    document.querySelector<HTMLElement>('.fr-close-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(request.signal.aborted).toBe(true)
    expect(document.querySelector('.fr-translation-panel')).toBeNull()
  })

  it('aborts the active request when the component is unmounted', async () => {
    await setSelection('unmount request')
    await openTooltip()

    const request = pendingTranslations[0]
    wrapper?.unmount()
    wrapper = null

    expect(request.signal.aborted).toBe(true)
  })

  it('keeps the existing selection length boundaries', async () => {
    await setSelection('a')
    expect(document.querySelector('.fr-selection-toolbar')).toBeNull()

    await setSelection('ab')
    expect(document.querySelector('.fr-selection-toolbar')).not.toBeNull()

    const pageTarget = document.createElement('div')
    document.body.appendChild(pageTarget)
    pageTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    await setSelection('a'.repeat(4097))
    expect(document.querySelector('.fr-selection-toolbar')).toBeNull()
  })

  it('suppresses address-like links but keeps natural-language link titles', async () => {
    const addressLink = document.createElement('a')
    addressLink.href = '/from?site=example.com'
    addressLink.textContent = 'example.com'
    document.body.appendChild(addressLink)
    const addressRange = document.createRange()
    addressRange.selectNodeContents(addressLink)

    await setSelection('example.com', addressRange)
    expect(document.querySelector('.fr-selection-toolbar')).toBeNull()

    const titleLink = document.createElement('a')
    titleLink.href = 'https://example.com/article'
    titleLink.textContent = 'A natural-language article title'
    document.body.appendChild(titleLink)
    const titleRange = document.createRange()
    titleRange.selectNodeContents(titleLink)

    await setSelection('A natural-language article title', titleRange)
    expect(document.querySelector('.fr-selection-toolbar')).not.toBeNull()
  })

  it('suppresses reliable target-language selections in fixed target mode', async () => {
    await setSelection('这段内容已经是目标语言')

    expect(document.querySelector('.fr-selection-toolbar')).toBeNull()
  })

  it('keeps target-language selections available for bidirectional translation', async () => {
    mockConfig.bidirectionalTranslation = true

    await setSelection('这段内容需要反向翻译')

    expect(document.querySelector('.fr-selection-toolbar')).not.toBeNull()
  })

  it('copies the original and translation independently', async () => {
    await setSelection('copy source')
    await openTooltip()
    pendingTranslations[0].resolve('复制译文')
    await flushPromises()

    document.querySelector<HTMLElement>('button[title="selection.copyOriginal"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(writeClipboard).toHaveBeenLastCalledWith('copy source')

    document.querySelector<HTMLElement>('button[title="selection.copyTranslation"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(writeClipboard).toHaveBeenLastCalledWith('复制译文')
  })

  it('uses the product logo and only exposes the translation service selector', async () => {
    await setSelection('toolbar controls')

    expect(document.querySelector('.fr-toolbar-btn--primary .fr-product-logo')).not.toBeNull()

    await openTooltip()
    expect(document.querySelectorAll('.fr-panel-footer select')).toHaveLength(1)
    expect(document.querySelector('[title="selection.model"]')).toBeNull()
  })

  it('opens adaptive analysis with a configured AI service and renders its result', async () => {
    await setSelection('ephemeral')
    await openAnalysis()

    expect(mockAnalyzeSelectionText).toHaveBeenCalledWith(expect.objectContaining({
      text: 'ephemeral',
      pageTitle: 'Selection test page',
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(document.querySelector('.fr-analysis-term-heading')?.textContent).toContain('ephemeral')
    expect(document.querySelector('.fr-analysis-result')?.textContent).toContain('短暂的')
    expect(mockConfig.service).toBe('openai')
  })

  it('returns to the toolbar without discarding the completed translation', async () => {
    await setSelection('return to toolbar')
    await openTooltip()
    pendingTranslations[0].resolve('保留的译文')
    await flushPromises()

    document.querySelector<HTMLElement>('button[title="selection.backToToolbar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(document.querySelector('.fr-translation-panel')).toBeNull()
    expect(document.querySelector('.fr-selection-toolbar')).not.toBeNull()

    await openTooltip()

    expect(pendingTranslations).toHaveLength(1)
    expect(document.querySelector('.fr-translation-text')?.textContent).toBe('保留的译文')
  })

  it('switches between translation and analysis without repeating completed requests', async () => {
    await setSelection('linked translation and analysis')
    await openTooltip()
    pendingTranslations[0].resolve('关联的翻译结果')
    await flushPromises()

    document.querySelector<HTMLElement>('.fr-panel-tab[data-mode="analysis"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()

    expect(mockAnalyzeSelectionText).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.fr-analysis-result')?.textContent).toContain('短暂的')
    expect(mockConfig.service).toBe('openai')

    document.querySelector<HTMLElement>('.fr-panel-tab[data-mode="translation"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()

    expect(document.querySelector('.fr-translation-text')?.textContent).toBe('关联的翻译结果')
    expect(pendingTranslations).toHaveLength(1)
    expect(mockConfig.service).toBe('google')

    document.querySelector<HTMLElement>('.fr-panel-tab[data-mode="analysis"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()

    expect(mockAnalyzeSelectionText).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.fr-analysis-result')?.textContent).toContain('短暂的')
  })

  it('cancels an unfinished request when switching result modes', async () => {
    await setSelection('switch pending request')
    await openTooltip()

    const request = pendingTranslations[0]
    document.querySelector<HTMLElement>('.fr-panel-tab[data-mode="analysis"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await flushPromises()

    expect(request.signal.aborted).toBe(true)
    expect(document.querySelector('.fr-analysis-result')?.textContent).toContain('短暂的')

    request.resolve('不应覆盖解析界面的迟到译文')
    await flushPromises()

    expect(document.querySelector('.fr-analysis-result')?.textContent).toContain('短暂的')
    expect(document.querySelector('.fr-translation-text')).toBeNull()
  })

  it('keeps an oversized panel origin inside the viewport', async () => {
    await setSelection('viewport constrained selection')
    mockComputePosition.mockResolvedValue({
      x: -180,
      y: -240,
      placement: 'top',
      middlewareData: {
        hide: { referenceHidden: false }
      }
    })

    await openAnalysis()

    const container = document.querySelector<HTMLElement>('.fr-selection-translator-wrapper')
    expect(container?.style.left).toBe('12px')
    expect(container?.style.top).toBe('12px')
  })

  it('drags the panel by its header and resets manual positioning for a new selection', async () => {
    await setSelection('draggable selection')
    await openAnalysis()

    const container = document.querySelector<HTMLElement>('.fr-selection-translator-wrapper')
    const header = document.querySelector<HTMLElement>('.fr-panel-header')
    expect(container).not.toBeNull()
    expect(header).not.toBeNull()
    vi.spyOn(container!, 'getBoundingClientRect').mockImplementation(() => new DOMRect(
      Number.parseFloat(container?.style.left || '12'),
      Number.parseFloat(container?.style.top || '24'),
      430,
      360,
    ))

    header?.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    }))
    header?.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    }))
    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 300,
      clientY: 250,
    }))
    await nextTick()

    expect(container?.style.left).toBe('212px')
    expect(container?.style.top).toBe('174px')
    expect(container?.classList.contains('fr-is-dragging')).toBe(true)

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }))
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await nextTick()

    expect(container?.style.left).toBe('12px')
    expect(container?.style.top).toBe('12px')
    expect(container?.classList.contains('fr-is-dragging')).toBe(false)
    expect(document.querySelector('.fr-translation-panel')).not.toBeNull()

    await setSelection('new automatic selection')
    expect(container?.style.left).toBe('12px')
    expect(container?.style.top).toBe('24px')
  })

  it('keeps the panel open when selecting text inside it', async () => {
    await setSelection('page selection')
    await openTooltip()
    pendingTranslations[0].resolve('panel translation')
    await flushPromises()

    const internalText = document.querySelector<HTMLElement>('.fr-translation-text')
    expect(internalText).not.toBeNull()
    currentSelection = {
      rangeCount: 1,
      toString: () => 'panel translation',
      getRangeAt: () => ({}) as Range,
      anchorNode: internalText?.firstChild ?? null,
      focusNode: internalText?.firstChild ?? null,
    } as unknown as Selection

    internalText?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    internalText?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    expect(mockTranslateText).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.fr-translation-panel')).not.toBeNull()
  })

  it('bypasses the cache when translating again', async () => {
    await setSelection('regenerate source')
    await openTooltip()
    pendingTranslations[0].resolve('first result')
    await flushPromises()

    document.querySelector<HTMLElement>('.fr-regenerate-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(pendingTranslations).toHaveLength(2)
    expect(pendingTranslations[1].useCache).toBe(false)
  })
})
