<template>
  <div
    ref="selection-ref"
    class="fr-selection-translator-wrapper"
    :class="{ 'fr-dark-theme': isDarkTheme, 'fr-static': !config.animations }"
  >
    <div v-if="showToolbar" class="fr-selection-toolbar" role="toolbar" :aria-label="t('selection.title')">
      <button
        type="button"
        class="fr-toolbar-btn fr-toolbar-btn--primary"
        :title="t('selection.translate')"
        :aria-label="t('selection.translate')"
        @click="openTranslationPanel"
      >
        <svg class="fr-product-logo" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 15v2a2 2 0 0 0 1.85 1.995L7 19h3v2H7a4 4 0 0 1-4-4v-2h2zm13-5 4.4 11h-2.155l-1.201-3h-4.09l-1.199 3h-2.154L16 10h2zm-1 2.885L15.753 16h2.492L17 12.885zM8 2v2h4v7H8v3H6v-3H2V4h4V2h2zm9 1a4 4 0 0 1 4 4v2h-2V7a2 2 0 0 0-2-2h-3V3h3zM6 6H4v3h2V6zm4 0H8v3h2V6z" />
        </svg>
      </button>
      <span class="fr-toolbar-divider"></span>
      <button
        type="button"
        class="fr-toolbar-btn"
        :class="{ 'is-active': isPlaying && currentPlayingText === selectedText }"
        :title="t('selection.speak')"
        :aria-label="t('selection.speak')"
        @click="event => toggleAudio(selectedText, event)"
      >
        <svg v-if="isPlaying && currentPlayingText === selectedText" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1"></rect>
          <rect x="14" y="5" width="4" height="14" rx="1"></rect>
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 3.5a5 5 0 0 1 0 7M18 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
      <button
        type="button"
        class="fr-toolbar-btn"
        :title="t('selection.close')"
        :aria-label="t('selection.close')"
        @click="closeAll"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <section v-if="showPanel" class="fr-translation-panel" :aria-label="t('selection.title')">
      <header class="fr-panel-header">
        <div class="fr-panel-brand">
          <span class="fr-brand-mark">译</span>
          <span>{{ t('selection.title') }}</span>
        </div>
        <div class="fr-panel-header-actions">
          <button
            v-if="config.selectionTranslatorMode === 'translation-only'"
            type="button"
            class="fr-icon-btn"
            :title="t('selection.copyOriginal')"
            @click="copyText(selectedText, 'original')"
          >
            <svg v-if="copiedTarget === 'original'" class="fr-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
          </button>
          <button type="button" class="fr-icon-btn fr-close-btn" :title="t('selection.close')" @click="closeAll">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </header>

      <div class="fr-panel-content">
        <article v-if="config.selectionTranslatorMode === 'bilingual'" class="fr-text-block fr-text-block--original">
          <div class="fr-text-block-header">
            <span>{{ t('selection.original') }}</span>
            <div class="fr-text-actions">
              <button type="button" class="fr-icon-btn" :title="t('selection.copyOriginal')" @click="copyText(selectedText, 'original')">
                <svg v-if="copiedTarget === 'original'" class="fr-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
              </button>
              <button type="button" class="fr-icon-btn" :class="{ 'is-active': isPlaying && currentPlayingText === selectedText }" :title="t('selection.playOriginal')" @click="event => toggleAudio(selectedText, event)">
                <svg v-if="isPlaying && currentPlayingText === selectedText" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 3.5a5 5 0 0 1 0 7"/></svg>
              </button>
            </div>
          </div>
          <div class="fr-selectable-text">{{ selectedText }}</div>
        </article>

        <article class="fr-text-block fr-text-block--translation">
          <div class="fr-text-block-header">
            <span>{{ t('selection.translation') }}</span>
            <div v-if="translationResult" class="fr-text-actions">
              <button type="button" class="fr-icon-btn" :title="t('selection.copyTranslation')" @click="copyText(translationResult, 'translation')">
                <svg v-if="copiedTarget === 'translation'" class="fr-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
              </button>
              <button type="button" class="fr-icon-btn" :class="{ 'is-active': isPlaying && currentPlayingText === translationResult }" :title="t('selection.playTranslation')" @click="event => toggleAudio(translationResult, event)">
                <svg v-if="isPlaying && currentPlayingText === translationResult" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 3.5a5 5 0 0 1 0 7"/></svg>
              </button>
            </div>
          </div>

          <div v-if="isLoading" class="fr-loading-state" aria-live="polite">
            <span class="fr-loading-dot"></span><span class="fr-loading-dot"></span><span class="fr-loading-dot"></span>
          </div>
          <div v-else-if="error" class="fr-error-state">
            <span>{{ error }}</span>
            <button type="button" @click="regenerateTranslation">{{ t('selection.regenerate') }}</button>
          </div>
          <div v-else class="fr-selectable-text fr-translation-text">{{ translationResult }}</div>
        </article>
      </div>

      <footer class="fr-panel-footer">
        <label class="fr-select-wrap" :title="t('selection.service')">
          <span class="fr-field-label">{{ t('selection.service') }}</span>
          <select v-model="activeService" @change="handleServiceChange">
            <option v-for="service in availableServices" :key="service.value" :value="service.value">
              {{ service.label }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="fr-regenerate-btn"
          :class="{ 'is-spinning': isLoading && config.animations }"
          :disabled="isLoading"
          :title="t('selection.regenerate')"
          @click="regenerateTranslation"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v6h-6M4 18v-6h6M18.5 9A7 7 0 0 0 6.2 6.2L4 9m16 6-2.2 2.8A7 7 0 0 1 5.5 15"/></svg>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { autoUpdate, computePosition, flip, hide, offset, shift, type VirtualElement } from '@floating-ui/dom'
import { storage } from '@wxt-dev/storage'
import { config } from '@/entrypoints/utils/config'
import { isTranslationCancelledError, translateText } from '@/entrypoints/utils/translateApi'
import { isServiceConfigured, options } from '@/entrypoints/utils/option'
import { speakText, stopTts } from '@/entrypoints/utils/ttsClient'
import { t } from '@/entrypoints/utils/i18n'

type CopyTarget = 'original' | 'translation'
type ServiceOption = { value: string; label: string }

interface SelectionSession {
  id: number
  text: string
  range: Range
  anchor: Range | VirtualElement
  context: string
}

const selectedText = ref('')
const translationResult = ref('')
const showToolbar = ref(false)
const showPanel = ref(false)
const isLoading = ref(false)
const error = ref('')
const copiedTarget = ref<CopyTarget | null>(null)
const isPlaying = ref(false)
const currentPlayingText = ref('')
const isSelecting = ref(false)
const isInteractingWithSelectionUi = ref(false)
const isDarkTheme = ref(false)
const activeSelectionSession = ref<SelectionSession | null>(null)
const activeService = ref(config.service)
const containerRef = useTemplateRef('selection-ref')

let nextSelectionSessionId = 0
let activeTranslationController: AbortController | null = null
let activeTranslationRequestId = 0
let activePlaybackId = 0
let debounceTimer: number | null = null
let copyTimer: number | null = null
let mouseDownHandler: (event: MouseEvent) => void
let mouseUpHandler: (event: MouseEvent) => void
let clickHandler: (event: Event) => void
let selectionChangeHandler: () => void
let systemThemeHandler: () => void

const getEventPath = (event: Event) => (
  typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
)

const isEventInsideSelectionUi = (event: Event) => {
  const container = containerRef.value
  if (!container) return false
  return getEventPath(event).some(node => node === container || (node instanceof Node && container.contains(node)))
}

const isNodeInsideSelectionUi = (node: Node | null) => {
  const container = containerRef.value
  return Boolean(container && node && (node === container || container.contains(node)))
}

const isSelectionInsideUi = () => {
  const selection = window.getSelection()
  return Boolean(selection && (
    isNodeInsideSelectionUi(selection.anchorNode)
    || isNodeInsideSelectionUi(selection.focusNode)
  ))
}

const createPointerAnchor = (event?: MouseEvent): VirtualElement | undefined => {
  if (!event || (event.clientX === 0 && event.clientY === 0)) return undefined
  const rect = new DOMRect(event.clientX, event.clientY, 1, 1)
  return { getBoundingClientRect: () => rect }
}

watchEffect(onCleanup => {
  const session = activeSelectionSession.value
  const container = containerRef.value
  if ((!showToolbar.value && !showPanel.value) || !session || !container) return

  const updatePosition = () => {
    computePosition(session.anchor, container, {
      placement: showPanel.value ? 'bottom-start' : 'top-start',
      strategy: 'fixed',
      middleware: [
        offset(showPanel.value ? 10 : 8),
        flip({ padding: 12 }),
        shift({ padding: 12 }),
        hide(),
      ],
    }).then(({ x, y, middlewareData }) => {
      Object.assign(container.style, {
        left: x + 'px',
        top: y + 'px',
        visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible',
      })
    })
  }

  const cleanup = autoUpdate(session.anchor, container, updatePosition, { animationFrame: true })
  onCleanup(cleanup)
})

watch([showToolbar, showPanel], ([toolbarVisible, panelVisible]) => {
  if (toolbarVisible || panelVisible) return
  activeSelectionSession.value = null
})

const availableServices = computed<ServiceOption[]>(() => {
  const result: ServiceOption[] = []
  for (const item of options.services) {
    if (!item.disabled && isServiceConfigured(item.value, config)) {
      result.push({ value: item.value, label: item.label })
    }
  }
  for (const provider of config.customProviders ?? []) {
    if (isServiceConfigured(provider.id, config)) {
      result.push({ value: provider.id, label: provider.name || provider.id })
    }
  }
  if (!result.some(item => item.value === activeService.value)) {
    const fallbackLabel = options.services.find(item => item.value === activeService.value)?.label ?? activeService.value
    result.unshift({ value: activeService.value, label: fallbackLabel })
  }
  return result
})

const saveConfig = () => storage.setItem('local:config', JSON.stringify(config))

const cancelActiveTranslation = () => {
  activeTranslationRequestId += 1
  activeTranslationController?.abort()
  activeTranslationController = null
  isLoading.value = false
}

const stopAudio = () => {
  activePlaybackId += 1
  stopTts()
  isPlaying.value = false
  currentPlayingText.value = ''
}

const closeAll = () => {
  cancelActiveTranslation()
  stopAudio()
  showToolbar.value = false
  showPanel.value = false
  translationResult.value = ''
  error.value = ''
}

const commitSelectionSession = (text: string, range: Range, event?: MouseEvent) => {
  cancelActiveTranslation()
  stopAudio()
  const session: SelectionSession = {
    id: ++nextSelectionSessionId,
    text,
    range,
    anchor: createPointerAnchor(event) ?? range,
    context: document.title,
  }
  activeSelectionSession.value = session
  selectedText.value = text
  translationResult.value = ''
  error.value = ''
  activeService.value = config.service
  showPanel.value = false
  showToolbar.value = true
}

const handleTextSelection = (event?: MouseEvent) => {
  if (isSelecting.value || isInteractingWithSelectionUi.value || isSelectionInsideUi()) return
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      closeAll()
      return
    }
    const text = selection.toString().trim()
    if (!text || text.length < 2 || text.length > 4096) {
      closeAll()
      return
    }
    commitSelectionSession(text, selection.getRangeAt(0), event)
  }, 160)
}

