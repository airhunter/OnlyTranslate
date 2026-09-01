<template>
  <main class="pdf-shell" :data-display="displayMode" :data-preview="previewOpen" :style="readerStyle">
    <header class="reader-toolbar pdf-reader-toolbar">
      <button class="icon-button" :aria-label="t('ebook.backToLibrary')" @click="openLibrary">←</button>
      <div class="reader-title pdf-reader-title">
        <strong>{{ documentTitle }}</strong>
        <span>{{ sourceLabel }}</span>
      </div>

      <nav v-if="pageCount" class="chapter-toolbar-navigation pdf-page-navigation" :aria-label="t('pdf.pageNavigation')">
        <button
          class="chapter-toolbar-button"
          :title="`${t('pdf.previousPage')} (←)`"
          :aria-label="`${t('pdf.previousPage')} (←)`"
          aria-keyshortcuts="ArrowLeft"
          :disabled="pageNumber <= 1 || loadingPage"
          @click="goToPage(pageNumber - 1)"
        >
          <span aria-hidden="true">‹</span>
          <span class="chapter-toolbar-button__label">{{ t('pdf.previousPage') }}</span>
        </button>
        <label class="pdf-page-field">
          <input
            :value="pageNumber"
            type="number"
            min="1"
            :max="pageCount"
            @change="goToPage(Number(($event.target as HTMLInputElement).value))"
          />
          <span>/ {{ pageCount }}</span>
        </label>
        <button
          class="chapter-toolbar-button"
          :title="`${t('pdf.nextPage')} (→)`"
          :aria-label="`${t('pdf.nextPage')} (→)`"
          aria-keyshortcuts="ArrowRight"
          :disabled="pageNumber >= pageCount || loadingPage"
          @click="goToPage(pageNumber + 1)"
        >
          <span class="chapter-toolbar-button__label">{{ t('pdf.nextPage') }}</span>
          <span aria-hidden="true">›</span>
        </button>
      </nav>

      <div v-if="pageCount" class="translation-status" :class="{ 'translation-status--warning': translationNotice }">
        <span v-if="translationNotice">{{ translationNotice }}</span>
        <span v-else-if="translationStatus.running">{{ t('pdf.translating', translationStatus) }}</span>
        <span v-else>{{ t('pdf.translationComplete', translationStatus) }}</span>
      </div>

      <div class="toolbar-controls pdf-toolbar-controls">
        <button
          v-if="pageCount && !libraryBook"
          class="primary-button primary-button--toolbar"
          :disabled="addingToLibrary"
          @click="addToLibrary"
        >{{ addingToLibrary ? t('common.processing') : t('pdf.addToLibrary') }}</button>
        <button v-else-if="pageCount" class="control-button" @click="openLibrary">{{ t('pdf.inLibrary') }}</button>
        <button v-if="pageCount" class="control-button" :title="t('ebook.displayMode')" @click="cycleDisplayMode">
          {{ t('ebook.displayMode') }} · {{ displayModeLabel }}
        </button>
        <button class="control-button" @click="cycleTheme">{{ t('ebook.theme') }} · {{ themeLabel }}</button>
        <label>{{ t('ebook.fontSize') }}
          <input v-model.number="readerSettings.fontScale" type="range" min="70" max="180" step="5" @change="savePdfReaderSettings" />
        </label>
        <label>{{ t('ebook.lineHeight') }}
          <input v-model.number="readerSettings.lineHeight" type="range" min="1.2" max="2.6" step="0.1" @change="savePdfReaderSettings" />
        </label>
        <button
          v-if="pageCount && displayMode !== 'original' && displayMode !== 'overlay'"
          class="control-button preview-toggle"
          :class="{ 'control-button--active': previewOpen }"
          @click="previewOpen = !previewOpen"
        >{{ previewOpen ? t('pdf.hidePreview') : t('pdf.showPreview') }}</button>

        <details class="reader-shortcuts">
          <summary class="icon-button reader-shortcuts__trigger" :title="t('ebook.keyboardShortcuts')" :aria-label="t('ebook.keyboardShortcuts')">
            <svg class="reader-shortcuts__icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M18 12.5h.01M7 16h10" />
            </svg>
          </summary>
          <div class="reader-shortcuts__panel">
            <strong>{{ t('ebook.keyboardShortcuts') }}</strong>
            <dl>
              <div class="reader-shortcut-row"><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>{{ t('pdf.shortcutPageSwitch') }}</dd></div>
              <div class="reader-shortcut-row"><dt><kbd>PgUp</kbd><kbd>PgDn</kbd></dt><dd>{{ t('ebook.shortcutPageNavigation') }}</dd></div>
              <div class="reader-shortcut-row"><dt><kbd>Space</kbd></dt><dd>{{ t('ebook.shortcutScrollDown') }}</dd></div>
              <div class="reader-shortcut-row"><dt><kbd>Shift</kbd><span aria-hidden="true">+</span><kbd>Space</kbd></dt><dd>{{ t('ebook.shortcutScrollUp') }}</dd></div>
            </dl>
          </div>
        </details>

        <details class="reader-more-actions">
          <summary class="icon-button reader-more-actions__trigger" :title="t('popup.moreActions')" :aria-label="t('popup.moreActions')">⋯</summary>
          <div class="reader-more-actions__panel">
            <button v-if="pageCount" :disabled="exportingOriginal" @click="exportOriginalPdf">
              {{ exportingOriginal ? t('common.processing') : t('ebook.exportOriginal') }}
            </button>
            <button @click="openLibrary">{{ t('ebook.libraryTitle') }}</button>
            <button @click="chooseLocalFile">{{ t('pdf.openLocal') }}</button>
            <button v-if="pageCount" @click="setOverlayMode">{{ t('pdf.displayOverlay') }}</button>
            <button :disabled="layoutModelState.busy" @click="toggleLayoutModel">
              {{ layoutModelActionLabel }}
            </button>
          </div>
        </details>
        <input ref="fileInput" class="visually-hidden" type="file" accept=".pdf,application/pdf" @change="openLocalFile" />
      </div>
    </header>

    <div v-if="libraryNotice" class="pdf-library-notice" role="status">{{ libraryNotice }}</div>
    <div v-if="showLayoutModelNotice" class="pdf-model-notice" role="status">
      <span>{{ layoutModelNotice }}</span>
      <button :disabled="layoutModelState.busy" @click="installLayoutModel">
        {{ layoutModelActionLabel }}
      </button>
    </div>

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

      <article ref="translationPanel" class="pdf-translation-panel">
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
                <p class="pdf-block__original pdf-block__original--semantic">{{ block.text }}</p>
                <p v-if="block.translation" class="pdf-block__translation pdf-block__translation--semantic">{{ block.translation }}</p>
                <div v-else-if="block.translatable && translationStatus.running" class="pdf-block__pending" />
              </template>
              <template v-else-if="displayMode === 'translation'">
                <p v-if="block.translation" class="pdf-block__translation pdf-block__translation--semantic pdf-block__translation--only">{{ block.translation }}</p>
                <p v-else-if="shouldShowTranslationOnlySource(block, translationStatus.running)" class="pdf-block__original pdf-block__original--semantic">{{ block.text }}</p>
                <div v-else-if="translationStatus.running" class="pdf-block__pending" />
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
          <div v-else class="pdf-page-continuation">
            <button class="chapter-continuation__button" :disabled="loadingPage" @click="continuePdfReading">
              <span>{{ pageNumber < pageCount ? t('pdf.pageContext', { page: pageNumber + 1 }) : t('pdf.documentFinished') }}</span>
              <strong>{{ pageNumber < pageCount ? t('pdf.continueNextPage') : t('ebook.backToLibrary') }}</strong>
              <b aria-hidden="true">→</b>
            </button>
          </div>
        </div>
      </article>
    </section>

    <footer v-if="pageCount" class="reader-progress pdf-reader-progress">
      <span>{{ t('pdf.pageProgress', { page: pageNumber, total: pageCount }) }}</span>
      <div class="reader-progress__track"><span :style="{ width: `${readingProgressPercent}%` }" /></div>
      <span>{{ readingProgressPercent }}%</span>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfig } from '@/composables/useConfig'
