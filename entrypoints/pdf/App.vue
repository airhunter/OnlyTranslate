<template>
  <main class="pdf-shell" :data-display="displayMode">
    <header class="pdf-toolbar">
      <div class="pdf-brand">
        <span class="pdf-brand__mark">只译</span>
        <div>
          <strong>{{ documentTitle }}</strong>
          <span>{{ sourceLabel }}</span>
        </div>
      </div>

      <div v-if="pageCount" class="pdf-pagination" :aria-label="t('pdf.pageNavigation')">
        <button :disabled="pageNumber <= 1 || loadingPage" @click="goToPage(pageNumber - 1)">‹</button>
        <label>
          <input
            :value="pageNumber"
            type="number"
            min="1"
            :max="pageCount"
            @change="goToPage(Number(($event.target as HTMLInputElement).value))"
          />
          <span>/ {{ pageCount }}</span>
        </label>
        <button :disabled="pageNumber >= pageCount || loadingPage" @click="goToPage(pageNumber + 1)">›</button>
      </div>

      <div class="pdf-actions">
        <select v-model="displayMode" :aria-label="t('pdf.displayMode')">
          <option value="semantic">{{ t('pdf.displaySemantic') }}</option>
          <option value="overlay">{{ t('pdf.displayOverlay') }}</option>
          <option value="bilingual">{{ t('pdf.displayBilingual') }}</option>
          <option value="original">{{ t('pdf.displayOriginal') }}</option>
          <option value="translation">{{ t('pdf.displayTranslation') }}</option>
        </select>
        <button :disabled="!pageCount" @click="printCurrentPage">{{ t('pdf.printPage') }}</button>
        <button @click="chooseLocalFile">{{ t('pdf.openLocal') }}</button>
        <input ref="fileInput" class="visually-hidden" type="file" accept=".pdf,application/pdf" @change="openLocalFile" />
      </div>
    </header>

    <section v-if="!pageCount && !loadingDocument" class="pdf-empty">
      <div class="pdf-empty__icon">PDF</div>
      <h1>{{ t('pdf.emptyTitle') }}</h1>
      <p>{{ errorMessage || t('pdf.emptyDescription') }}</p>
      <button @click="chooseLocalFile">{{ t('pdf.openLocal') }}</button>
    </section>

    <section v-else-if="loadingDocument" class="pdf-empty" role="status">
      <div class="pdf-spinner" />
      <h1>{{ t('pdf.loadingDocument') }}</h1>
      <p>{{ sourceLabel }}</p>
    </section>

    <section v-else class="pdf-workspace">
      <div ref="originalPanel" class="pdf-original-panel">
        <div v-if="displayMode === 'semantic'" class="pdf-semantic-status">
          <span>{{ t('pdf.semanticExperimental') }}</span>
          <strong v-if="loadingPage">{{ t('pdf.semanticAnalyzing') }}</strong>
          <strong v-else-if="layoutStatus.mode === 'semantic'">
            {{ t('pdf.semanticReady', { elapsed: layoutStatus.elapsedMs }) }}
          </strong>
          <strong v-else>{{ t('pdf.semanticFallbackShort') }}</strong>
        </div>
        <div v-if="displayMode === 'overlay'" class="pdf-overlay-status">
          <span>{{ t('pdf.layoutOverlay') }}</span>
          <strong v-if="translationStatus.running">
            {{ t('pdf.translating', translationStatus) }}
          </strong>
          <strong v-else>
            {{ t('pdf.translationComplete', translationStatus) }}
          </strong>
          <small>{{ translationNotice || t('pdf.layoutOverlayHint') }}</small>
        </div>
        <div v-if="loadingPage" class="pdf-page-loading">{{ t('pdf.loadingPage') }}</div>
        <div
          class="pdf-page"
          :style="{ width: `${renderedWidth}px`, height: `${renderedHeight}px` }"
        >
          <canvas ref="canvas" />
          <button
            v-for="block in blocks"
            :key="block.id"
            type="button"
            class="pdf-source-region"
            :data-block-id="block.id"
            :class="{ 'pdf-source-region--active': isSourceRegionActive(block) }"
            :style="sourceRegionStyle(block)"
            :aria-label="block.text"
            @mouseenter="highlightedBlockId = block.id"
            @mouseleave="highlightedBlockId = ''"
            @focus="highlightedBlockId = block.id"
          />
          <div ref="overlayLayer" class="pdf-translation-overlay" aria-live="polite">
            <div
              v-for="block in translatedOverlayBlocks"
              :key="`overlay-${block.id}`"
              class="pdf-translation-overlay__block"
              :class="`pdf-translation-overlay__block--${block.kind}`"
              :style="overlayBlockStyle(block)"
              :title="block.text"
            >
              <span
                class="pdf-translation-overlay__text"
                :data-base-size="overlayFontSize(block)"
              >{{ block.translation }}</span>
            </div>
          </div>
        </div>
      </div>

      <article class="pdf-translation-panel">
        <header class="translation-heading">
          <div>
            <span>{{ t('pdf.readingFlow') }}</span>
            <strong v-if="translationStatus.running">
              {{ t('pdf.translating', translationStatus) }}
            </strong>
            <strong v-else>
              {{ t('pdf.translationComplete', translationStatus) }}
            </strong>
          </div>
          <span v-if="translationNotice" class="translation-notice">{{ translationNotice }}</span>
        </header>

        <div class="pdf-block-list">
          <template v-for="block in readingBlocks" :key="block.id">
            <figure
              v-if="block.kind === 'visual'"
              class="pdf-block pdf-block--visual"
              :class="{ 'pdf-block--active': highlightedBlockId === block.id }"
              @click="focusBlock(block)"
            >
              <img v-if="block.imageUrl" :src="block.imageUrl" :alt="visualBlockLabel(block)" />
              <figcaption>{{ visualBlockLabel(block) }}</figcaption>
            </figure>
            <section
              v-else
              class="pdf-block"
              :class="[`pdf-block--${block.kind}`, { 'pdf-block--active': highlightedBlockId === block.id }]"
              @mouseenter="highlightedBlockId = block.id"
              @mouseleave="highlightedBlockId = ''"
              @click="focusBlock(block)"
            >
              <template v-if="displayMode === 'semantic'">
                <p v-if="block.translation" class="pdf-block__translation pdf-block__translation--semantic">{{ block.translation }}</p>
                <p v-else-if="!block.translatable" class="pdf-block__semantic-source">{{ block.text }}</p>
                <div v-else-if="translationStatus.running" class="pdf-block__pending" />
                <p v-else class="pdf-block__semantic-source">{{ block.text }}</p>
                <details class="pdf-block__source-details">
                  <summary>{{ t('pdf.showSource') }}</summary>
                  <p class="pdf-block__original">{{ block.text }}</p>
                </details>
              </template>
              <template v-else>
                <p class="pdf-block__original">{{ block.text }}</p>
                <p v-if="block.translation" class="pdf-block__translation">{{ block.translation }}</p>
                <p v-else-if="block.kind === 'formula'" class="pdf-block__protected">{{ t('pdf.formulaProtected') }}</p>
                <div v-else-if="translationStatus.running" class="pdf-block__pending" />
              </template>
            </section>
          </template>
          <p v-if="!readingBlocks.length" class="pdf-no-text">{{ t('pdf.noText') }}</p>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfig } from '@/composables/useConfig'
