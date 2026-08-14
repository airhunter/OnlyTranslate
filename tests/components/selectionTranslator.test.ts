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
  theme: 'light'
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
  resolve: (value: string) => void
}

describe('SelectionTranslator', () => {
  let wrapper: VueWrapper | null = null
  let currentSelection: Selection | null = null
  let getSelectionSpy: ReturnType<typeof vi.spyOn>
  let pendingTranslations: PendingTranslation[] = []

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
    const indicator = document.querySelector<HTMLElement>('.fr-selection-indicator')
    expect(indicator).not.toBeNull()
    indicator?.dispatchEvent(new MouseEvent('mouseenter'))
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
    mockTranslateText.mockImplementation((text: string, _: string, options: { signal: AbortSignal }) => (
      new Promise<string>(resolve => {
        pendingTranslations.push({ text, signal: options.signal, resolve })
      })
    ))
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

    expect(pendingTranslations).toHaveLength(2)
    expect(pendingTranslations[0].signal.aborted).toBe(true)
    expect(pendingTranslations[1].text).toBe('second selection')

    pendingTranslations[1].resolve('第二个译文')
    await flushPromises()
    expect(document.querySelector('.fr-translation-result pre')?.textContent).toBe('第二个译文')

    pendingTranslations[0].resolve('迟到的第一个译文')
    await flushPromises()
    expect(document.querySelector('.fr-translation-result pre')?.textContent).toBe('第二个译文')
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
    expect(document.querySelector('.fr-translation-tooltip')).toBeNull()
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
    expect(document.querySelector('.fr-selection-indicator')).toBeNull()

    await setSelection('ab')
    expect(document.querySelector('.fr-selection-indicator')).not.toBeNull()

    const pageTarget = document.createElement('div')
    document.body.appendChild(pageTarget)
    pageTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    await setSelection('a'.repeat(4097))
    expect(document.querySelector('.fr-selection-indicator')).toBeNull()
  })
})