import { useTheme } from '@/composables/useTheme'
import { isServiceConfigured } from '@/entrypoints/utils/option'
import { resolveLocale } from '@/entrypoints/utils/i18n'
import { EbookRepository } from '@/entrypoints/ebook/repository'
import { getEbookPageUrl } from '@/entrypoints/ebook/url'
import { downloadOriginalBook } from '@/entrypoints/ebook/export'
import { loadReaderSettings, saveReaderSettings } from '@/entrypoints/ebook/settings'
import type { EbookDisplayMode, EbookReaderSettings, EbookRecord } from '@/entrypoints/ebook/types'
import { getEbookFormat } from '@/entrypoints/ebook/types'
import { resolveReaderKeyboardAction } from '@/entrypoints/utils/readerKeyboard'
import type { PdfTextBlock } from './layout'
import {
  selectPdfReadingBlocks,
  selectPdfReadingTranslationBlocks,
  selectPdfTranslationBlocksWithOptions,
} from './overlay'
import { downloadRemotePdf, PdfReaderController, PdfSourceError } from './readerController'
import { addPdfToLibrary } from './library'
import { PdfTranslationCoordinator, type PdfTranslationStatus } from './translationCoordinator'
import { getRequestedPdfBookId, getRequestedPdfSource } from './url'
import {
  shouldShowTranslationOnlySource,
  shouldTranslatePdfMode,
  type PdfDisplayMode,
  usesPdfSemanticLayout,
} from './display'
import { PDF_LAYOUT_MODEL, pdfLayoutModelStore } from './layoutModelStore'