const getTranslation = async (useCache = config.useCache) => {
  const session = activeSelectionSession.value
  if (!session) return

  cancelActiveTranslation()
  const requestId = ++activeTranslationRequestId
  const controller = new AbortController()
  activeTranslationController = controller
  isLoading.value = true
  error.value = ''

  try {
    const result = await translateText(session.text, session.context, {
      signal: controller.signal,
      useCache,
      diagnostics: { scene: 'selection', pageUrl: document.location.href },
    })
    if (
      controller.signal.aborted
      || requestId !== activeTranslationRequestId
      || activeSelectionSession.value?.id !== session.id
    ) return
    translationResult.value = result
  } catch (cause) {
    if (controller.signal.aborted || requestId !== activeTranslationRequestId || isTranslationCancelledError(cause)) return
    error.value = t('selection.failed')
    console.error('Selection translation failed:', cause)
  } finally {
    if (requestId === activeTranslationRequestId) {
      activeTranslationController = null
      isLoading.value = false
    }
  }
}

const openTranslationPanel = () => {
  showToolbar.value = false
  showPanel.value = true
  void getTranslation()
}

const regenerateTranslation = () => {
  translationResult.value = ''
  void getTranslation(false)
}

const copyText = async (text: string, target: CopyTarget) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedTarget.value = target
    if (copyTimer !== null) window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copiedTarget.value = null
      copyTimer = null
    }, 1200)
  } catch (cause) {
    console.error('Copy failed:', cause)
  }
}

