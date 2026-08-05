<template>
  <main
    v-if="!activeBook"
    class="library-shell"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div v-if="draggingFile" class="library-drop-overlay" role="status">
      <div class="empty-icon">EPUB</div>
      <strong>{{ t('ebook.dropActive') }}</strong>
    </div>
    <header class="library-header">
      <div>
        <p class="eyebrow">OnlyTranslate</p>
        <h1>{{ t('ebook.libraryTitle') }}</h1>
        <p class="subtitle">{{ t('ebook.librarySubtitle') }}</p>
      </div>
      <button class="primary-button" :disabled="importing" @click="chooseFile">
        {{ importing ? t('common.processing') : t('ebook.importEpub') }}
      </button>
      <input ref="fileInput" class="visually-hidden" type="file" accept=".epub,application/epub+zip" @change="importFile" />
    </header>

    <section v-if="errorMessage" class="notice notice--error">{{ errorMessage }}</section>
    <section v-if="books.length" class="book-grid" :aria-label="t('ebook.recentBooks')">
      <article v-for="item in books" :key="item.record.bookId" class="book-card">
        <div class="cover">
          <img v-if="coverUrls[item.record.bookId]" :src="coverUrls[item.record.bookId]" alt="" />
          <span v-else>{{ item.record.title.slice(0, 1).toLocaleUpperCase() }}</span>
        </div>
        <div class="book-info">
          <h2 :title="item.record.title">{{ item.record.title }}</h2>
          <p>{{ item.record.author || t('ebook.unknownAuthor') }}</p>
          <div class="progress-track"><span :style="{ width: `${Math.round(item.progress * 100)}%` }" /></div>
          <div class="book-meta">
            <span>{{ t('ebook.readingProgress', { percent: Math.round(item.progress * 100) }) }}</span>
            <time>{{ formatTime(item.record.lastOpenedAt) }}</time>
          </div>
          <div class="card-actions">
            <button class="primary-button primary-button--small" @click="openBook(item.record)">{{ t('ebook.continueReading') }}</button>
            <button class="danger-link" @click="removeBook(item.record)">{{ t('ebook.removeBook') }}</button>
          </div>
        </div>
      </article>
    </section>

    <section v-else-if="!loadingLibrary" class="empty-library">
      <div class="empty-icon">EPUB</div>
      <h2>{{ t('ebook.emptyTitle') }}</h2>
      <p>{{ t('ebook.emptyDescription') }}</p>
      <button class="primary-button" @click="chooseFile">{{ t('ebook.importEpub') }}</button>
      <span class="drop-hint">{{ t('ebook.dropHint') }}</span>
    </section>

    <footer class="storage-summary">
      <strong>{{ t('ebook.bookStorageUsage', { usage: formatBytes(bookStorageUsage) }) }}</strong>
      <span> · {{ t('ebook.storageUsage', { usage: formatBytes(storageEstimate.usage), quota: formatBytes(storageEstimate.quota) }) }}</span>
      <span v-if="storageEstimate.persisted"> · {{ t('ebook.persistentStorage') }}</span>
    </footer>
  </main>

  <main v-else class="reader-shell">
    <header class="reader-toolbar">
      <button class="icon-button" :aria-label="t('ebook.backToLibrary')" @click="closeBook">←</button>
      <div class="reader-title">
        <strong>{{ activeBook.title }}</strong>
        <span>{{ activeBook.author || t('ebook.unknownAuthor') }}</span>
      </div>
      <nav class="chapter-toolbar-navigation" :aria-label="t('ebook.chapterNavigation')">
        <button
          class="chapter-toolbar-button"
          :title="`${t('ebook.continuePreviousChapter')} (←)`"
          :aria-label="`${t('ebook.continuePreviousChapter')} (←)`"
          aria-keyshortcuts="ArrowLeft"
          :disabled="!chapterContinuation.previousHref || chapterNavigationPending"
          @click="continueToPreviousChapter"
        >
          <span aria-hidden="true">‹</span>
          <span class="chapter-toolbar-button__label">{{ t('ebook.previousChapter') }}</span>
        </button>
        <button
          class="chapter-toolbar-button"
          :title="`${t('ebook.continueNextChapter')} (→)`"
          :aria-label="`${t('ebook.continueNextChapter')} (→)`"
          aria-keyshortcuts="ArrowRight"
          :disabled="!chapterContinuation.nextHref || chapterNavigationPending"
          @click="continueToNextChapter"
        >
          <span class="chapter-toolbar-button__label">{{ t('ebook.nextChapter') }}</span>
          <span aria-hidden="true">›</span>
        </button>
      </nav>
      <div class="translation-status" :class="{ 'translation-status--warning': translationNotice }">
        <span v-if="translationNotice">{{ translationNotice }}</span>
        <span v-else-if="translationStatus.running">{{ t('ebook.translating', translationStatus) }}</span>
        <span v-else>{{ t('ebook.translationComplete', translationStatus) }}</span>
        <button v-if="translationStatus.failed" class="text-button" @click="retryFailed">{{ t('ebook.retryFailed') }}</button>
        <button v-if="needsEnable" class="text-button" @click="enableTranslation">{{ t('ebook.enableTranslation') }}</button>
        <button v-if="needsSettings" class="text-button" @click="openSettings">{{ t('common.settings') }}</button>
      </div>
      <div class="toolbar-controls">
        <button
          class="control-button"
          :title="t('ebook.displayMode')"
          @click="cycleDisplayMode"
        >
          {{ t('ebook.displayMode') }} · {{ displayModeLabel }}
        </button>
        <button
          class="control-button retranslate-button"
          :title="t('ebook.retranslateChapter')"
          :disabled="translationStatus.running || translationStatus.total === 0"
          @click="retranslateCurrentChapter"
        >
          <span aria-hidden="true">↻</span>
          <span class="retranslate-button__label">{{ t('ebook.retranslateChapter') }}</span>
        </button>
        <button class="control-button" @click="cycleTheme">{{ t('ebook.theme') }} · {{ themeLabel }}</button>
        <label>{{ t('ebook.fontSize') }}
          <input v-model.number="readerSettings.fontScale" type="range" min="70" max="180" step="5" @change="applyReaderSettings" />
        </label>
        <label>{{ t('ebook.lineHeight') }}
          <input v-model.number="readerSettings.lineHeight" type="range" min="1.2" max="2.6" step="0.1" @change="applyReaderSettings" />
        </label>
        <details class="reader-shortcuts">
          <summary
            class="icon-button reader-shortcuts__trigger"
            :title="t('ebook.keyboardShortcuts')"
            :aria-label="t('ebook.keyboardShortcuts')"
          >
            <svg class="reader-shortcuts__icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M18 12.5h.01M7 16h10" />
            </svg>
          </summary>
          <div class="reader-shortcuts__panel">
            <strong>{{ t('ebook.keyboardShortcuts') }}</strong>
            <dl>
              <div class="reader-shortcut-row">
                <dt><kbd>←</kbd><kbd>→</kbd></dt>
                <dd>{{ t('ebook.shortcutChapterNavigation') }}</dd>
              </div>
              <div class="reader-shortcut-row">
                <dt><kbd>PgUp</kbd><kbd>PgDn</kbd></dt>
                <dd>{{ t('ebook.shortcutPageNavigation') }}</dd>
              </div>
              <div class="reader-shortcut-row">
                <dt><kbd>Space</kbd></dt>
                <dd>{{ t('ebook.shortcutScrollDown') }}</dd>
              </div>
              <div class="reader-shortcut-row">
                <dt><kbd>Shift</kbd><span aria-hidden="true">+</span><kbd>Space</kbd></dt>
                <dd>{{ t('ebook.shortcutScrollUp') }}</dd>
              </div>
            </dl>
          </div>
        </details>
        <button
          class="icon-button"
          :class="{ 'icon-button--active': currentBookmark }"
          :title="currentBookmark ? t('ebook.removeCurrentBookmark') : t('ebook.addBookmark')"
          :aria-label="currentBookmark ? t('ebook.removeCurrentBookmark') : t('ebook.addBookmark')"
          :aria-pressed="Boolean(currentBookmark)"
          :disabled="activeBookIsTemporary"
          @click="toggleBookmark"
        >{{ currentBookmark ? '★' : '☆' }}</button>
      </div>
    </header>

    <div class="reader-layout">
      <aside class="reader-sidebar">
        <div class="sidebar-tabs">
          <button :class="{ active: sidebarTab === 'toc' }" @click="sidebarTab = 'toc'">{{ t('ebook.toc') }}</button>
          <button :class="{ active: sidebarTab === 'bookmarks' }" @click="sidebarTab = 'bookmarks'">{{ t('ebook.bookmarks') }}</button>
        </div>
        <nav v-if="sidebarTab === 'toc'" class="sidebar-list">
          <button
            v-for="item in flatToc"
            :key="`${item.href}-${item.depth}`"
            :class="{ 'current-chapter': isCurrentChapter(item.href) }"
            :aria-current="isCurrentChapter(item.href) ? 'location' : undefined"
            :style="{ paddingInlineStart: `${12 + item.depth * 14}px` }"
            @click="display(item.href)"
          >
            {{ item.label }}
          </button>
          <p v-if="!flatToc.length" class="sidebar-empty">{{ t('ebook.noToc') }}</p>
        </nav>
        <div v-else class="sidebar-list bookmark-list">
          <article v-for="bookmark in bookmarks" :key="bookmark.id">
            <button @click="display(bookmark.cfi)">
              <strong>{{ bookmark.chapterLabel || t('ebook.bookmark') }}</strong>
              <span>{{ bookmark.excerpt }}</span>
            </button>
            <button class="bookmark-delete" :aria-label="t('ebook.deleteBookmark')" @click="removeBookmark(bookmark.id)">×</button>
          </article>
          <p v-if="!bookmarks.length" class="sidebar-empty">{{ t('ebook.noBookmarks') }}</p>
        </div>
      </aside>

      <section class="reader-stage">
        <div ref="viewer" class="epub-viewer" />
        <Transition name="continuation">
          <div
            v-if="chapterContinuation.atChapterEnd"
            class="chapter-continuation chapter-continuation--single"
          >
            <button class="chapter-continuation__button" :disabled="chapterNavigationPending" @click="continueReading">
              <span>{{ chapterContinuation.nextHref ? t('ebook.continueNextChapter') : t('ebook.bookFinished') }}</span>
              <strong>{{ chapterContinuation.nextLabel || t('ebook.backToLibrary') }}</strong>
              <b aria-hidden="true">→</b>
            </button>
          </div>
        </Transition>
        <div class="reader-progress">
          <span>{{ Math.round(currentProgress * 100) }}%</span>
          <div class="reader-progress__track"><span :style="{ width: `${Math.round(currentProgress * 100)}%` }" /></div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import browser from 'webextension-polyfill';