interface PdfBlockView extends PdfTextBlock {
  translation?: string
}

const { t, locale } = useI18n()
const { config, loadConfig } = useConfig()
useTheme(config)
const controller = new PdfReaderController()
const repository = new EbookRepository()
const canvas = ref<HTMLCanvasElement>()
const originalPanel = ref<HTMLElement>()
const translationPanel = ref<HTMLElement>()
const overlayLayer = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()
const sourceUrl = ref(getRequestedPdfSource(location.search))
const requestedBookId = getRequestedPdfBookId(location.search)
const sourceLabel = ref(sourceUrl.value ?? '')
const storedTitle = ref('')
const currentFile = ref<File>()
const libraryBook = ref<EbookRecord>()
const addingToLibrary = ref(false)
const exportingOriginal = ref(false)
const libraryNotice = ref('')
const documentTitle = computed(() => {
  if (storedTitle.value) return storedTitle.value
  if (!sourceLabel.value) return t('pdf.title')
  try {
    const url = new URL(sourceLabel.value)
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || url.hostname)
  }
  catch {
    return sourceLabel.value
  }
})
const displayMode = ref<PdfDisplayMode>('semantic')
const previewOpen = ref(true)
const readerSettings = reactive<Pick<EbookReaderSettings, 'fontScale' | 'lineHeight'>>({
  fontScale: 100,
  lineHeight: 1.7,
})
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
const layoutModelState = reactive({ installed: false, busy: false, progress: 0, error: '' })
let layoutModelDownloadAbort: AbortController | undefined
const usesSemanticLayout = computed(() => usesPdfSemanticLayout(displayMode.value))
const usesInstalledSemanticLayout = computed(() => usesSemanticLayout.value && layoutModelState.installed)
const showLayoutModelNotice = computed(() => Boolean(
  layoutModelState.error
  || (pageCount.value && usesSemanticLayout.value && !layoutModelState.installed),
))
const layoutModelNotice = computed(() => {
  if (layoutModelState.error) return t('pdf.semanticModelDownloadFailed', { error: layoutModelState.error })
  if (layoutModelState.busy) return t('pdf.semanticModelDownloading', { percent: layoutModelState.progress })
  return t('pdf.semanticModelOptional', { size: Math.ceil(PDF_LAYOUT_MODEL.size / 1024 / 1024) })
})
const layoutModelActionLabel = computed(() => layoutModelState.busy
  ? layoutModelState.installed
    ? t('pdf.semanticModelRemove')
    : t('pdf.semanticModelDownloading', { percent: layoutModelState.progress })
  : layoutModelState.installed
    ? t('pdf.semanticModelRemove')
    : t('pdf.semanticModelDownload', { size: Math.ceil(PDF_LAYOUT_MODEL.size / 1024 / 1024) }))
