import {
  createInputBoxEditorBridge,
  findCodeMirrorRoot,
  type InputBoxEditorBridge
} from './inputBoxEditorBridge'
import {
  createDiagnosticMetadata,
  createTranslationDiagnosticId,
} from '@/entrypoints/utils/translationDiagnostics'
import type { TranslationDiagnosticMetadata } from '@/entrypoints/utils/translationDiagnostics'

export type InputBoxTranslationTrigger =
  | 'disabled'
  | 'triple_space'
  | 'triple_equal'
  | 'triple_dash'
  | 'ctrl_enter'
  | 'auto_pause'

type InputBoxSetTimeout = Window['setTimeout']
type InputBoxClearTimeout = Window['clearTimeout']

export interface InputBoxTranslationConfig {
  on?: boolean
  inputBoxTranslationTrigger?: InputBoxTranslationTrigger | string
  inputBoxTranslationTarget?: string
  animations?: boolean
}

export interface InputBoxTranslationRuntime {
  sendMessage: (message: {
    type: 'inputBoxTranslation'
    text: string
    targetLang?: string
    diagnostics?: TranslationDiagnosticMetadata
  }) => Promise<{
    success?: boolean
    translatedText?: string
    error?: string
  }>
}

export interface InputBoxTranslationOptions {
  config: InputBoxTranslationConfig
  document: Document
  window: Window
  runtime: InputBoxTranslationRuntime
  t: (key: string) => string
  logger?: Pick<Console, 'error'>
  setTimeout?: InputBoxSetTimeout
  clearTimeout?: InputBoxClearTimeout
  autoPreviewDelay?: number
  requestTimeout?: number
  editorBridge?: InputBoxEditorBridge
}

export interface InputBoxTranslationLifecycle {
  dispose: () => void
}

type TooltipType = 'translating' | 'error' | 'candidate'

interface InputBoxTranslationContext
  extends Required<Omit<InputBoxTranslationOptions, 'setTimeout' | 'clearTimeout' | 'logger' | 'autoPreviewDelay' | 'requestTimeout' | 'editorBridge'>> {
  logger: Pick<Console, 'error'>
  setTimeout: InputBoxSetTimeout
  clearTimeout: InputBoxClearTimeout
  autoPreviewDelay: number
  requestTimeout: number
  editorBridge: InputBoxEditorBridge
}

interface TranslationCandidate {
  element: HTMLElement
  sourceText: string
  translatedText: string
  targetLang: string
}

const TOOLTIP_ID = 'fluent-input-translation-tooltip'
const TRIPLE_KEY_TIMEOUT = 1000
const DEFAULT_AUTO_PREVIEW_DELAY = 900
const DEFAULT_INPUT_TRANSLATION_REQUEST_TIMEOUT = 17_000
const DEFAULT_INPUT_TRANSLATION_TARGET = 'en'
const TRIPLE_TRIGGER_INSERTED_SYMBOLS = 2

const inputTranslationTargetLanguages = [
  { value: 'en', label: 'English' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' }
]

const tripleTriggerKeys: Record<string, string> = {
  triple_space: ' ',
  triple_equal: '=',
  triple_dash: '-'
}

interface InputAnchorRect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

function getInputBoxPresentationElement(element: HTMLElement): HTMLElement {
  return findCodeMirrorRoot(element) ?? element
}

function getTextControlCaretRect(
  element: HTMLInputElement | HTMLTextAreaElement,
  document: Document,
  window: Window
): InputAnchorRect | null {
  if (element.selectionStart === null) return null

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const computed = window.getComputedStyle(element)
  const mirror = document.createElement('div')
  const copiedProperties = [
    'box-sizing', 'width', 'height',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'font-family', 'font-size', 'font-style', 'font-variant', 'font-weight',
    'letter-spacing', 'line-height', 'text-align', 'text-indent', 'text-transform',
    'word-spacing', 'tab-size'
  ]
  copiedProperties.forEach(property => {
    mirror.style.setProperty(property, computed.getPropertyValue(property))
  })
  mirror.style.position = 'fixed'
  mirror.style.left = `${rect.left}px`
  mirror.style.top = `${rect.top}px`
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.overflow = 'hidden'
  mirror.style.whiteSpace = element instanceof HTMLInputElement ? 'pre' : 'pre-wrap'
  mirror.style.overflowWrap = element instanceof HTMLInputElement ? 'normal' : 'break-word'
  mirror.setAttribute('aria-hidden', 'true')

  mirror.textContent = element.value.slice(0, element.selectionStart)
  const marker = document.createElement('span')
  marker.textContent = element.value.slice(element.selectionStart) || '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  mirror.scrollTop = element.scrollTop
  mirror.scrollLeft = element.scrollLeft

  const markerRect = marker.getBoundingClientRect()
  const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) || 16
  mirror.remove()
  return {
    left: markerRect.left,
    right: markerRect.left,
    top: markerRect.top,
    bottom: markerRect.top + lineHeight,
    width: 0,
    height: lineHeight
  }
}