import type { NavItem } from 'epubjs';
import { useConfig } from '@/composables/useConfig';
import { useTheme } from '@/composables/useTheme';
import { isServiceConfigured } from '@/entrypoints/utils/option';
import { resolveLocale } from '@/entrypoints/utils/i18n';
import { EbookImportError, EbookRepository } from './repository';
import { selectDroppedFile } from './dropImport';
import { getRequestedEbookId } from './url';
import {
  EbookReaderController,
  extractEpubMetadata,
  findBookmarkAtCfi,
  resolveEbookReaderKeyboardAction,
  type ChapterContinuationState,
  type ReaderLocation,
} from './readerController';
import { loadReaderSettings, saveReaderSettings } from './settings';
import { EbookTranslationCoordinator, type EbookTranslationStatus } from './translationCoordinator';
import type {
  Bookmark,
  EbookDisplayMode,
  EbookReaderSettings,
  EbookRecord,
  StorageEstimate,
} from './types';

interface RecentBook {
  record: EbookRecord;
  progress: number;
}

interface FlatNavItem extends NavItem {
  depth: number;
}

const { t, locale } = useI18n();
const { config, loadConfig } = useConfig();
const { actualTheme } = useTheme(config);

const repository = new EbookRepository();
const fileInput = ref<HTMLInputElement>();
const viewer = ref<HTMLElement>();
const books = ref<RecentBook[]>([]);
const bookmarks = ref<Bookmark[]>([]);
const toc = ref<NavItem[]>([]);
const activeBook = ref<EbookRecord>();
const activeBookIsTemporary = ref(false);
const loadingLibrary = ref(true);
const importing = ref(false);
const draggingFile = ref(false);
const errorMessage = ref('');
const currentProgress = ref(0);
const currentLocationCfi = ref('');
const currentChapterHref = ref('');
const sidebarTab = ref<'toc' | 'bookmarks'>('toc');
const coverUrls = reactive<Record<string, string>>({});
const storageEstimate = reactive<StorageEstimate>({ usage: 0, quota: 0, persisted: false });
const readerSettings = reactive<EbookReaderSettings>({
  fontScale: 100,
  lineHeight: 1.7,
  displayMode: 'bilingual',
});
const translationStatus = reactive<EbookTranslationStatus>({ total: 0, completed: 0, failed: 0, running: false });
const translationNotice = ref('');
const needsSettings = ref(false);
const needsEnable = ref(false);
const chapterContinuation = reactive<ChapterContinuationState>({ atChapterEnd: false });
const chapterNavigationPending = ref(false);
let progressTimer: ReturnType<typeof setTimeout> | undefined;
let lastLocation: ReaderLocation | undefined;
let dragDepth = 0;