import { isServiceConfigured } from '@/entrypoints/utils/option'
import { resolveLocale } from '@/entrypoints/utils/i18n'
import type { PdfTextBlock } from './layout'
import { selectPdfTranslationBlocksWithOptions } from './overlay'
import { PdfReaderController, PdfSourceError } from './readerController'
import { PdfTranslationCoordinator, type PdfTranslationStatus } from './translationCoordinator'
import { getRequestedPdfSource } from './url'

interface PdfBlockView extends PdfTextBlock {
  translation?: string
}

const { t, locale } = useI18n()
const { config, loadConfig } = useConfig()
const controller = new PdfReaderController()
const canvas = ref<HTMLCanvasElement>()
const originalPanel = ref<HTMLElement>()
const overlayLayer = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()
const sourceUrl = ref(getRequestedPdfSource(location.search))
const sourceLabel = ref(sourceUrl.value ?? '')
const documentTitle = computed(() => {
  if (!sourceLabel.value) return t('pdf.title')
  try {
    const url = new URL(sourceLabel.value)
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || url.hostname)
  }
  catch {
    return sourceLabel.value
  }
})
type PdfDisplayMode = 'semantic' | 'overlay' | 'original' | 'bilingual' | 'translation'

const displayMode = ref<PdfDisplayMode>('semantic')
const loadingDocument = ref(false)
const loadingPage = ref(false)
const errorMessage = ref('')
const pageNumber = ref(1)
const pageCount = ref(0)
const renderedWidth = ref(0)
const renderedHeight = ref(0)
const blocks = ref<PdfBlockView[]>([])
const highlightedBlockId = ref('')
const translationNotice = ref('')
const layoutStatus = reactive<{ mode: 'heuristic' | 'semantic'; elapsedMs: number; error: string }>({
  mode: 'heuristic',
  elapsedMs: 0,
  error: '',
})
const translationBlocks = computed(() => selectPdfTranslationBlocksWithOptions(blocks.value, {
  semanticLayout: layoutStatus.mode === 'semantic',
}) as PdfBlockView[])
const readingBlocks = computed(() => {
  if (displayMode.value !== 'semantic') return translationBlocks.value
  return blocks.value.filter(block => (
    !block.hiddenInReadingFlow
    && !['figure-text', 'table-text'].includes(block.kind)
  ))
})
const translatedOverlayBlocks = computed(() => translationBlocks.value.filter(block => block.translation))
const translationStatus = reactive<PdfTranslationStatus>({ total: 0, completed: 0, failed: 0, running: false })
let renderGeneration = 0
const coordinator = new PdfTranslationCoordinator({
  onTranslation: (blockId, translation) => {
    const block = blocks.value.find(item => item.id === blockId)
    if (block) block.translation = translation
    void nextTick(fitOverlayText)
  },
  onStatus: status => Object.assign(translationStatus, status),
})