export function getInputBoxAnchorRect(
  element: HTMLElement,
  document: Document,
  window: Window
): InputAnchorRect {
  const codeMirrorRoot = findCodeMirrorRoot(element)
  const codeMirrorCursor = codeMirrorRoot?.querySelector<HTMLElement>('.CodeMirror-cursor')
  if (codeMirrorCursor) {
    const cursorRect = codeMirrorCursor.getBoundingClientRect()
    if (cursorRect.height > 0) return cursorRect
  }

  if (element.isContentEditable) {
    const selection = window.getSelection()
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange()
      const commonNode = range.commonAncestorContainer
      const commonElement = commonNode instanceof Element ? commonNode : commonNode.parentElement
      if (commonElement && (commonElement === element || element.contains(commonElement))) {
        range.collapse(false)
        const rangeRect = range.getBoundingClientRect()
        if (rangeRect.height > 0 || rangeRect.width > 0) return rangeRect
      }
    }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const caretRect = getTextControlCaretRect(element, document, window)
    if (caretRect) return caretRect
  }

  return getInputBoxPresentationElement(element).getBoundingClientRect()
}

export function setupInputBoxTranslation(options: InputBoxTranslationOptions): InputBoxTranslationLifecycle {
  const context: InputBoxTranslationContext = {
    ...options,
    logger: options.logger ?? console,
    setTimeout: (options.setTimeout ?? options.window.setTimeout).bind(options.window),
    clearTimeout: (options.clearTimeout ?? options.window.clearTimeout).bind(options.window),
    autoPreviewDelay: options.autoPreviewDelay ?? DEFAULT_AUTO_PREVIEW_DELAY,
    requestTimeout: options.requestTimeout ?? DEFAULT_INPUT_TRANSLATION_REQUEST_TIMEOUT,
    editorBridge: options.editorBridge ?? createInputBoxEditorBridge(options.window)
  }

  let disposed = false
  let applyingTranslation = false
  let keyPressCount = 0
  let lastTriggerKey = ''
  let keyPressTimer: ReturnType<InputBoxSetTimeout> | null = null
  let autoPreviewTimer: ReturnType<InputBoxSetTimeout> | null = null
  let requestGeneration = 0
  let candidate: TranslationCandidate | null = null
  let currentTooltip: HTMLElement | null = null
  let tooltipTarget: HTMLElement | null = null
  let activeTargetLang = context.config.inputBoxTranslationTarget || DEFAULT_INPUT_TRANSLATION_TARGET

  const resetTripleKeyState = () => {
    keyPressCount = 0
    lastTriggerKey = ''
    if (keyPressTimer) {
      context.clearTimeout(keyPressTimer)
      keyPressTimer = null
    }
  }

  const clearAutoPreviewTimer = () => {
    if (!autoPreviewTimer) return
    context.clearTimeout(autoPreviewTimer)
    autoPreviewTimer = null
  }

  const clearElementAnimation = (element: HTMLElement | null) => {
    if (!element) return
    getInputBoxPresentationElement(element)
      .classList.remove('fluent-input-translating', 'fluent-input-success', 'fluent-input-error')
  }

  const removeTooltip = () => {
    currentTooltip?.remove()
    currentTooltip = null
    tooltipTarget = null
  }

  const positionTooltip = () => {
    if (!currentTooltip || !tooltipTarget || !tooltipTarget.isConnected) {
      removeTooltip()
      return
    }

    const rect = getInputBoxAnchorRect(tooltipTarget, context.document, context.window)
    const tooltipRect = currentTooltip.getBoundingClientRect()
    const viewportWidth = context.window.innerWidth || context.document.documentElement.clientWidth
    const viewportHeight = context.window.innerHeight || context.document.documentElement.clientHeight
    const gap = 8
    const left = Math.min(
      Math.max(rect.left, gap),
      Math.max(gap, viewportWidth - tooltipRect.width - gap)
    )
    const belowTop = rect.bottom + gap
    const aboveTop = rect.top - tooltipRect.height - gap
    const top = belowTop + tooltipRect.height <= viewportHeight - gap || aboveTop < gap
      ? belowTop
      : aboveTop

    currentTooltip.style.left = `${left}px`
    currentTooltip.style.top = `${Math.max(gap, top)}px`
  }

  const mountTooltip = (element: HTMLElement, type: TooltipType): HTMLElement => {
    removeTooltip()

    const tooltip = context.document.createElement('div')
    tooltip.className = `fluent-input-tooltip ${type}`
    tooltip.id = TOOLTIP_ID
    tooltip.setAttribute('role', type === 'error' ? 'status' : 'dialog')
    tooltip.setAttribute('aria-live', 'polite')
    if (type !== 'error') {
      tooltip.setAttribute('aria-label', context.t('runtime.inputTranslationCandidate'))
    }

    if (!context.config.animations) {
      tooltip.classList.add('show')
    } else {
      context.setTimeout(() => {
        if (tooltip.isConnected) tooltip.classList.add('show')
      }, 10)
    }

    context.document.body.appendChild(tooltip)
    currentTooltip = tooltip
    tooltipTarget = element
    positionTooltip()
    return tooltip
  }

  const showStatus = (element: HTMLElement, message: string, type: Exclude<TooltipType, 'candidate'>, timeout?: number) => {
    const tooltip = mountTooltip(element, type)
    const icon = context.document.createElement('span')
    icon.className = 'fluent-input-tooltip-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = type === 'translating' ? '…' : '!'

    const text = context.document.createElement('span')
    text.textContent = message
    tooltip.append(icon, text)
    positionTooltip()

    if (timeout) {
      context.setTimeout(() => {
        if (currentTooltip === tooltip) removeTooltip()
      }, timeout)
    }
  }

  const createTargetSelect = (targetLang: string, onChange: (targetLang: string) => void) => {
    const select = context.document.createElement('select')
    select.className = 'fluent-input-target-select'
    select.setAttribute('aria-label', context.t('options.interaction.targetLanguage'))
    select.title = context.t('options.interaction.targetLanguage')
    inputTranslationTargetLanguages.forEach(language => {
      const option = context.document.createElement('option')
      option.value = language.value
      option.textContent = language.label
      select.appendChild(option)
    })
    select.value = targetLang
    select.addEventListener('change', () => {
      activeTargetLang = select.value
      onChange(select.value)
    })
    return select
  }

  const createPanelHeader = (targetLang: string, onTargetChange: (targetLang: string) => void) => {
    const header = context.document.createElement('div')
    header.className = 'fluent-input-candidate-header'

    const label = context.document.createElement('div')
    label.className = 'fluent-input-candidate-label'
    label.textContent = context.t('runtime.inputTranslationCandidate')
    header.append(label, createTargetSelect(targetLang, onTargetChange))
    return header
  }

  const showLoading = (element: HTMLElement, targetLang: string) => {
    const tooltip = mountTooltip(element, 'translating')
    const header = createPanelHeader(targetLang, nextTarget => {
      void requestCandidate(element, nextTarget)
    })
    const loading = context.document.createElement('div')
    loading.className = 'fluent-input-loading-row'

    const spinner = context.document.createElement('span')
    spinner.className = 'fluent-input-loading-spinner'
    spinner.setAttribute('aria-hidden', 'true')

    const text = context.document.createElement('span')
    text.textContent = context.t('runtime.inputTranslationTranslating')
    loading.append(spinner, text)
    tooltip.append(header, loading)
    positionTooltip()
  }

  const dismissCandidate = () => {
    candidate = null
    removeTooltip()
  }

  const invalidatePendingTranslation = () => {
    requestGeneration += 1
    clearAutoPreviewTimer()
    clearElementAnimation(candidate?.element ?? tooltipTarget)
    dismissCandidate()
  }

  const acceptCandidate = async () => {
    const acceptedCandidate = candidate
    if (!acceptedCandidate) return

    const currentText = await getInputBoxRawText(acceptedCandidate.element, context)
    if (candidate !== acceptedCandidate || currentText !== acceptedCandidate.sourceText) {
      dismissCandidate()
      return
    }

    const { element, translatedText } = acceptedCandidate
    dismissCandidate()
    applyingTranslation = true
    try {
      const replaced = await replaceInputBoxText(element, translatedText, context)
      if (replaced) {
        addInputBoxAnimation(element, 'success', context)
      } else {
        showStatus(element, context.t('runtime.inputTranslationFailed'), 'error', 2600)
      }
    } finally {
      applyingTranslation = false
    }
  }

  const showCandidate = (translationCandidate: TranslationCandidate) => {
    candidate = translationCandidate
    const tooltip = mountTooltip(translationCandidate.element, 'candidate')
    const header = createPanelHeader(translationCandidate.targetLang, nextTarget => {
      void requestCandidate(translationCandidate.element, nextTarget, translationCandidate.sourceText)
    })

    const text = context.document.createElement('div')
    text.className = 'fluent-input-candidate-text'
    text.dir = 'auto'
    text.textContent = translationCandidate.translatedText

    const actions = context.document.createElement('div')
    actions.className = 'fluent-input-candidate-actions'

    const acceptButton = context.document.createElement('button')
    acceptButton.type = 'button'
    acceptButton.className = 'fluent-input-candidate-button primary'
    acceptButton.textContent = `${context.t('runtime.inputTranslationAccept')} Tab`
    acceptButton.addEventListener('mousedown', event => event.preventDefault())
    acceptButton.addEventListener('click', () => void acceptCandidate())

    const cancelButton = context.document.createElement('button')
    cancelButton.type = 'button'
    cancelButton.className = 'fluent-input-candidate-button'
    cancelButton.textContent = `${context.t('runtime.inputTranslationCancel')} Esc`
    cancelButton.addEventListener('mousedown', event => event.preventDefault())
    cancelButton.addEventListener('click', dismissCandidate)

    actions.append(acceptButton, cancelButton)
    tooltip.append(header, text, actions)
    positionTooltip()
  }

  async function requestCandidate(
    element: HTMLElement,
    targetLang = activeTargetLang,
    knownSourceText?: string,
    triggerSymbolsToRemove = 0
  ) {
    if (disposed || !isInputElement(element)) return
    if (isUnsupportedInputEditor(element, context.window)) {
      showStatus(element, context.t('runtime.inputTranslationUnsupportedEditor'), 'error', 3200)
      return
    }

    const triggerType = context.config.inputBoxTranslationTrigger
    const generation = ++requestGeneration
    activeTargetLang = targetLang
    dismissCandidate()
    addInputBoxAnimation(element, 'translating', context)
    showLoading(element, targetLang)

    try {
      const rawText = knownSourceText ?? await getInputBoxRawText(element, context)
      const sourceText = knownSourceText
        ?? removeTriggerSymbols(rawText, triggerType, triggerSymbolsToRemove)
      const translationText = getTranslatableCore(sourceText)
      if (!translationText.text) {
        clearElementAnimation(element)
        removeTooltip()
        return
      }
      if (disposed || generation !== requestGeneration) return

      if (knownSourceText === undefined && rawText !== sourceText) {
        applyingTranslation = true
        try {
          await replaceInputBoxText(element, sourceText, context)
        } finally {
          applyingTranslation = false
        }
      }

      const translatedText = await translateInputText(
        translationText.text,
        targetLang,
        context
      )

      if (disposed || generation !== requestGeneration || !element.isConnected) return

      clearElementAnimation(element)
      const currentText = await getInputBoxRawText(element, context)
      if (currentText !== sourceText) {
        removeTooltip()
        return
      }

      const normalizedTranslation = translatedText.trim()
      const translatedCandidate = `${translationText.leading}${normalizedTranslation}${translationText.trailing}`
      if (!normalizedTranslation || translatedCandidate === sourceText) {
        showStatus(element, context.t('runtime.inputTranslationUnchanged'), 'error', 2200)
        return
      }

      showCandidate({
        element,
        sourceText,
        translatedText: translatedCandidate,
        targetLang
      })
    } catch (error) {
      if (disposed || generation !== requestGeneration) return
      clearElementAnimation(element)
      const errorMessage = getInputTranslationErrorMessage(error, context)
      showStatus(element, errorMessage, 'error', 2600)
      context.logger.error('Input box translation failed:', error)
    }
  }

  const keydownHandler = (event: KeyboardEvent) => {
    if (context.config.on === false || context.config.inputBoxTranslationTrigger === 'disabled') return
    if (event.isComposing || event.repeat) return

    if (candidate && event.key === 'Tab') {
      const eventTarget = event.target
      if (eventTarget instanceof Node && currentTooltip?.contains(eventTarget)) return
      if (!isCandidateEditorActive(candidate, context.document)) return
      event.preventDefault()
      event.stopPropagation()
      void acceptCandidate()
      return
    }

    if (candidate && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      dismissCandidate()
      return
    }

    const activeElement = getActiveInputElement(context.document)
    if (!activeElement) return

    const triggerType = context.config.inputBoxTranslationTrigger
    if (triggerType === 'ctrl_enter') {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (isUnsupportedInputEditor(activeElement, context.window)) {
          showStatus(activeElement, context.t('runtime.inputTranslationUnsupportedEditor'), 'error', 3200)
        } else {
          void requestCandidate(activeElement)
        }
      }
      return
    }

    const targetKey = triggerType ? tripleTriggerKeys[triggerType] : undefined
    if (!targetKey) return

    if (event.key !== targetKey) {
      resetTripleKeyState()
      return
    }

    if (lastTriggerKey !== targetKey) {
      keyPressCount = 1
      lastTriggerKey = targetKey
    } else {
      keyPressCount += 1
    }

    if (keyPressCount >= 3) {
      resetTripleKeyState()
      if (isUnsupportedInputEditor(activeElement, context.window)) {
        context.setTimeout(() => {
          showStatus(activeElement, context.t('runtime.inputTranslationUnsupportedEditor'), 'error', 3200)
        }, 0)
        return
      }
      event.preventDefault()
      void requestCandidate(activeElement, activeTargetLang, undefined, TRIPLE_TRIGGER_INSERTED_SYMBOLS)
      return
    }

    if (keyPressTimer) context.clearTimeout(keyPressTimer)
    keyPressTimer = context.setTimeout(resetTripleKeyState, TRIPLE_KEY_TIMEOUT)
  }

  const inputHandler = (event: Event) => {
    if (applyingTranslation) return

    const element = findInputElement(event.target)
    if (!element) return

    invalidatePendingTranslation()
    if (
      context.config.on === false
      || context.config.inputBoxTranslationTrigger !== 'auto_pause'
      || (event instanceof InputEvent && event.isComposing)
      || (!findCodeMirrorRoot(element) && !getInputBoxText(element))
    ) {
      return
    }

    if (isUnsupportedInputEditor(element, context.window)) return

    autoPreviewTimer = context.setTimeout(() => {
      autoPreviewTimer = null
      void requestCandidate(element)
    }, context.autoPreviewDelay)
  }

  const focusinHandler = (event: FocusEvent) => {
    if (!candidate) return
    const target = event.target
    if (target instanceof Node && currentTooltip?.contains(target)) return
    if (findInputElement(target) !== candidate.element) dismissCandidate()
  }

  context.document.addEventListener('keydown', keydownHandler, true)
  context.document.addEventListener('input', inputHandler, true)
  context.document.addEventListener('focusin', focusinHandler, true)
  context.window.addEventListener('scroll', positionTooltip, true)
  context.window.addEventListener('resize', positionTooltip)

  return {
    dispose() {
      disposed = true
      requestGeneration += 1
      context.document.removeEventListener('keydown', keydownHandler, true)
      context.document.removeEventListener('input', inputHandler, true)
      context.document.removeEventListener('focusin', focusinHandler, true)
      context.window.removeEventListener('scroll', positionTooltip, true)
      context.window.removeEventListener('resize', positionTooltip)
      resetTripleKeyState()
      clearAutoPreviewTimer()
      clearElementAnimation(candidate?.element ?? tooltipTarget)
      dismissCandidate()
      context.editorBridge.dispose()
    }
  }
}