const themeLabel = computed(() => t(`ebook.theme${config.value.theme === 'dark' ? 'Dark' : config.value.theme === 'light' ? 'Light' : 'Auto'}`));
const displayModeLabel = computed(() => t(`ebook.display${readerSettings.displayMode === 'original'
  ? 'Original'
  : readerSettings.displayMode === 'translation'
    ? 'Translation'
    : 'Bilingual'}`));

const flatToc = computed(() => {
  const flatten = (items: NavItem[], depth = 0): FlatNavItem[] => items.flatMap(item => [
    { ...item, depth },
    ...flatten(item.subitems ?? [], depth + 1),
  ]);
  return flatten(toc.value);
});

const bookStorageUsage = computed(() => books.value.reduce((total, item) => (
  total + item.record.fileSize + (item.record.coverBlob?.size ?? 0)
), 0));

const currentBookmark = computed(() => findBookmarkAtCfi(bookmarks.value, currentLocationCfi.value));

const coordinator = new EbookTranslationCoordinator({
  onStatus(status) {
    Object.assign(translationStatus, status);
  },
  captureLocation: () => controller.getCurrentLocation()?.cfi,
  restoreLocation: cfi => controller.restoreAfterLayout(cfi),
});

const controller = new EbookReaderController({
  onLocation: handleLocation,
  onChapter: (document, href, label) => {
    currentChapterHref.value = href;
    void translateChapter(document, label);
  },
  onChapterContinuation: state => Object.assign(chapterContinuation, state),
  onKeyDown: handleReaderKeyDown,
});

