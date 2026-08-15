<template>
  <div
    ref="selection-ref"
    class="fr-selection-translator-wrapper"
    :class="{
      'fr-dark-theme': isDarkTheme,
      'fr-static': !config.animations,
      'fr-is-dragging': isDraggingPanel,
    }"
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
      <button
        type="button"
        class="fr-toolbar-btn"
        :title="t('selection.analyze')"
        :aria-label="t('selection.analyze')"
        @click="openAnalysisPanel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h9M4 9h7M4 13h4" />
          <circle cx="15" cy="14" r="4" />
          <path d="m18 17 3 3" />
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

    <section
      v-if="showPanel"
      class="fr-translation-panel"
      :class="{ 'fr-analysis-panel': panelMode === 'analysis' }"
      :aria-label="panelTitle"
    >
      <header class="fr-panel-header" @pointerdown="startPanelDrag">
        <div class="fr-panel-brand">
          <span class="fr-brand-mark">{{ panelMode === 'analysis' ? '析' : '译' }}</span>
          <span>{{ panelTitle }}</span>
        </div>
        <div class="fr-panel-header-actions">
          <button
            v-if="panelMode === 'translation' && config.selectionTranslatorMode === 'translation-only'"
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
        <article v-if="shouldShowOriginal" class="fr-text-block fr-text-block--original">
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

        <article class="fr-text-block" :class="panelMode === 'analysis' ? 'fr-text-block--analysis' : 'fr-text-block--translation'">
          <div class="fr-text-block-header">
            <span>{{ panelMode === 'analysis' ? t('selection.analysis') : t('selection.translation') }}</span>
            <div v-if="panelMode === 'translation' && translationResult" class="fr-text-actions">
                <button type="button" class="fr-icon-btn" :title="t('selection.copyTranslation')" @click="copyText(translationResult, 'translation')">
                  <svg v-if="copiedTarget === 'translation'" class="fr-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                </button>
                <button type="button" class="fr-icon-btn" :class="{ 'is-active': isPlaying && currentPlayingText === translationResult }" :title="t('selection.playTranslation')" @click="event => toggleAudio(translationResult, event)">
                  <svg v-if="isPlaying && currentPlayingText === translationResult" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 3.5a5 5 0 0 1 0 7"/></svg>
                </button>
            </div>
            <div v-else-if="panelMode === 'analysis' && analysisResult" class="fr-text-actions">
              <button type="button" class="fr-icon-btn" :title="t('selection.copyAnalysis')" @click="copyText(analysisCopyText, 'analysis')">
                <svg v-if="copiedTarget === 'analysis'" class="fr-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
              </button>
            </div>
          </div>

          <div v-if="isLoading" class="fr-loading-state" aria-live="polite">
            <span class="fr-loading-dot"></span><span class="fr-loading-dot"></span><span class="fr-loading-dot"></span>
          </div>
          <div v-else-if="error" class="fr-error-state">
            <span>{{ error }}</span>
            <button v-if="canRunCurrentMode" type="button" @click="regenerateCurrentResult">{{ t('selection.regenerate') }}</button>
          </div>
          <div v-else-if="panelMode === 'translation'" class="fr-selectable-text fr-translation-text">{{ translationResult }}</div>
          <div v-else-if="analysisResult" class="fr-analysis-result fr-selectable-text">
            <div v-if="analysisResult.kind === 'term'" class="fr-analysis-term-heading">
              <strong>{{ analysisResult.term || selectedText }}</strong>
              <span v-if="analysisResult.pronunciation">{{ analysisResult.pronunciation }}</span>
              <span v-if="analysisResult.partOfSpeech" class="fr-analysis-chip">{{ analysisResult.partOfSpeech }}</span>
              <span v-if="analysisResult.difficulty" class="fr-analysis-chip">{{ analysisResult.difficulty }}</span>
            </div>

            <section v-if="analysisResult.summary" class="fr-analysis-section">
              <p>{{ analysisResult.summary }}</p>
            </section>
            <section v-if="analysisResult.definition" class="fr-analysis-section">
              <h4>{{ t('selection.definition') }}</h4>
              <p>{{ analysisResult.definition }}</p>
            </section>
            <section v-if="analysisResult.contextualMeaning" class="fr-analysis-section">
              <h4>{{ t('selection.contextualMeaning') }}</h4>
              <p>{{ analysisResult.contextualMeaning }}</p>
            </section>
            <section v-if="analysisResult.example" class="fr-analysis-section">
              <h4>{{ t('selection.example') }}</h4>
              <p>{{ analysisResult.example }}</p>
            </section>
            <section v-if="analysisResult.translation" class="fr-analysis-section">
              <h4>{{ t('selection.translation') }}</h4>
              <p>{{ analysisResult.translation }}</p>
            </section>
            <section v-if="analysisResult.overview" class="fr-analysis-section">
              <h4>{{ t('selection.overview') }}</h4>
              <p>{{ analysisResult.overview }}</p>
            </section>
            <section v-if="analysisResult.structure" class="fr-analysis-section">
              <h4>{{ t('selection.structure') }}</h4>
              <p>{{ analysisResult.structure }}</p>
            </section>
            <section v-if="analysisResult.grammarPoints.length" class="fr-analysis-section">
              <h4>{{ t('selection.grammarPoints') }}</h4>
              <ul class="fr-analysis-list">
                <li v-for="(item, index) in analysisResult.grammarPoints" :key="`grammar-${index}`">
                  <strong v-if="item.title">{{ item.title }}</strong>
                  <span>{{ item.explanation }}</span>
                </li>
              </ul>
            </section>
            <section v-if="analysisResult.expressions.length" class="fr-analysis-section">
              <h4>{{ t('selection.expressions') }}</h4>
              <ul class="fr-analysis-list">
                <li v-for="(item, index) in analysisResult.expressions" :key="`expression-${index}`">
                  <strong v-if="item.title">{{ item.title }}</strong>
                  <span>{{ item.explanation }}</span>
                </li>
              </ul>
            </section>
            <section v-if="analysisResult.notes.length" class="fr-analysis-section">
              <h4>{{ t('selection.notes') }}</h4>
              <ul class="fr-analysis-list fr-analysis-list--notes">
                <li v-for="(note, index) in analysisResult.notes" :key="`note-${index}`"><span>{{ note }}</span></li>
              </ul>
            </section>
          </div>
        </article>
      </div>

      <footer class="fr-panel-footer">
        <label v-if="panelServices.length" class="fr-select-wrap" :title="t('selection.service')">
          <span class="fr-field-label">{{ t('selection.service') }}</span>
          <select v-model="activeService" @change="handleServiceChange">
            <option v-for="service in panelServices" :key="service.value" :value="service.value">
              {{ service.label }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="fr-regenerate-btn"
          :class="{ 'is-spinning': isLoading && config.animations }"
          :disabled="isLoading || !canRunCurrentMode"
          :title="t('selection.regenerate')"
          @click="regenerateCurrentResult"
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
import { analyzeSelectionText, isTranslationCancelledError, translateText } from '@/entrypoints/utils/translateApi'
import { isServiceConfigured, options, servicesType } from '@/entrypoints/utils/option'
import type { SelectionAnalysisResult } from '@/entrypoints/utils/selectionAnalysis'
import { speakText, stopTts } from '@/entrypoints/utils/ttsClient'
import { t } from '@/entrypoints/utils/i18n'

type CopyTarget = 'original' | 'translation' | 'analysis'
type PanelMode = 'translation' | 'analysis'
type ServiceOption = { value: string; label: string }

interface SelectionSession {
  id: number
  text: string
  range: Range
  anchor: Range | VirtualElement
  context: string
  surroundingContext: string
}

const selectedText = ref('')
const translationResult = ref('')
const analysisResult = ref<SelectionAnalysisResult | null>(null)
const panelMode = ref<PanelMode>('translation')
const showToolbar = ref(false)
const showPanel = ref(false)
const isLoading = ref(false)
const error = ref('')
const copiedTarget = ref<CopyTarget | null>(null)
const isPlaying = ref(false)
const currentPlayingText = ref('')
const isSelecting = ref(false)
const isInteractingWithSelectionUi = ref(false)
const isDraggingPanel = ref(false)
const isPanelPositionManual = ref(false)
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
let panelPointerId: number | null = null
let panelDragOffsetX = 0
let panelDragOffsetY = 0

const PANEL_VIEWPORT_PADDING = 12

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

const constrainPanelPosition = (x: number, y: number) => {
  const container = containerRef.value
  if (!container) return { x, y }
  const rect = container.getBoundingClientRect()
  const maxX = Math.max(PANEL_VIEWPORT_PADDING, window.innerWidth - rect.width - PANEL_VIEWPORT_PADDING)
  const maxY = Math.max(PANEL_VIEWPORT_PADDING, window.innerHeight - rect.height - PANEL_VIEWPORT_PADDING)
  return {
    x: Math.min(Math.max(x, PANEL_VIEWPORT_PADDING), maxX),
    y: Math.min(Math.max(y, PANEL_VIEWPORT_PADDING), maxY),
  }
}

const applyPanelPosition = (x: number, y: number) => {
  const container = containerRef.value
  if (!container) return
  const position = constrainPanelPosition(x, y)
  Object.assign(container.style, {
    left: position.x + 'px',
    top: position.y + 'px',
  })
}

const keepManualPanelPositionInViewport = () => {
  const container = containerRef.value
  if (!container || !isPanelPositionManual.value || !showPanel.value) return
  const rect = container.getBoundingClientRect()
  applyPanelPosition(rect.left, rect.top)
}

const startPanelDrag = (event: PointerEvent) => {
  if (event.button !== 0) return
  if (getEventPath(event).some(node => (
    node instanceof Element && node.matches('button, select, input, textarea, a')
  ))) return

  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  panelPointerId = event.pointerId
  panelDragOffsetX = event.clientX - rect.left
  panelDragOffsetY = event.clientY - rect.top
  isPanelPositionManual.value = true
  isDraggingPanel.value = true
  event.preventDefault()
}

const movePanel = (event: PointerEvent) => {
  if (!isDraggingPanel.value || (panelPointerId !== null && event.pointerId !== panelPointerId)) return
  applyPanelPosition(event.clientX - panelDragOffsetX, event.clientY - panelDragOffsetY)
  event.preventDefault()
}

const stopPanelDrag = (event?: PointerEvent) => {
  if (!isDraggingPanel.value || (event && panelPointerId !== null && event.pointerId !== panelPointerId)) return
  isDraggingPanel.value = false
  panelPointerId = null
  keepManualPanelPositionInViewport()
}

watchEffect(onCleanup => {
  const session = activeSelectionSession.value
  const container = containerRef.value
  if ((!showToolbar.value && !showPanel.value) || !session || !container) return

  const updatePosition = () => {
    if (isPanelPositionManual.value && showPanel.value) {
      keepManualPanelPositionInViewport()
      return
    }
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
      if (isPanelPositionManual.value && showPanel.value) {
        keepManualPanelPositionInViewport()
        return
      }
      applyPanelPosition(x, y)
      container.style.visibility = middlewareData.hide?.referenceHidden ? 'hidden' : 'visible'
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

const availableAnalysisServices = computed(() => (
  availableServices.value.filter(service => (
    servicesType.isAI(service.value) && isServiceConfigured(service.value, config)
  ))
))

const panelServices = computed(() => (
  panelMode.value === 'analysis' ? availableAnalysisServices.value : availableServices.value
))

const panelTitle = computed(() => (
  panelMode.value === 'analysis' ? t('selection.analysisTitle') : t('selection.title')
))

const shouldShowOriginal = computed(() => (
  panelMode.value === 'analysis' || config.selectionTranslatorMode === 'bilingual'
))

const canRunCurrentMode = computed(() => (
  panelMode.value === 'translation' || availableAnalysisServices.value.length > 0
))

const analysisCopyText = computed(() => {
  const result = analysisResult.value
  if (!result) return ''
  const sections: string[] = []
  const addSection = (label: string, value: string) => {
    if (value) sections.push(`${label}\n${value}`)
  }
  const addItems = (label: string, items: Array<{ title: string; explanation: string }>) => {
    if (!items.length) return
    sections.push(`${label}\n${items.map(item => (
      item.title ? `- ${item.title}: ${item.explanation}` : `- ${item.explanation}`
    )).join('\n')}`)
  }

  if (result.kind === 'term') {
    sections.push([result.term || selectedText.value, result.pronunciation, result.partOfSpeech, result.difficulty]
      .filter(Boolean)
      .join(' · '))
  }
  addSection(t('selection.analysis'), result.summary)
  addSection(t('selection.definition'), result.definition)
  addSection(t('selection.contextualMeaning'), result.contextualMeaning)
  addSection(t('selection.example'), result.example)
  addSection(t('selection.translation'), result.translation)
  addSection(t('selection.overview'), result.overview)
  addSection(t('selection.structure'), result.structure)
  addItems(t('selection.grammarPoints'), result.grammarPoints)
  addItems(t('selection.expressions'), result.expressions)
  if (result.notes.length) sections.push(`${t('selection.notes')}\n${result.notes.map(note => `- ${note}`).join('\n')}`)
  return sections.filter(Boolean).join('\n\n')
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
  stopPanelDrag()
  isPanelPositionManual.value = false
  cancelActiveTranslation()
  stopAudio()
  showToolbar.value = false
  showPanel.value = false
  translationResult.value = ''
  analysisResult.value = null
  error.value = ''
}

const collectSurroundingContext = (range: Range, selected: string): string => {
  const container = (range as Partial<Range>).commonAncestorContainer
  const start = container instanceof Element
    ? container
    : container?.parentElement
  const block = start?.closest('p, li, blockquote, dd, dt, figcaption, h1, h2, h3, h4, h5, h6')
  const text = (block?.textContent || '').replace(/\s+/g, ' ').trim()
  if (!text || text === selected) return ''
  if (text.length <= 1600) return text

  const selectionIndex = text.indexOf(selected)
  if (selectionIndex < 0) return text.slice(0, 1600)
  const startIndex = Math.max(0, selectionIndex - 600)
  return text.slice(startIndex, startIndex + 1600)
}

const commitSelectionSession = (text: string, range: Range, event?: MouseEvent) => {
  stopPanelDrag()
  isPanelPositionManual.value = false
  cancelActiveTranslation()
  stopAudio()
  const session: SelectionSession = {
    id: ++nextSelectionSessionId,
    text,
    range,
    anchor: createPointerAnchor(event) ?? range,
    context: document.title,
    surroundingContext: collectSurroundingContext(range, text),
  }
  activeSelectionSession.value = session
  selectedText.value = text
  translationResult.value = ''
  analysisResult.value = null
  panelMode.value = 'translation'
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

const getAnalysis = async () => {
  const session = activeSelectionSession.value
  if (!session) return
  if (!availableAnalysisServices.value.some(service => service.value === activeService.value)) {
    error.value = t('selection.analysisRequiresAi')
    return
  }

  cancelActiveTranslation()
  const requestId = ++activeTranslationRequestId
  const controller = new AbortController()
  activeTranslationController = controller
  isLoading.value = true
  error.value = ''

  try {
    const result = await analyzeSelectionText({
      text: session.text,
      surroundingContext: session.surroundingContext,
      pageTitle: session.context,
    }, { signal: controller.signal })
    if (
      controller.signal.aborted
      || requestId !== activeTranslationRequestId
      || activeSelectionSession.value?.id !== session.id
    ) return
    analysisResult.value = result
  } catch (cause) {
    if (controller.signal.aborted || requestId !== activeTranslationRequestId || isTranslationCancelledError(cause)) return
    error.value = t('selection.analysisFailed')
    console.error('Selection analysis failed:', cause)
  } finally {
    if (requestId === activeTranslationRequestId) {
      activeTranslationController = null
      isLoading.value = false
    }
  }
}

const openTranslationPanel = () => {
  panelMode.value = 'translation'
  analysisResult.value = null
  showToolbar.value = false
  showPanel.value = true
  void getTranslation()
}

const openAnalysisPanel = () => {
  panelMode.value = 'analysis'
  translationResult.value = ''
  analysisResult.value = null
  error.value = ''
  showToolbar.value = false
  showPanel.value = true

  const configuredService = availableAnalysisServices.value.find(service => service.value === config.service)
    ?? availableAnalysisServices.value[0]
  if (!configuredService) {
    error.value = t('selection.analysisRequiresAi')
    return
  }
  activeService.value = configuredService.value
  if (config.service !== configuredService.value) {
    config.service = configuredService.value
    void saveConfig()
  }
  void getAnalysis()
}

const regenerateTranslation = () => {
  translationResult.value = ''
  void getTranslation(false)
}

const regenerateAnalysis = () => {
  analysisResult.value = null
  void getAnalysis()
}

const regenerateCurrentResult = () => {
  if (panelMode.value === 'analysis') regenerateAnalysis()
  else regenerateTranslation()
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
  regenerateCurrentResult()
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
    if (isEventInsideSelectionUi(event) || isInteractingWithSelectionUi.value) {
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
  window.addEventListener('pointermove', movePanel)
  window.addEventListener('pointerup', stopPanelDrag)
  window.addEventListener('pointercancel', stopPanelDrag)
  window.addEventListener('resize', keepManualPanelPositionInViewport)
})

onBeforeUnmount(() => {
  cancelActiveTranslation()
  stopAudio()
  document.removeEventListener('mousedown', mouseDownHandler)
  document.removeEventListener('mouseup', mouseUpHandler)
  document.removeEventListener('selectionchange', selectionChangeHandler)
  document.removeEventListener('click', clickHandler)
  window.removeEventListener('pointermove', movePanel)
  window.removeEventListener('pointerup', stopPanelDrag)
  window.removeEventListener('pointercancel', stopPanelDrag)
  window.removeEventListener('resize', keepManualPanelPositionInViewport)
  if (systemThemeHandler) window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeHandler)
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  if (copyTimer !== null) window.clearTimeout(copyTimer)
})
</script>