function getDeepActiveElement(document: Document): Element | null {
  let activeElement: Element | null = document.activeElement
  while (activeElement instanceof HTMLElement && activeElement.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement
  }
  return activeElement
}

function getActiveInputElement(document: Document): HTMLElement | null {
  return findInputElement(getDeepActiveElement(document))
}

function isCandidateEditorActive(candidate: TranslationCandidate, document: Document): boolean {
  const activeElement = getActiveInputElement(document)
  if (!activeElement) return false
  if (activeElement === candidate.element) return true

  const candidateRoot = findCodeMirrorRoot(candidate.element)
  return !!candidateRoot && candidateRoot === findCodeMirrorRoot(activeElement)
}

function findInputElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (isInputElement(target)) return target

  const editableParent = target.closest<HTMLElement>('[contenteditable="true"], [contenteditable=""]')
  return isInputElement(editableParent) ? editableParent : null
}

export function isInputElement(element: HTMLElement | null): boolean {
  if (!element) return false

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'input') {
    const input = element as HTMLInputElement
    const inputType = input.type.toLowerCase()
    const textInputTypes = ['text', 'search', 'url', 'email', 'tel']
    return !input.disabled && !input.readOnly && textInputTypes.includes(inputType)
  }

  if (tagName === 'textarea') {
    const textarea = element as HTMLTextAreaElement
    return !textarea.disabled && !textarea.readOnly
  }

  return element.isContentEditable && element.getAttribute('aria-disabled') !== 'true'
}