onMounted(async () => {
  await loadConfig();
  locale.value = resolveLocale(config.value.uiLocale);
  document.title = t('ebook.libraryTitle');
  Object.assign(readerSettings, await loadReaderSettings());
  await refreshLibrary();
  const requestedBookId = getRequestedEbookId(window.location.search);
  if (requestedBookId) {
    const requestedBook = await repository.getBook(requestedBookId);
    if (requestedBook) await openBook(requestedBook);
  }
  window.addEventListener('pagehide', saveProgressImmediately);
  window.addEventListener('blur', saveProgressImmediately);
  window.addEventListener('keydown', handleReaderKeyDown);
});

onBeforeUnmount(() => {
  saveProgressImmediately();
  coordinator.cancel();
  controller.close();
  repository.close();
  clearCoverUrls();
  window.removeEventListener('pagehide', saveProgressImmediately);
  window.removeEventListener('blur', saveProgressImmediately);
  window.removeEventListener('keydown', handleReaderKeyDown);
});

watch(actualTheme, theme => void controller.applyTheme(theme));
watch(() => config.value.uiLocale, preference => {
  locale.value = resolveLocale(preference);
  document.title = t('ebook.libraryTitle');
});
watch([
  () => config.value.on,
  () => config.value.service,
  () => JSON.stringify(config.value.token),
  () => JSON.stringify(config.value.model),
], () => {
  if (!activeBook.value) return;
  const chapter = controller.getCurrentChapter();
  if (!chapter) return;
  void translateChapter(chapter.document, chapter.label);
});