const toggleAudio = async (text: string, event?: Event) => {
  event?.preventDefault()
  event?.stopPropagation()
  if (!text) return
  if (isPlaying.value && currentPlayingText.value === text) {
    stopAudio()
    return
  }

  stopAudio()
  const playbackId = ++activePlaybackId
  isPlaying.value = true
  currentPlayingText.value = text
  try {
    await speakText(text, {
      engine: config.ttsEngine,
      gender: config.ttsVoiceGender,
    })
  } catch (cause) {
    console.error('Text to speech failed:', cause)
  } finally {
    if (playbackId === activePlaybackId) {
      isPlaying.value = false
      currentPlayingText.value = ''
    }
  }
}

const handleServiceChange = async () => {
  config.service = activeService.value
  await saveConfig()
  regenerateTranslation()
}

const updateTheme = () => {
  const theme = config.theme || 'auto'
  isDarkTheme.value = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

onMounted(() => {
  updateTheme()
  watch(() => config.theme, updateTheme, { immediate: true })

  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeHandler = () => {
    if (config.theme === 'auto') updateTheme()
  }
  darkModeMediaQuery.addEventListener('change', systemThemeHandler)

  mouseDownHandler = event => {
    if (isEventInsideSelectionUi(event)) {
      isInteractingWithSelectionUi.value = true
      isSelecting.value = false
      return
    }
    isInteractingWithSelectionUi.value = false
    isSelecting.value = true
  }

  mouseUpHandler = event => {
    if (isEventInsideSelectionUi(event)) {
      isSelecting.value = false
      window.setTimeout(() => { isInteractingWithSelectionUi.value = false }, 0)
      return
    }
    isInteractingWithSelectionUi.value = false
    isSelecting.value = false
    handleTextSelection(event)
  }

  let lastSelectionChangeAt = 0
  selectionChangeHandler = () => {
    if (isInteractingWithSelectionUi.value || isSelecting.value || isSelectionInsideUi()) return
    const now = Date.now()
    if (now - lastSelectionChangeAt < 500) return
    lastSelectionChangeAt = now
    window.setTimeout(() => handleTextSelection(), 100)
  }

  clickHandler = event => {
    if (!isEventInsideSelectionUi(event) && (showToolbar.value || showPanel.value)) closeAll()
  }

  document.addEventListener('mousedown', mouseDownHandler)
  document.addEventListener('mouseup', mouseUpHandler)
  document.addEventListener('selectionchange', selectionChangeHandler)
  document.addEventListener('click', clickHandler)
})

onBeforeUnmount(() => {
  cancelActiveTranslation()
  stopAudio()
  document.removeEventListener('mousedown', mouseDownHandler)
  document.removeEventListener('mouseup', mouseUpHandler)
  document.removeEventListener('selectionchange', selectionChangeHandler)
  document.removeEventListener('click', clickHandler)
  if (systemThemeHandler) window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeHandler)
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  if (copyTimer !== null) window.clearTimeout(copyTimer)
})
</script>