const unsupportedProxyEditorSelector = [
  '.monaco-editor',
  '.ace_editor',
  '.cm-editor'
].join(', ')

const structuredContentEditorSelector = [
  '.ProseMirror',
  '.ql-editor',
  '[data-lexical-editor="true"]',
  '[data-slate-editor="true"]'
].join(', ')

export function isUnsupportedInputEditor(element: HTMLElement, window: Window): boolean {
  if (findCodeMirrorRoot(element)) return false

  if (element instanceof HTMLTextAreaElement) {
    if (element.hasAttribute('data-onlytranslate-editor-proxy')) return true
    if (element.closest(unsupportedProxyEditorSelector)) return true

    const proxyClassName = element.className.toLowerCase()
    const hasProxyClass = /(?:^|\s)(?:inputarea|ace_text-input|monaco-mouse-cursor-text)(?:\s|$)/.test(proxyClassName)
    if (hasProxyClass) return true

    const style = window.getComputedStyle(element)
    const visuallyHidden = style.opacity === '0'
      || style.clip === 'rect(0px, 0px, 0px, 0px)'
      || style.clipPath === 'inset(50%)'
    if (element.getAttribute('aria-hidden') === 'true' && visuallyHidden) return true
  }

  if (element.isContentEditable) {
    if (element.matches(structuredContentEditorSelector) || element.closest(structuredContentEditorSelector)) {
      return true
    }
    return Array.from(element.children).some(child => child.tagName !== 'BR')
  }

  return false
}