function chooseFile(): void {
  fileInput.value?.click();
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await importSelectedFile(file);
}

async function importSelectedFile(file: File): Promise<void> {
  importing.value = true;
  errorMessage.value = '';
  try {
    const result = await repository.importBook(file, extractEpubMetadata);
    await refreshLibrary();
    await openBook(result.book);
  } catch (error) {
    if (error instanceof EbookImportError && ['INSUFFICIENT_STORAGE', 'QUOTA_EXCEEDED'].includes(error.code)) {
      if (window.confirm(t('ebook.temporaryReadPrompt'))) await openTemporaryBook(file);
      return;
    }
    errorMessage.value = importErrorText(error);
  } finally {
    importing.value = false;
  }
}

async function openTemporaryBook(file: File): Promise<void> {
  const metadata = await extractEpubMetadata(await file.arrayBuffer(), file);
  const now = Date.now();
  await openBook({
    bookId: `temporary-${now}`,
    fileBlob: file,
    filename: file.name,
    fileSize: file.size,
    title: metadata.title,
    author: metadata.author,
    coverBlob: metadata.coverBlob,
    addedAt: now,
    lastOpenedAt: now,
  }, true);
}

async function openBook(book: EbookRecord, temporary = false): Promise<void> {
  errorMessage.value = '';
  activeBook.value = book;
  activeBookIsTemporary.value = temporary;
  currentProgress.value = 0;
  await nextTick();
  if (!viewer.value) return;
  const progress = temporary ? undefined : await repository.getProgress(book.bookId);
  currentProgress.value = progress?.percentage ?? 0;
  currentLocationCfi.value = progress?.cfi ?? '';
  toc.value = await controller.open(viewer.value, book, progress, readerSettings, actualTheme.value);
  bookmarks.value = temporary ? [] : await repository.listBookmarks(book.bookId);
  if (!temporary) await repository.markOpened(book.bookId);
}

async function closeBook(): Promise<void> {
  saveProgressImmediately();
  await leaveReader();
}

async function leaveReader(): Promise<void> {
  coordinator.cancel();
  controller.close();
  activeBook.value = undefined;
  activeBookIsTemporary.value = false;
  toc.value = [];
  bookmarks.value = [];
  currentChapterHref.value = '';
  currentLocationCfi.value = '';
  lastLocation = undefined;
  Object.assign(chapterContinuation, {
    atChapterEnd: false,
    previousHref: undefined,
    previousLabel: undefined,
    nextHref: undefined,
    nextLabel: undefined,
  });
  await refreshLibrary();
}

async function removeBook(book: EbookRecord): Promise<void> {
  if (!window.confirm(t('ebook.removeConfirm', { title: book.title }))) return;
  await repository.removeBook(book.bookId);
  await refreshLibrary();
}

async function toggleBookmark(): Promise<void> {
  if (!activeBook.value || activeBookIsTemporary.value) return;
  if (currentBookmark.value) {
    await repository.removeBookmark(currentBookmark.value.id);
    bookmarks.value = await repository.listBookmarks(activeBook.value.bookId);
    return;
  }
  const draft = controller.getBookmarkDraft(activeBook.value.bookId);
  if (!draft) return;
  const result = await repository.addBookmark(draft);
  bookmarks.value = await repository.listBookmarks(activeBook.value.bookId);
  currentLocationCfi.value = result.bookmark.cfi;
  sidebarTab.value = 'bookmarks';
}