const displayModeLabel = computed(() => displayMode.value === 'semantic'
  ? t('ebook.displayBilingual')
  : displayMode.value === 'translation'
    ? t('ebook.displayTranslation')
    : displayMode.value === 'original'
      ? t('ebook.displayOriginal')
      : t('pdf.displayOverlay'))
const themeLabel = computed(() => t(`ebook.theme${config.value.theme === 'dark' ? 'Dark' : config.value.theme === 'light' ? 'Light' : 'Auto'}`))
const readerStyle = computed(() => ({
  '--reader-font-scale': String(readerSettings.fontScale / 100),
  '--reader-line-height': String(readerSettings.lineHeight),
}))
const readingProgressPercent = computed(() => pageCount.value
  ? Math.round(pageNumber.value / pageCount.value * 100)
  : 0)
const overlayTranslationBlocks = computed(() => selectPdfTranslationBlocksWithOptions(blocks.value, {
  semanticLayout: layoutStatus.mode === 'semantic',
}) as PdfBlockView[])
const readingBlocks = computed(() => {
  if (!usesSemanticLayout.value) return overlayTranslationBlocks.value
  return selectPdfReadingBlocks(blocks.value) as PdfBlockView[]
})
const translationBlocks = computed(() => (
  usesSemanticLayout.value
    ? selectPdfReadingTranslationBlocks(blocks.value)
    : overlayTranslationBlocks.value
) as PdfBlockView[])
const translatedOverlayBlocks = computed(() => overlayTranslationBlocks.value.filter(block => block.translation))
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
  currentFile.value = undefined
  storedTitle.value = ''
  try {
    libraryBook.value = await repository.findBookBySourceUrl(source)
    if (libraryBook.value) {
      await openStoredBook(libraryBook.value)
      return
    }
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
  storedTitle.value = ''
  currentFile.value = file
  libraryBook.value = undefined
  libraryNotice.value = ''
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

async function openStoredBook(book: EbookRecord): Promise<void> {
  if (getEbookFormat(book) !== 'pdf') {
    errorMessage.value = t('pdf.notPdf')
    return
  }
  loadingDocument.value = true
  errorMessage.value = ''
  libraryNotice.value = ''
  libraryBook.value = book
  storedTitle.value = book.title
  sourceLabel.value = book.sourceUrl || book.filename
  sourceUrl.value = book.sourceUrl
  currentFile.value = new File([book.fileBlob], book.filename, { type: book.fileBlob.type || 'application/pdf' })
  try {
    pageCount.value = await controller.openFile(currentFile.value)
    const progress = await repository.getProgress(book.bookId)
    pageNumber.value = Math.min(pageCount.value, Math.max(1, progress?.pageNumber ?? 1))
    await repository.markOpened(book.bookId)
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

async function addToLibrary(): Promise<void> {
  if (!pageCount.value || addingToLibrary.value) return
  addingToLibrary.value = true
  libraryNotice.value = ''
  try {
    const result = await addPdfToLibrary({
      repository,
      file: currentFile.value,
      sourceUrl: sourceUrl.value,
    })
    libraryBook.value = result.book
    currentFile.value = result.file
    storedTitle.value = result.book.title
    await savePdfProgress()
    libraryNotice.value = t(result.duplicate ? 'pdf.alreadyInLibrary' : 'pdf.addedToLibrary')
  }
  catch (error) {
    libraryNotice.value = error instanceof Error && error.message !== t('pdf.addToLibraryFailed')
      ? `${t('pdf.addToLibraryFailed')} ${error.message}`
      : t('pdf.addToLibraryFailed')
  }
  finally {
    addingToLibrary.value = false
  }
}

async function exportOriginalPdf(): Promise<void> {
  if (exportingOriginal.value) return
  exportingOriginal.value = true
  libraryNotice.value = ''
  try {
    const file = currentFile.value ?? (sourceUrl.value ? await downloadRemotePdf(sourceUrl.value) : undefined)
    if (!file) throw new Error(t('ebook.exportFailed'))
    currentFile.value = file
    downloadOriginalBook({
      filename: libraryBook.value?.filename || file.name,
      title: libraryBook.value?.title || documentTitle.value,
      fileBlob: libraryBook.value?.fileBlob || file,
    })
  }
  catch {
    libraryNotice.value = t('ebook.exportFailed')
  }
  finally {
    exportingOriginal.value = false
  }
}

function openLibrary(): void {
  window.location.href = getEbookPageUrl()
}

async function savePdfProgress(): Promise<void> {
  if (!libraryBook.value || !pageCount.value) return
  await repository.saveProgress({
    bookId: libraryBook.value.bookId,
    pageNumber: pageNumber.value,
    percentage: pageCount.value <= 1 ? 1 : (pageNumber.value - 1) / (pageCount.value - 1),
    updatedAt: Date.now(),
  })
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
    const availableWidth = Math.max(240, originalPanel.value.clientWidth - 42)
    const rendered = await controller.renderPage(pageNumber.value, canvas.value, availableWidth, {
      semanticLayout: usesInstalledSemanticLayout.value,
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
    if (displayMode.value === 'semantic' && layoutModelState.installed && rendered.layoutMode !== 'semantic') {
      translationNotice.value = t('pdf.semanticFallback', { error: rendered.layoutError || t('pdf.semanticUnknownError') })
    }
    void savePdfProgress()
    if (shouldTranslatePdfMode(displayMode.value)) void startTranslation()
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
  void renderCurrentPage().then(resetReaderScroll)
}

function continuePdfReading(): void {
  if (pageNumber.value < pageCount.value) {
    goToPage(pageNumber.value + 1)
    return
  }
  openLibrary()
}

function resetReaderScroll(): void {
  if (originalPanel.value) originalPanel.value.scrollTop = 0
  if (translationPanel.value) translationPanel.value.scrollTop = 0
}

function scrollReaderByViewport(direction: -1 | 1): boolean {
  const panel = displayMode.value === 'original' || displayMode.value === 'overlay' || !translationPanel.value
    ? originalPanel.value
    : translationPanel.value
  if (!panel || panel.clientHeight <= 0) return false
  const distance = Math.max(1, Math.round(panel.clientHeight * 0.9))
  const maxScrollTop = Math.max(0, panel.scrollHeight - panel.clientHeight)
  panel.scrollTop = Math.min(maxScrollTop, Math.max(0, panel.scrollTop + direction * distance))
  return true
}

function handleReaderKeyDown(event: KeyboardEvent): void {
  if (!pageCount.value) return
  const action = resolveReaderKeyboardAction(event)
  if (!action) return
  if (action === 'previous') {
    if (pageNumber.value <= 1 || loadingPage.value) return
    event.preventDefault()
    goToPage(pageNumber.value - 1)
    return
  }
  if (action === 'next') {
    if (pageNumber.value >= pageCount.value || loadingPage.value) return
    event.preventDefault()
    goToPage(pageNumber.value + 1)
    return
  }
  if (scrollReaderByViewport(action === 'page-up' ? -1 : 1)) event.preventDefault()
}

function cycleDisplayMode(): void {
  const modes: PdfDisplayMode[] = ['semantic', 'translation', 'original']
  const current = modes.indexOf(displayMode.value)
  displayMode.value = current < 0 ? modes[0] : modes[(current + 1) % modes.length]
  void savePdfReaderSettings()
}

function setOverlayMode(): void {
  displayMode.value = 'overlay'
}

async function installLayoutModel(): Promise<void> {
  if (layoutModelState.busy || layoutModelState.installed) return
  layoutModelState.busy = true
  layoutModelState.progress = 0
  layoutModelState.error = ''
  layoutModelDownloadAbort = new AbortController()
  try {
    await pdfLayoutModelStore.download((progress) => {
      layoutModelState.progress = progress.percent
    }, layoutModelDownloadAbort.signal)
    layoutModelState.installed = true
    layoutModelState.progress = 100
    controller.resetLayoutModel()
    if (pageCount.value && usesSemanticLayout.value) await renderCurrentPage()
  }
  catch (error) {
    if (layoutModelDownloadAbort.signal.aborted) return
    layoutModelState.error = error instanceof Error ? error.message : String(error)
  }
  finally {
    layoutModelState.busy = false
    layoutModelDownloadAbort = undefined
  }
}

async function removeLayoutModel(): Promise<void> {
  if (layoutModelState.busy || !layoutModelState.installed) return
  layoutModelState.busy = true
  layoutModelState.error = ''
  try {
    await pdfLayoutModelStore.remove()
    layoutModelState.installed = false
    layoutModelState.progress = 0
    controller.resetLayoutModel()
    if (pageCount.value && usesSemanticLayout.value) await renderCurrentPage()
  }
  catch (error) {
    layoutModelState.error = error instanceof Error ? error.message : String(error)
  }
  finally {
    layoutModelState.busy = false
  }
}

function toggleLayoutModel(): void {
  void (layoutModelState.installed ? removeLayoutModel() : installLayoutModel())
}

function cycleTheme(): void {
  const themes = ['auto', 'light', 'dark'] as const
  const current = themes.indexOf(config.value.theme as typeof themes[number])
  config.value.theme = themes[(current + 1) % themes.length]
}

async function savePdfReaderSettings(): Promise<void> {
  const sharedDisplayMode: EbookDisplayMode = displayMode.value === 'original'
    ? 'original'
    : displayMode.value === 'translation'
      ? 'translation'
      : 'bilingual'
  await saveReaderSettings({
    fontScale: readerSettings.fontScale,
    lineHeight: readerSettings.lineHeight,
    displayMode: sharedDisplayMode,
  })
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
  try {
    layoutModelState.installed = (await pdfLayoutModelStore.getStatus()).installed
  }
  catch (error) {
    layoutModelState.error = error instanceof Error ? error.message : String(error)
  }
  const sharedReaderSettings = await loadReaderSettings()
  readerSettings.fontScale = sharedReaderSettings.fontScale
  readerSettings.lineHeight = sharedReaderSettings.lineHeight
  displayMode.value = sharedReaderSettings.displayMode === 'original'
    ? 'original'
    : sharedReaderSettings.displayMode === 'translation'
      ? 'translation'
      : 'semantic'
  if (requestedBookId) {
    const book = await repository.getBook(requestedBookId)
    if (book) await openStoredBook(book)
    else errorMessage.value = t('pdf.libraryBookMissing')
  }
  else if (sourceUrl.value) await openRemote(sourceUrl.value)
  window.addEventListener('keydown', handleReaderKeyDown)
  window.addEventListener('pagehide', savePdfProgressImmediately)
})

watch(displayMode, (nextMode, previousMode) => {
  if (!pageCount.value || loadingPage.value) return
  const semanticBoundaryChanged = isSemanticMode(nextMode) !== isSemanticMode(previousMode)
  if (semanticBoundaryChanged) void renderCurrentPage()
})

watch(previewOpen, open => {
  if (open && pageCount.value && usesSemanticLayout.value && !loadingPage.value) void renderCurrentPage()
})

function isSemanticMode(mode: PdfDisplayMode): boolean {
  return usesPdfSemanticLayout(mode)
}

function savePdfProgressImmediately(): void {
  void savePdfProgress()
}

onBeforeUnmount(() => {
  renderGeneration += 1
  layoutModelDownloadAbort?.abort()
  coordinator.cancel()
  controller.close()
  pdfLayoutModelStore.close()
  repository.close()
  window.removeEventListener('keydown', handleReaderKeyDown)
  window.removeEventListener('pagehide', savePdfProgressImmediately)
})
</script>