export function getInputBoxText(element: HTMLElement): string {
  return getRawInputBoxText(element).trim()
}

function getRawInputBoxText(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value
  }
  if (element.isContentEditable) {
    return element.innerText || element.textContent || ''
  }
  return ''
}

export function removeTriggerSymbols(
  text: string,
  triggerType?: string,
  insertedSymbolCount = TRIPLE_TRIGGER_INSERTED_SYMBOLS
): string {
  if (!text || insertedSymbolCount <= 0) return text

  const triggerSymbol = triggerType ? tripleTriggerKeys[triggerType] : undefined
  if (!triggerSymbol) return text

  const insertedSuffix = triggerSymbol.repeat(insertedSymbolCount)
  return text.endsWith(insertedSuffix)
    ? text.slice(0, -insertedSuffix.length)
    : text
}

function getTranslatableCore(text: string): { text: string; leading: string; trailing: string } {
  if (!text.trim()) return { text: '', leading: text, trailing: '' }

  const leading = text.match(/^\s*/u)?.[0] ?? ''
  const trailing = text.match(/\s*$/u)?.[0] ?? ''
  return {
    text: text.slice(leading.length, text.length - trailing.length),
    leading,
    trailing
  }
}

export function setInputBoxText(element: HTMLElement, text: string): void {
  const document = element.ownerDocument
  const view = document.defaultView
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea') {
    const prototype = tagName === 'input'
      ? view?.HTMLInputElement.prototype
      : view?.HTMLTextAreaElement.prototype
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : undefined
    if (setter) {
      setter.call(element, text)
    } else {
      ;(element as HTMLInputElement | HTMLTextAreaElement).value = text
    }
    dispatchReplacementEvents(element, text, view)
    return
  }

  if (!element.isContentEditable) return

  element.focus()
  let replaced = false
  try {
    const selection = view?.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    replaced = typeof document.execCommand === 'function'
      && document.execCommand('insertText', false, text)
  } catch {
    replaced = false
  }

  if (!replaced) element.textContent = text
  dispatchReplacementEvents(element, text, view)
}