async function openRemote(source: string): Promise<void> {
  loadingDocument.value = true
  errorMessage.value = ''
  sourceLabel.value = source
  try {
    pageCount.value = await controller.openRemote(source)
    pageNumber.value = 1
    loadingDocument.value = false
    await nextTick()
    await renderCurrentPage()
  }
  catch (error) {
    pageCount.value = 0
    errorMessage.value = formatSourceError(error)
  }
  finally {
    loadingDocument.value = false
  }
}

async function openLocalFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  loadingDocument.value = true
  errorMessage.value = ''
  sourceUrl.value = undefined
  sourceLabel.value = file.name
  try {
    pageCount.value = await controller.openFile(file)
    pageNumber.value = 1
    loadingDocument.value = false
    await nextTick()
    await renderCurrentPage()
  }
  catch (error) {
    pageCount.value = 0
    errorMessage.value = formatSourceError(error)
  }
  finally {
    loadingDocument.value = false
  }
}

async function renderCurrentPage(): Promise<void> {
  const generation = ++renderGeneration
  await nextTick()
  if (!canvas.value || !originalPanel.value) return
  loadingPage.value = true
  translationNotice.value = ''
  coordinator.cancel()
  blocks.value = []
  try {
    const availableWidth = Math.max(360, originalPanel.value.clientWidth - 40)
    const rendered = await controller.renderPage(pageNumber.value, canvas.value, availableWidth, {
      semanticLayout: displayMode.value === 'semantic',
    })
    if (generation !== renderGeneration) return
    pageNumber.value = rendered.pageNumber
    pageCount.value = rendered.pageCount
    renderedWidth.value = rendered.width
    renderedHeight.value = rendered.height
    blocks.value = rendered.blocks.map(block => ({ ...block }))
    layoutStatus.mode = rendered.layoutMode
    layoutStatus.elapsedMs = rendered.layoutElapsedMs ?? 0
    layoutStatus.error = rendered.layoutError ?? ''
    if (displayMode.value === 'semantic' && rendered.layoutMode !== 'semantic') {
      translationNotice.value = t('pdf.semanticFallback', { error: rendered.layoutError || t('pdf.semanticUnknownError') })
    }
    void startTranslation()
  }
  catch (error) {
    if (generation !== renderGeneration) return
    errorMessage.value = formatSourceError(error)
  }
  finally {
    if (generation === renderGeneration) loadingPage.value = false
  }
}

async function startTranslation(): Promise<void> {
  if (!config.value.on) {
    translationNotice.value = t('pdf.translationDisabled')
    return
  }
  if (!isServiceConfigured(config.value.service, config.value)) {
    translationNotice.value = t('pdf.serviceNotConfigured')
    return
  }
  const context = `${documentTitle.value} · ${t('pdf.pageContext', { page: pageNumber.value })}`
  await coordinator.start(translationBlocks.value, context, sourceUrl.value)
}

function overlayFontSize(block: PdfBlockView): number {
  const base = block.fontHeight ?? (block.kind === 'heading' ? 15 : 10)
  return Math.max(block.kind === 'caption' ? 7.5 : 8, base * (block.kind === 'heading' ? 1.02 : 0.96))
}