async function removeBookmark(id: string): Promise<void> {
  if (!activeBook.value) return;
  await repository.removeBookmark(id);
  bookmarks.value = await repository.listBookmarks(activeBook.value.bookId);
}

async function translateChapter(document: Document, chapterLabel: string): Promise<void> {
  translationNotice.value = '';
  needsSettings.value = false;
  needsEnable.value = false;
  if (!config.value.on) {
    coordinator.cancel();
    translationNotice.value = t('ebook.translationDisabled');
    needsEnable.value = true;
    return;
  }
  if (!isServiceConfigured(config.value.service, config.value)) {
    coordinator.cancel();
    translationNotice.value = t('ebook.serviceNotConfigured');
    needsSettings.value = true;
    return;
  }
  await coordinator.start(document, `${activeBook.value?.title ?? ''} · ${chapterLabel}`, readerSettings.displayMode);
}

function retryFailed(): void {
  void coordinator.retryFailed();
}

async function retranslateCurrentChapter(): Promise<void> {
  translationNotice.value = '';
  needsSettings.value = false;
  needsEnable.value = false;
  if (!config.value.on) {
    translationNotice.value = t('ebook.translationDisabled');
    needsEnable.value = true;
    return;
  }
  if (!isServiceConfigured(config.value.service, config.value)) {
    translationNotice.value = t('ebook.serviceNotConfigured');
    needsSettings.value = true;
    return;
  }
  const result = await coordinator.retranslate();
  if (result === 'failed') translationNotice.value = t('ebook.retranslateFailed');
  if (result === 'empty') translationNotice.value = t('ebook.noTranslatableContent');
}

function handleLocation(location: ReaderLocation): void {
  const chapterChanged = Boolean(lastLocation && lastLocation.chapterHref !== location.chapterHref);
  lastLocation = location;
  currentProgress.value = location.percentage;
  currentLocationCfi.value = location.cfi;
  if (activeBookIsTemporary.value) return;
  if (chapterChanged) {
    saveProgressImmediately();
    return;
  }
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = setTimeout(saveProgressImmediately, 500);
}

function saveProgressImmediately(): void {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = undefined;
  const book = activeBook.value;
  const location = controller.getCurrentLocation() ?? lastLocation;
  if (!book || !location || activeBookIsTemporary.value) return;
  void repository.saveProgress({
    bookId: book.bookId,
    cfi: location.cfi,
    chapterHref: location.chapterHref,
    percentage: location.percentage,
    updatedAt: Date.now(),
  });
}

async function applyReaderSettings(): Promise<void> {
  await saveReaderSettings({ ...readerSettings });
  await controller.applySettings(readerSettings);
}

function display(target: string): void {
  void controller.display(target);
}

async function continueToPreviousChapter(): Promise<boolean> {
  return navigateToAdjacentChapter('previous');
}

async function continueToNextChapter(): Promise<boolean> {
  return navigateToAdjacentChapter('next');
}

async function navigateToAdjacentChapter(direction: 'previous' | 'next'): Promise<boolean> {
  const href = direction === 'previous' ? chapterContinuation.previousHref : chapterContinuation.nextHref;
  if (!href || chapterNavigationPending.value) return false;

  chapterNavigationPending.value = true;
  chapterContinuation.atChapterEnd = false;
  try {
    return direction === 'previous'
      ? await controller.continueToPreviousChapter()
      : await controller.continueToNextChapter();
  } finally {
    chapterNavigationPending.value = false;
  }
}

async function continueReading(): Promise<void> {
  const hasNextChapter = Boolean(chapterContinuation.nextHref);
  if (hasNextChapter) {
    await continueToNextChapter();
    return;
  }
  chapterContinuation.atChapterEnd = false;
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = undefined;
  const book = activeBook.value;
  const location = controller.getCurrentLocation() ?? lastLocation;
  if (book && location && !activeBookIsTemporary.value) {
    await repository.saveProgress({
      bookId: book.bookId,
      cfi: location.cfi,
      chapterHref: location.chapterHref,
      percentage: 1,
      updatedAt: Date.now(),
    });
  }
  await leaveReader();
}