function dispatchReplacementEvents(element: HTMLElement, text: string, view: Window | null): void {
  const InputEventConstructor = view
    ? (view as Window & typeof globalThis).InputEvent
    : globalThis.InputEvent
  const inputEvent = InputEventConstructor
    ? new InputEventConstructor('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertReplacementText',
        data: text
      })
    : new Event('input', { bubbles: true, composed: true })
  element.dispatchEvent(inputEvent)
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function addInputBoxAnimation(
  element: HTMLElement,
  animationType: 'translating' | 'success' | 'error',
  context: InputBoxTranslationContext
): void {
  if (!context.config.animations) return

  const presentationElement = getInputBoxPresentationElement(element)
  presentationElement.classList.remove('fluent-input-translating', 'fluent-input-success', 'fluent-input-error')
  presentationElement.classList.add(`fluent-input-${animationType}`)
  if (animationType === 'translating') return

  context.setTimeout(() => {
    presentationElement.classList.remove(`fluent-input-${animationType}`)
  }, animationType === 'success' ? 1000 : 600)
}

async function getInputBoxRawText(
  element: HTMLElement,
  context: InputBoxTranslationContext
): Promise<string> {
  const codeMirrorRoot = findCodeMirrorRoot(element)
  if (!codeMirrorRoot) return getRawInputBoxText(element)

  const editorText = await context.editorBridge.read(element)
  if (editorText !== null) return editorText
  throw new Error('Unable to access the complete CodeMirror document')
}

