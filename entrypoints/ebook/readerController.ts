import browser from 'webextension-polyfill';
import ePub, {
  type Book,
  type Contents,
  type Location,
  type NavItem,
  type Rendition,
} from 'epubjs';
import { fitEbookImagePage } from './pageLayout';
import { sanitizeEbookDocument } from './sanitizer';
import type {
  Bookmark,
  EbookImportMetadata,
  EbookReaderSettings,
  EbookRecord,
  ReadingState,
} from './types';

export interface ReaderLocation {
  cfi: string;
  chapterHref: string;
  percentage: number;
  atStart: boolean;
  atEnd: boolean;
}

export interface ChapterContinuationState {
  atChapterEnd: boolean;
  previousHref?: string;
  previousLabel?: string;
  nextHref?: string;
  nextLabel?: string;
}

export const EBOOK_RENDITION_OPTIONS = {
  width: '100%',
  height: '100%',
  flow: 'scrolled-doc',
  spread: 'none',
  allowScriptedContent: false,
} as const;

interface ReaderControllerOptions {
  onLocation?: (location: ReaderLocation) => void;
  onChapter?: (document: Document, chapterHref: string, chapterLabel: string) => void;
  onChapterContinuation?: (state: ChapterContinuationState) => void;
}

interface RenderedSection {
  href?: string;
  prev?: () => RenderedSection | undefined;
  next?: () => RenderedSection | undefined;
}

const CHAPTER_END_THRESHOLD = 32;

export const EBOOK_THEME_COLORS = {
  light: {
    foreground: '#24272d',
    background: '#fbfaf7',
    link: '#3975d7',
  },
  dark: {
    foreground: '#e6e8ec',
    background: '#111317',
    link: '#77a7ff',
  },
} as const;

export function applyEbookDocumentTheme(document: Document, theme: 'light' | 'dark'): void {
  const colors = EBOOK_THEME_COLORS[theme];
  document.documentElement.style.setProperty('color-scheme', theme);
  document.documentElement.style.setProperty('background-color', colors.background, 'important');
  document.body?.style.setProperty('color', colors.foreground, 'important');
  document.body?.style.setProperty('background-color', colors.background, 'important');
}

export function hasReachedChapterEnd(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): boolean {
  if (clientHeight <= 0 || scrollHeight <= 0) return false;
  return scrollHeight - scrollTop - clientHeight <= CHAPTER_END_THRESHOLD;
}

export function estimateSpineProgress(
  sectionIndex: number,
  sectionCount: number,
  displayedPage = 1,
  displayedTotal = 1,
): number {
  const count = Math.max(1, sectionCount);
  const index = Math.min(count - 1, Math.max(0, sectionIndex));
  const pageFraction = displayedTotal > 0
    ? Math.min(1, Math.max(0, (displayedPage - 1) / displayedTotal))
    : 0;
  return Math.min(1, Math.max(0, (index + pageFraction) / count));
}

export function findBookmarkAtCfi(bookmarks: readonly Bookmark[], cfi: string): Bookmark | undefined {
  if (!cfi) return undefined;
  return bookmarks.find(bookmark => bookmark.cfi === cfi);
}

function normalizeLocation(location: unknown): Location | undefined {
  if (Array.isArray(location)) return location[0] as Location | undefined;
  if (location && typeof location === 'object' && 'start' in location) return location as Location;
  return undefined;
}

function flattenToc(items: NavItem[]): NavItem[] {
  return items.flatMap(item => [item, ...flattenToc(item.subitems ?? [])]);
}

function normalizePackagePath(path: string): string {
  const segments: string[] = [];
  path.replace(/\\/g, '/').split('/').forEach(segment => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      segments.pop();
      return;
    }
    segments.push(segment);
  });
  return segments.join('/');
}