function handleReaderKeyDown(event: KeyboardEvent): void {
  if (!activeBook.value) return;

  const action = resolveEbookReaderKeyboardAction(event);
  if (!action) return;

  if (action === 'previous-chapter') {
    if (!chapterContinuation.previousHref || chapterNavigationPending.value) return;
    event.preventDefault();
    void continueToPreviousChapter();
    return;
  }

  if (action === 'next-chapter') {
    if (!chapterContinuation.nextHref || chapterNavigationPending.value) return;
    event.preventDefault();
    void continueToNextChapter();
    return;
  }

  const didScroll = controller.scrollByViewport(action === 'page-up' ? -1 : 1);
  if (didScroll) event.preventDefault();
}

function isCurrentChapter(href: string): boolean {
  const normalize = (value: string) => value.split('#')[0].replace(/^\.\//, '');
  return normalize(href) === normalize(currentChapterHref.value);
}

function handleDragEnter(event: DragEvent): void {
  if (!hasDraggedFiles(event) || importing.value) return;
  dragDepth += 1;
  draggingFile.value = true;
}

function handleDragOver(event: DragEvent): void {
  if (!hasDraggedFiles(event) || importing.value || !event.dataTransfer) return;
  event.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(event: DragEvent): void {
  if (!hasDraggedFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) draggingFile.value = false;
}

async function handleDrop(event: DragEvent): Promise<void> {
  dragDepth = 0;
  draggingFile.value = false;
  if (importing.value || !event.dataTransfer) return;
  const selection = selectDroppedFile(event.dataTransfer.files);
  if (!selection.file) {
    if (selection.error === 'MULTIPLE') errorMessage.value = t('ebook.dropSingleFile');
    return;
  }
  await importSelectedFile(selection.file);
}

function hasDraggedFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}

function enableTranslation(): void {
  config.value.on = true;
}

function cycleDisplayMode(): void {
  const displayModes: EbookDisplayMode[] = ['original', 'bilingual', 'translation'];
  const current = displayModes.indexOf(readerSettings.displayMode);
  readerSettings.displayMode = displayModes[(current + 1) % displayModes.length];
  coordinator.setDisplayMode(readerSettings.displayMode);
  void saveReaderSettings({ ...readerSettings });
}

function cycleTheme(): void {
  const themes = ['auto', 'light', 'dark'] as const;
  const current = themes.indexOf(config.value.theme as typeof themes[number]);
  config.value.theme = themes[(current + 1) % themes.length];
}

async function refreshLibrary(): Promise<void> {
  loadingLibrary.value = true;
  clearCoverUrls();
  const records = await repository.listRecentBooks();
  books.value = await Promise.all(records.map(async record => ({
    record,
    progress: (await repository.getProgress(record.bookId))?.percentage ?? 0,
  })));
  records.forEach(record => {
    if (record.coverBlob) coverUrls[record.bookId] = URL.createObjectURL(record.coverBlob);
  });
  Object.assign(storageEstimate, await repository.estimateStorage());
  loadingLibrary.value = false;
}

function clearCoverUrls(): void {
  Object.values(coverUrls).forEach(url => URL.revokeObjectURL(url));
  Object.keys(coverUrls).forEach(key => delete coverUrls[key]);
}

function importErrorText(error: unknown): string {
  if (!(error instanceof EbookImportError)) return t('ebook.importFailed');
  const keyByCode: Record<EbookImportError['code'], string> = {
    INVALID_FILE: 'ebook.invalidFile',
    EMPTY_FILE: 'ebook.emptyFile',
    INSUFFICIENT_STORAGE: 'ebook.insufficientStorage',
    QUOTA_EXCEEDED: 'ebook.insufficientStorage',
    PARSE_FAILED: 'ebook.parseFailed',
  };
  return t(keyByCode[error.code]);
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(String(locale.value), { dateStyle: 'medium' }).format(timestamp);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
</script>
