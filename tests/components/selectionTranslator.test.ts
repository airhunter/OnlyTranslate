import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import SelectionTranslator from '@/components/SelectionTranslator.vue'

const mockTranslateText = vi.hoisted(() => vi.fn())
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
  token: {},
  model: {},
  customModel: {},
  customProviders: [],
  useCache: true,
  ttsEngine: 'system',
  ttsVoice: {}
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: { setItem: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('@/entrypoints/utils/ttsClient', () => ({
  speakText: vi.fn().mockResolvedValue({ engine: 'system', fallback: false }),
  stopTts: vi.fn()
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
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

  const setSelection = async (text: string) => {
    currentSelection = {
      rangeCount: text ? 1 : 0,
      toString: () => text,
      getRangeAt: () => ({}) as Range
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

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    document.title = 'Selection test page'
    currentSelection = null
    pendingTranslations = []
    mockTranslateText.mockReset()
    mockComputePosition.mockClear()
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