function overlayBlockStyle(block: PdfBlockView): Record<string, string> {
  if (!renderedWidth.value || !renderedHeight.value) return {}
  const horizontalPadding = 2
  const verticalPadding = Math.max(2, Math.min(6, (block.fontHeight ?? 10) * 0.24))
  return {
    left: `calc(${block.x / renderedWidth.value * 100}% - ${horizontalPadding}px)`,
    top: `calc(${block.y / renderedHeight.value * 100}% - ${verticalPadding}px)`,
    width: `calc(${block.width / renderedWidth.value * 100}% + ${horizontalPadding * 2}px)`,
    height: `calc(${block.height / renderedHeight.value * 100}% + ${verticalPadding * 2}px)`,
    '--pdf-overlay-font-size': `${overlayFontSize(block)}px`,
  }
}

function fitOverlayText(): void {
  requestAnimationFrame(() => {
    overlayLayer.value?.querySelectorAll<HTMLElement>('.pdf-translation-overlay__text').forEach(text => {
      const container = text.parentElement
      if (!container) return
      const baseSize = Number(text.dataset.baseSize) || 10
      const minimumSize = Math.max(6.5, baseSize * 0.68)
      let fontSize = baseSize
      text.style.fontSize = `${fontSize}px`
      while (
        fontSize > minimumSize
        && (text.scrollHeight > container.clientHeight + 1 || text.scrollWidth > container.clientWidth + 1)
      ) {
        fontSize -= 0.5
        text.style.fontSize = `${fontSize}px`
      }
      text.classList.toggle(
        'pdf-translation-overlay__text--clipped',
        text.scrollHeight > container.clientHeight + 1 || text.scrollWidth > container.clientWidth + 1,
      )
    })
  })
}

function goToPage(value: number): void {
  const nextPage = Math.min(pageCount.value, Math.max(1, Math.trunc(value || 1)))
  if (nextPage === pageNumber.value || loadingPage.value) return
  pageNumber.value = nextPage
  void renderCurrentPage()
}

function sourceRegionStyle(block: PdfBlockView): Record<string, string> {
  if (!renderedWidth.value || !renderedHeight.value) return {}
  return {
    left: `${block.x / renderedWidth.value * 100}%`,
    top: `${block.y / renderedHeight.value * 100}%`,
    width: `${block.width / renderedWidth.value * 100}%`,
    height: `${block.height / renderedHeight.value * 100}%`,
  }
}

function isSourceRegionActive(block: PdfBlockView): boolean {
  return highlightedBlockId.value === block.id
}

function focusBlock(block: PdfBlockView): void {
  highlightedBlockId.value = block.id
  originalPanel.value
    ?.querySelector<HTMLElement>(`.pdf-source-region[data-block-id="${CSS.escape(block.id)}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function visualBlockLabel(block: PdfBlockView): string {
  const key = block.visualKind === 'table'
    ? 'pdf.visualTable'
    : block.visualKind === 'chart'
      ? 'pdf.visualChart'
      : block.visualKind === 'formula'
        ? 'pdf.visualFormula'
        : block.visualKind === 'algorithm'
          ? 'pdf.visualAlgorithm'
          : 'pdf.visualImage'
  return t(key)
}

function chooseLocalFile(): void {
  fileInput.value?.click()
}

function printCurrentPage(): void {
  window.print()
}

function formatSourceError(error: unknown): string {
  if (error instanceof PdfSourceError) {
    const keys = {
      LOAD_FAILED: 'pdf.loadFailed',
      NOT_PDF: 'pdf.notPdf',
      PASSWORD_REQUIRED: 'pdf.passwordRequired',
    } as const
    return t(keys[error.code])
  }
  return error instanceof Error ? error.message : t('pdf.loadFailed')
}

onMounted(async () => {
  await loadConfig()
  locale.value = resolveLocale(config.value.uiLocale || 'auto')
  if (sourceUrl.value) await openRemote(sourceUrl.value)
})

watch(displayMode, (nextMode, previousMode) => {
  if (!pageCount.value || loadingPage.value) return
  const semanticBoundaryChanged = (nextMode === 'semantic') !== (previousMode === 'semantic')
  if (semanticBoundaryChanged) void renderCurrentPage()
})

onBeforeUnmount(() => {
  renderGeneration += 1
  coordinator.cancel()
  controller.close()
})
</script>
