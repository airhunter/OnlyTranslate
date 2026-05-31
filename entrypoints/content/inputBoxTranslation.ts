export interface InputBoxTranslationConfig {
  inputBoxTranslationTrigger?: string
  inputBoxTranslationTarget?: string
  animations?: boolean
}

export interface InputBoxTranslationRuntime {
  sendMessage: (message: {
    type: 'inputBoxTranslation'
    text: string
    targetLang?: string
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
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
}

export interface InputBoxTranslationLifecycle {
  dispose: () => void
}

type TooltipType = 'translating' | 'success' | 'error'

interface InputBoxTranslationContext extends Required<Omit<InputBoxTranslationOptions, 'setTimeout' | 'clearTimeout' | 'logger'>> {
  logger: Pick<Console, 'error'>
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

const tripleTriggerKeys: Record<string, string> = {
  triple_space: ' ',
  triple_equal: '=',
  triple_dash: '-'
}

export function setupInputBoxTranslation(options: InputBoxTranslationOptions): InputBoxTranslationLifecycle {
  const context: InputBoxTranslationContext = {
    ...options,
    logger: options.logger ?? console,
    setTimeout: options.setTimeout ?? setTimeout,
    clearTimeout: options.clearTimeout ?? clearTimeout
  }
  let keyPressCount = 0
  let keyPressTimer: ReturnType<typeof setTimeout> | null = null
  let lastTriggerKey = ''
  const tripleKeyTimeout = 1000

  const resetTripleKeyState = () => {
    keyPressCount = 0
    lastTriggerKey = ''
    if (keyPressTimer) {
      context.clearTimeout(keyPressTimer)
      keyPressTimer = null
    }
  }

  const keydownHandler = async (event: KeyboardEvent) => {
    if (context.config.inputBoxTranslationTrigger === 'disabled') {
      return
    }

    const activeElement = context.document.activeElement as HTMLElement | null
    if (!isInputElement(activeElement)) {
      return
    }

    const triggerType = context.config.inputBoxTranslationTrigger

    if (triggerType === 'ctrl_enter') {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        await handleInputBoxTranslation(activeElement, context)
      }
      return
    }

    const targetKey = triggerType ? tripleTriggerKeys[triggerType] : undefined
    if (!targetKey) {
      return
    }

    if (event.key !== targetKey) {
      resetTripleKeyState()
      return
    }

    if (lastTriggerKey !== targetKey) {
      keyPressCount = 1
      lastTriggerKey = targetKey
    } else {
      keyPressCount++
    }

    if (keyPressCount === 3) {
      event.preventDefault()
      await handleInputBoxTranslation(activeElement, context)
      keyPressCount = 0
      lastTriggerKey = ''
    }

    if (keyPressTimer) {
      context.clearTimeout(keyPressTimer)
    }
    keyPressTimer = context.setTimeout(() => {
      keyPressCount = 0
      lastTriggerKey = ''
    }, tripleKeyTimeout)
  }

  context.document.addEventListener('keydown', keydownHandler)

  return {
    dispose() {
      context.document.removeEventListener('keydown', keydownHandler)
      resetTripleKeyState()
    }
  }
}

export function isInputElement(element: HTMLElement | null): element is HTMLElement {
  if (!element) return false

  const tagName = element.tagName.toLowerCase()
  const isInput = tagName === 'input'
  const isTextarea = tagName === 'textarea'
  const isContentEditable = element.contentEditable === 'true'

  if (isInput) {
    const inputType = (element as HTMLInputElement).type.toLowerCase()
    const textInputTypes = ['text', 'search', 'url', 'email', 'password']
    return textInputTypes.includes(inputType)
  }

  return isTextarea || isContentEditable
}

export function getInputBoxText(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value.trim()
  }
  if (element.contentEditable === 'true') {
    return element.innerText.trim()
  }

  return ''
}

export function removeTriggerSymbols(text: string, triggerType?: string): string {
  if (!text || triggerType === 'disabled' || triggerType === 'ctrl_enter') {
    return text
  }

  const triggerSymbol = triggerType ? tripleTriggerKeys[triggerType] : undefined
  if (!triggerSymbol) {
    return text
  }

  let cleanedText = text
  while (cleanedText.endsWith(triggerSymbol)) {
    cleanedText = cleanedText.slice(0, -1)
  }

  return cleanedText.trim()
}

export function setInputBoxText(element: HTMLElement, text: string): void {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea') {
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement
    inputElement.value = text
    inputElement.dispatchEvent(new Event('input', { bubbles: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (element.contentEditable === 'true') {
    element.innerText = text
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function createTranslationTooltip(
  element: HTMLElement,
  message: string,
  type: TooltipType,
  context: InputBoxTranslationContext
): HTMLElement {
  removeExistingTooltip(context)

  const tooltip = context.document.createElement('div')
  tooltip.className = `fluent-input-tooltip ${type}`
  tooltip.id = 'fluent-input-translation-tooltip'
  tooltip.innerHTML = `${getTooltipIcon(type)} ${message}`

  const rect = element.getBoundingClientRect()
  const tooltipTop = rect.bottom + context.window.scrollY + 12
  const tooltipLeft = rect.left + context.window.scrollX + (rect.width / 2)

  tooltip.style.top = `${tooltipTop}px`
  tooltip.style.left = `${tooltipLeft}px`
  tooltip.style.transform = 'translateX(-50%)'

  if (!context.config.animations) {
    tooltip.style.opacity = '1'
    tooltip.style.transform = 'translateX(-50%) translateY(0)'
  } else {
    tooltip.style.opacity = '0'
    context.setTimeout(() => {
      tooltip.classList.add('show')
    }, 10)
  }

  context.document.body.appendChild(tooltip)
  return tooltip
}

function getTooltipIcon(type: TooltipType): string {
  const icons = {
    translating: '•',
    success: '✓',
    error: '!'
  }
  return icons[type]
}

function removeExistingTooltip(context: InputBoxTranslationContext): void {
  const existing = context.document.getElementById('fluent-input-translation-tooltip')
  if (!existing) {
    return
  }

  if (!context.config.animations) {
    existing.remove()
  } else {
    existing.classList.add('hide')
    context.setTimeout(() => existing.remove(), 300)
  }
}

function addInputBoxAnimation(element: HTMLElement, animationType: TooltipType, context: InputBoxTranslationContext): void {
  if (!context.config.animations) {
    return
  }

  element.classList.remove('fluent-input-translating', 'fluent-input-success', 'fluent-input-error')
  element.classList.add(`fluent-input-${animationType}`)

  if (animationType !== 'translating') {
    context.setTimeout(() => {
      element.classList.remove(`fluent-input-${animationType}`)
    }, animationType === 'success' ? 1000 : 600)
  }
}

async function translateWithMicrosoft(
  text: string,
  targetLang: string | undefined,
  context: InputBoxTranslationContext
): Promise<string> {
  try {
    const result = await context.runtime.sendMessage({
      type: 'inputBoxTranslation',
      text,
      targetLang
    })

    if (result && result.success) {
      return result.translatedText ?? ''
    }

    throw new Error(result?.error || context.t('runtime.microsoftTranslateFailed'))
  } catch (error) {
    context.logger.error('微软翻译请求失败:', error)
    throw error
  }
}

async function handleInputBoxTranslation(element: HTMLElement, context: InputBoxTranslationContext): Promise<void> {
  try {
    const originalText = getInputBoxText(element)
    if (!originalText) {
      return
    }

    const cleanedText = removeTriggerSymbols(originalText, context.config.inputBoxTranslationTrigger)
    if (!cleanedText) {
      return
    }

    addInputBoxAnimation(element, 'translating', context)
    createTranslationTooltip(element, '微软翻译中', 'translating', context)

    try {
      const translatedText = await translateWithMicrosoft(cleanedText, context.config.inputBoxTranslationTarget, context)

      if (translatedText && translatedText !== cleanedText) {
        element.classList.remove('fluent-input-translating')
        setInputBoxText(element, translatedText)
        addInputBoxAnimation(element, 'success', context)
        removeExistingTooltip(context)
        createTranslationTooltip(element, '翻译成功', 'success', context)
      } else {
        element.classList.remove('fluent-input-translating')
        addInputBoxAnimation(element, 'error', context)
        removeExistingTooltip(context)
        createTranslationTooltip(element, '内容无需翻译', 'error', context)
      }
    } catch (translationError) {
      element.classList.remove('fluent-input-translating')
      addInputBoxAnimation(element, 'error', context)
      removeExistingTooltip(context)
      createTranslationTooltip(element, '微软翻译失败', 'error', context)
      context.logger.error('微软翻译失败:', translationError)
    }

    context.setTimeout(() => removeExistingTooltip(context), 2500)
  } catch (error) {
    context.logger.error('输入框翻译失败:', error)
    element.classList.remove('fluent-input-translating')
    addInputBoxAnimation(element, 'error', context)
    removeExistingTooltip(context)
    createTranslationTooltip(element, '翻译服务暂时不可用', 'error', context)
    context.setTimeout(() => removeExistingTooltip(context), 3000)
  }
}