async function replaceInputBoxText(
  element: HTMLElement,
  text: string,
  context: InputBoxTranslationContext
): Promise<boolean> {
  if (findCodeMirrorRoot(element)) {
    return context.editorBridge.replace(element, text)
  }

  setInputBoxText(element, text)
  return true
}

async function translateInputText(
  text: string,
  targetLang: string | undefined,
  context: InputBoxTranslationContext
): Promise<string> {
  let timeoutId: ReturnType<InputBoxSetTimeout> | null = null
  let result: Awaited<ReturnType<InputBoxTranslationRuntime['sendMessage']>>

  try {
    const queuedAt = Date.now()
    result = await Promise.race([
      context.runtime.sendMessage({
        type: 'inputBoxTranslation',
        text,
        targetLang,
        diagnostics: createDiagnosticMetadata({
          sessionId: createTranslationDiagnosticId('input'),
          scene: 'input',
          startedAt: queuedAt,
          pageUrl: context.document.location.href,
        }, 0, queuedAt),
      }),
      new Promise<never>((_, reject) => {
        timeoutId = context.setTimeout(() => {
          reject(new Error(context.t('runtime.translationRequestTimeout')))
        }, context.requestTimeout)
      })
    ])
  } finally {
    if (timeoutId !== null) context.clearTimeout(timeoutId)
  }

  if (result?.success) return result.translatedText ?? ''
  throw new Error(result?.error || context.t('runtime.inputTranslationFailed'))
}

function getInputTranslationErrorMessage(
  error: unknown,
  context: InputBoxTranslationContext
): string {
  const fallback = context.t('runtime.inputTranslationFailed')
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalizedMessage = message.replace(/\s+/g, ' ').trim()

  if (!normalizedMessage || normalizedMessage === fallback) return fallback
  if (normalizedMessage === context.t('runtime.translationRequestTimeout')) {
    return context.t('runtime.translationRequestTimeout')
  }
  if (/\b429\b|too many requests|rate[ -]?limit/i.test(normalizedMessage)) {
    return context.t('runtime.inputTranslationRateLimited')
  }
  if (/extension context invalidated|receiving end does not exist/i.test(normalizedMessage)) {
    return context.t('runtime.inputTranslationReloadPage')
  }

  const shortMessage = normalizedMessage.length > 120
    ? `${normalizedMessage.slice(0, 117)}...`
    : normalizedMessage
  return `${fallback}：${shortMessage}`
}
