import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { ContentScriptContext } from 'wxt/utils/content-script-context'

const mockTranslateText = vi.hoisted(() => vi.fn())
const mockConfig = vi.hoisted(() => ({
  animations: false,
  disableSelectionTranslator: false,
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

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    setItem: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/entrypoints/utils/translateApi', () => ({
  isTranslationCancelledError: vi.fn(() => false),
  translateText: mockTranslateText
}))

vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/entrypoints/utils/ttsClient', () => ({
  speakText: vi.fn().mockResolvedValue({ engine: 'system', fallback: false }),
  stopTts: vi.fn()
}))

vi.mock('@/components/SelectionTranslator.css?inline', () => ({
  default: '.fr-selection-translator-wrapper { position: fixed; }'
}))

vi.mock('@floating-ui/dom', () => ({
  autoPlacement: vi.fn(() => ({})),
  autoUpdate: vi.fn((_: unknown, __: unknown, update: () => void) => {
    void update()
    return vi.fn()
  }),
  computePosition: vi.fn().mockResolvedValue({
    x: 12,
    y: 24,
    placement: 'right',
    middlewareData: {
      hide: { referenceHidden: false }
    }
  }),
  flip: vi.fn(() => ({})),
  hide: vi.fn(() => ({})),
  inline: vi.fn(() => ({})),
  offset: vi.fn(() => ({})),
  shift: vi.fn(() => ({}))
}))

import {
  initializeSelectionTranslator,
  mountSelectionTranslator,
  unmountSelectionTranslator
} from '@/entrypoints/utils/selectionTranslator'

describe('selection translator Shadow DOM mounting', () => {
  let getSelectionSpy: ReturnType<typeof vi.spyOn> | null = null
  const context = {
    options: {
      cssInjectionMode: 'manifest'
    },
    onInvalidated: vi.fn()
  } as unknown as ContentScriptContext

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    mockConfig.disableSelectionTranslator = false
    mockConfig.selectionTranslatorMode = 'bilingual'
    getSelectionSpy = null
    mockTranslateText.mockReset()
    mockTranslateText.mockResolvedValue('译文')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })
    initializeSelectionTranslator(context)
  })

  afterEach(() => {
    unmountSelectionTranslator()
    getSelectionSpy?.mockRestore()
    vi.clearAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('mounts the complete selection UI and its styles inside one shadow root', async () => {
    await mountSelectionTranslator()

    const host = document.getElementById('only-translate-selection-translator-container')
    const shadow = host?.shadowRoot

    expect(host).not.toBeNull()
    expect(host?.classList.contains('notranslate')).toBe(true)
    expect(host?.getAttribute('translate')).toBe('no')
    expect(shadow).not.toBeNull()
    expect(shadow?.querySelector('.fr-selection-translator-wrapper')).not.toBeNull()
    expect(shadow?.textContent).toContain('.fr-selection-translator-wrapper')
    expect(document.body.querySelector('.fr-selection-translator-wrapper')).toBeNull()
  })

  it('removes the shadow host on disable and can mount it again', async () => {
    await mountSelectionTranslator()
    const firstHost = document.getElementById('only-translate-selection-translator-container')

    unmountSelectionTranslator()
    expect(document.getElementById('only-translate-selection-translator-container')).toBeNull()

    await mountSelectionTranslator()
    const remountedHost = document.getElementById('only-translate-selection-translator-container')

    expect(remountedHost).toBe(firstHost)
    expect(remountedHost?.shadowRoot?.querySelector('.fr-selection-translator-wrapper')).not.toBeNull()
  })

  it('keeps composed pointer events inside the shadow UI from restarting or closing translation', async () => {
    const selection = {
      rangeCount: 1,
      toString: () => 'selected text',
      getRangeAt: () => ({}) as Range
    } as unknown as Selection
    getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(selection)

    await mountSelectionTranslator()
    const shadow = document
      .getElementById('only-translate-selection-translator-container')
      ?.shadowRoot

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    shadow?.querySelector<HTMLElement>('.fr-toolbar-btn--primary')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    await nextTick()
    await flushPromises()

    expect(mockTranslateText).toHaveBeenCalledTimes(1)
    expect(shadow?.querySelector('.fr-translation-panel')).not.toBeNull()

    const header = shadow?.querySelector<HTMLElement>('.fr-panel-header')
    header?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
    header?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }))
    header?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    expect(mockTranslateText).toHaveBeenCalledTimes(1)
    expect(shadow?.querySelector('.fr-translation-panel')).not.toBeNull()

  })
})