export function resolveEbookNavigationHref(href: string, navigationPath: string): string {
  const target = href.trim();
  if (!target || /^epubcfi\(/i.test(target) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) {
    return target;
  }

  const suffixIndex = target.search(/[?#]/);
  const resource = suffixIndex >= 0 ? target.slice(0, suffixIndex) : target;
  const suffix = suffixIndex >= 0 ? target.slice(suffixIndex) : '';
  const navigationResource = navigationPath.split(/[?#]/)[0];
  const navigationDirectory = navigationResource.includes('/')
    ? navigationResource.slice(0, navigationResource.lastIndexOf('/') + 1)
    : '';
  const resolvedResource = resource
    ? (resource.startsWith('/') ? resource.slice(1) : `${navigationDirectory}${resource}`)
    : navigationResource;
  const normalized = normalizePackagePath(resolvedResource);
  return `${normalized}${suffix}`;
}

export function resolveEbookNavigation(items: readonly NavItem[], navigationPath: string): NavItem[] {
  return items.map(item => ({
    ...item,
    href: resolveEbookNavigationHref(item.href, navigationPath),
    subitems: resolveEbookNavigation(item.subitems ?? [], navigationPath),
  }));
}

async function fetchCover(book: Book): Promise<Blob | undefined> {
  const coverUrl = await book.coverUrl();
  if (!coverUrl) return undefined;
  try {
    const response = await fetch(coverUrl);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch {
    return undefined;
  }
}

export async function extractEpubMetadata(data: ArrayBuffer, file: File): Promise<EbookImportMetadata> {
  const book = ePub(data);
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    return {
      title: metadata.title || file.name.replace(/\.epub$/i, ''),
      author: metadata.creator || '',
      coverBlob: await fetchCover(book),
    };
  } finally {
    book.destroy();
  }
}

export class EbookReaderController {
  private book?: Book;
  private rendition?: Rendition;
  private current?: ReaderLocation;
  private toc: NavItem[] = [];
  private navigationByHref = new Map<string, NavItem>();
  private currentContents?: Contents;
  private currentSection?: RenderedSection;
  private scrollContainer?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private restoringLayout = false;
  private theme: 'light' | 'dark' = 'light';
  private sectionCount = 1;
  private readonly handleScroll = () => this.updateChapterContinuation();

  constructor(private readonly options: ReaderControllerOptions = {}) {}

  async open(
    container: HTMLElement,
    record: Pick<EbookRecord, 'fileBlob' | 'title'>,
    progress: ReadingState | undefined,
    settings: EbookReaderSettings,
    theme: 'light' | 'dark',
  ): Promise<NavItem[]> {
    this.close();
    const data = await record.fileBlob.arrayBuffer();
    const book = ePub(data);
    this.book = book;
    await book.ready;
    this.sectionCount = Math.max(1, (await book.loaded.spine).length);
    const navigation = await book.loaded.navigation;
    const navigationPath = book.packaging.navPath || book.packaging.ncxPath || '';
    this.toc = resolveEbookNavigation(navigation.toc, navigationPath);
    this.navigationByHref = new Map(flattenToc(this.toc).map(item => [this.normalizeHref(item.href), item]));

    book.spine.hooks.content.register((document: Document) => {
      sanitizeEbookDocument(document);
    });

    const rendition = book.renderTo(container, EBOOK_RENDITION_OPTIONS);
    this.rendition = rendition;
    this.theme = theme;
    if (progress?.cfi) {
      this.current = {
        cfi: progress.cfi,
        chapterHref: progress.chapterHref ?? '',
        percentage: progress.percentage,
        atStart: progress.percentage <= 0,
        atEnd: progress.percentage >= 1,
      };
    }
    const lightTheme = EBOOK_THEME_COLORS.light;
    const darkTheme = EBOOK_THEME_COLORS.dark;
    rendition.themes.register('onlytranslate-light', {
      body: { color: lightTheme.foreground, background: lightTheme.background },
      a: { color: lightTheme.link },
    });
    rendition.themes.register('onlytranslate-dark', {
      body: { color: darkTheme.foreground, background: darkTheme.background },
      a: { color: darkTheme.link },
    });
    this.applyTheme(theme);
    rendition.themes.fontSize(`${settings.fontScale}%`);
    rendition.themes.override('line-height', String(settings.lineHeight), true);

    rendition.hooks.content.register((contents: Contents) => {
      this.currentContents = contents;
      applyEbookDocumentTheme(contents.document, this.theme);
      fitEbookImagePage(contents.document, {
        width: container.clientWidth,
        height: container.clientHeight,
      });
      this.attachExternalLinkHandler(contents.document);
    });
    rendition.on('rendered', (section: RenderedSection, view: { contents?: Contents }) => {
      const contents = view?.contents ?? this.currentContents;
      if (!contents) return;
      this.currentContents = contents;
      this.currentSection = section;
      fitEbookImagePage(contents.document, {
        width: container.clientWidth,
        height: container.clientHeight,
      });
      this.observeCurrentView();
      this.emitChapterContinuation(false);
      this.scheduleChapterEndCheck();
      if (this.restoringLayout) return;
      const href = section?.href ?? this.current?.chapterHref ?? '';
      this.options.onChapter?.(contents.document, href, this.chapterLabel(href));
    });
    rendition.on('relocated', (location: Location) => {
      const normalized = normalizeLocation(location);
      if (!normalized?.start?.cfi) return;
      this.current = {
        cfi: normalized.start.cfi,
        chapterHref: normalized.start.href ?? '',
        percentage: this.resolvePercentage(normalized),
        atStart: Boolean(normalized.atStart),
        atEnd: Boolean(normalized.atEnd),
      };
      this.options.onLocation?.(this.current);
      this.scheduleChapterEndCheck();
    });

    const attached = container.querySelector('.epub-container')
      ? Promise.resolve()
      : new Promise<void>(resolve => rendition.once('attached', () => resolve()));
    await Promise.all([rendition.started, attached]);
    this.scrollContainer = container.querySelector<HTMLElement>('.epub-container') ?? undefined;
    this.scrollContainer?.addEventListener('scroll', this.handleScroll, { passive: true });
    void book.locations.generate(1400).then(() => rendition.reportLocation()).catch(() => undefined);
    const firstChapter = book.spine.first()?.href;
    await this.displayWithFallback(progress?.cfi, progress?.chapterHref, firstChapter);
    return this.toc;
  }

  close(): void {
    this.scrollContainer?.removeEventListener('scroll', this.handleScroll);
    this.resizeObserver?.disconnect();
    this.rendition?.destroy();
    this.book?.destroy();
    this.rendition = undefined;
    this.book = undefined;
    this.current = undefined;
    this.currentContents = undefined;
    this.currentSection = undefined;
    this.scrollContainer = undefined;
    this.resizeObserver = undefined;
    this.sectionCount = 1;
    this.toc = [];
    this.navigationByHref.clear();
  }

  async display(target: string): Promise<void> {
    await this.rendition?.display(target);
  }

  async continueToNextChapter(): Promise<boolean> {
    const next = this.currentSection?.next?.();
    if (!next?.href || !this.rendition) return false;
    await this.rendition.display(next.href);
    return true;
  }

  async continueToPreviousChapter(): Promise<boolean> {
    const previous = this.currentSection?.prev?.();
    if (!previous?.href || !this.rendition) return false;
    await this.rendition.display(previous.href);
    return true;
  }

  getCurrentLocation(): ReaderLocation | undefined {
    const latest = normalizeLocation(this.rendition?.currentLocation());
    if (latest?.start?.cfi) {
      return {
        cfi: latest.start.cfi,
        chapterHref: latest.start.href ?? this.current?.chapterHref ?? '',
        percentage: this.resolvePercentage(latest),
        atStart: Boolean(latest.atStart),
        atEnd: Boolean(latest.atEnd),
      };
    }
    return this.current;
  }

  getBookmarkDraft(bookId: string): Omit<Bookmark, 'id' | 'createdAt'> | undefined {
    const location = this.getCurrentLocation();
    if (!location) return undefined;
    let text = '';
    try {
      const range = this.rendition?.getRange(location.cfi);
      const contextElement = range?.startContainer.parentElement?.closest('p,li,blockquote,figcaption,td,th')
        ?? range?.commonAncestorContainer.parentElement;
      text = contextElement?.textContent ?? '';
    } catch {
      text = '';
    }
    if (!text) text = this.currentContents?.document.body.textContent ?? '';
    text = text.replace(/\s+/g, ' ').trim();
    return {
      bookId,
      cfi: location.cfi,
      chapterHref: location.chapterHref,
      chapterLabel: this.chapterLabel(location.chapterHref),
      excerpt: text.slice(0, 160),
    };
  }

  async applySettings(settings: EbookReaderSettings): Promise<void> {
    const cfi = this.getCurrentLocation()?.cfi;
    this.rendition?.themes.fontSize(`${settings.fontScale}%`);
    this.rendition?.themes.override('line-height', String(settings.lineHeight), true);
    if (cfi) await this.rendition?.display(cfi);
  }

  applyTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    const colors = EBOOK_THEME_COLORS[theme];
    this.rendition?.themes.select(theme === 'dark' ? 'onlytranslate-dark' : 'onlytranslate-light');
    this.rendition?.themes.override('color', colors.foreground, true);
    this.rendition?.themes.override('background-color', colors.background, true);
    if (this.currentContents) applyEbookDocumentTheme(this.currentContents.document, theme);
  }

  async restoreAfterLayout(cfi: string): Promise<void> {
    if (!this.rendition) return;
    this.restoringLayout = true;
    try {
      await this.rendition.display(cfi);
    } finally {
      this.restoringLayout = false;
    }
  }

  getCurrentChapter(): { document: Document; href: string; label: string } | undefined {
    const document = this.currentContents?.document;
    if (!document) return undefined;
    const href = this.currentSection?.href ?? this.current?.chapterHref ?? '';
    return { document, href, label: this.chapterLabel(href) };
  }

  private updateChapterContinuation(): void {
    const container = this.scrollContainer;
    if (!container || !this.currentSection) return;
    this.emitChapterContinuation(hasReachedChapterEnd(
      container.scrollTop,
      container.clientHeight,
      container.scrollHeight,
    ));
  }

  private resolvePercentage(location: Location): number {
    const start = location.start;
    if (this.book?.locations.length()) {
      try {
        const precise = this.book.locations.percentageFromCfi(start.cfi);
        if (Number.isFinite(precise)) return Math.min(1, Math.max(0, precise));
      } catch {
        // Fall back to the current spine section while EPUB locations are unavailable.
      }
    }
    return estimateSpineProgress(
      start.index,
      this.sectionCount,
      start.displayed?.page,
      start.displayed?.total,
    );
  }

  private emitChapterContinuation(atChapterEnd: boolean): void {
    const previous = this.currentSection?.prev?.();
    const next = this.currentSection?.next?.();
    this.options.onChapterContinuation?.({
      atChapterEnd,
      previousHref: previous?.href,
      previousLabel: previous?.href ? this.chapterLabel(previous.href) : undefined,
      nextHref: next?.href,
      nextLabel: next?.href ? this.chapterLabel(next.href) : undefined,
    });
  }

  private scheduleChapterEndCheck(): void {
    const contentWindow = this.currentContents?.window;
    if (contentWindow?.requestAnimationFrame) {
      contentWindow.requestAnimationFrame(() => this.updateChapterContinuation());
      return;
    }
    window.requestAnimationFrame(() => this.updateChapterContinuation());
  }

  private observeCurrentView(): void {
    this.resizeObserver?.disconnect();
    if (!this.scrollContainer || typeof ResizeObserver === 'undefined') return;
    const view = this.scrollContainer.querySelector<HTMLElement>('.epub-view');
    if (!view) return;
    this.resizeObserver = new ResizeObserver(() => this.updateChapterContinuation());
    this.resizeObserver.observe(view);
  }

  private async displayWithFallback(...targets: Array<string | undefined>): Promise<void> {
    for (const target of targets) {
      if (!target) continue;
      try {
        await this.rendition?.display(target);
        return;
      } catch {
        // A saved CFI can become invalid after a replaced EPUB; try the href and first spine item.
      }
    }
    await this.rendition?.display();
  }

  private chapterLabel(href: string): string {
    return this.navigationByHref.get(this.normalizeHref(href))?.label?.trim() || href;
  }

  private normalizeHref(href: string): string {
    return href.split('#')[0].replace(/^\.\//, '');
  }

  private attachExternalLinkHandler(document: Document): void {
    document.addEventListener('click', event => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      const rawHref = anchor?.getAttribute('href') ?? '';
      const isExternal = anchor?.dataset.onlytranslateExternalLink === 'true' || /^\s*(?:https?:)?\/\//i.test(rawHref);
      if (!anchor?.href || !isExternal) return;
      event.preventDefault();
      event.stopPropagation();
      void browser.tabs.create({ url: anchor.href });
    }, true);
  }
}
