import { describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: { tabs: { create: vi.fn() } },
}));
import { selectDroppedFile } from '../../entrypoints/ebook/dropImport';
import {
  applyEbookDocumentTheme,
  EBOOK_THEME_COLORS,
  EbookReaderController,
  estimateSpineProgress,
  findBookmarkAtCfi,
  hasReachedChapterEnd,
  resolveEbookReaderKeyboardAction,
  resolveEbookNavigation,
  resolveEbookNavigationHref,
} from '../../entrypoints/ebook/readerController';

describe('ebook reader interactions', () => {
  it('maps reader keyboard shortcuts and ignores unsafe key events', () => {
    const resolveKey = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
      let action: ReturnType<typeof resolveEbookReaderKeyboardAction> = undefined;
      target.addEventListener('keydown', event => {
        action = resolveEbookReaderKeyboardAction(event as KeyboardEvent);
      }, { once: true });
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      return action;
    };

    expect(resolveKey(document.body, 'ArrowLeft')).toBe('previous-chapter');
    expect(resolveKey(document.body, 'ArrowRight')).toBe('next-chapter');
    expect(resolveKey(document.body, 'PageUp')).toBe('page-up');
    expect(resolveKey(document.body, 'PageDown')).toBe('page-down');
    expect(resolveKey(document.body, ' ')).toBe('page-down');
    expect(resolveKey(document.body, ' ', { shiftKey: true })).toBe('page-up');
    expect(resolveKey(document.body, 'ArrowRight', { repeat: true })).toBeUndefined();
    expect(resolveKey(document.body, 'ArrowRight', { ctrlKey: true })).toBeUndefined();
    expect(resolveKey(document.body, 'ArrowRight', { shiftKey: true })).toBeUndefined();

    const input = document.createElement('input');
    document.body.append(input);
    expect(resolveKey(input, 'ArrowRight')).toBeUndefined();
    input.remove();

    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selected reader text';
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    expect(resolveKey(paragraph, 'ArrowRight')).toBeUndefined();
    document.getSelection()?.removeAllRanges();
    paragraph.remove();
  });

  it('accepts one dropped file and rejects empty or multi-file drops', () => {
    const epub = new File(['book'], 'book.epub', { type: 'application/epub+zip' });

    expect(selectDroppedFile([epub])).toEqual({ file: epub });
    expect(selectDroppedFile([])).toEqual({ error: 'EMPTY' });
    expect(selectDroppedFile([epub, new File(['two'], 'two.epub')])).toEqual({ error: 'MULTIPLE' });
  });

  it('reveals chapter continuation only near the bottom of the scroll area', () => {
    expect(hasReachedChapterEnd(400, 600, 1200)).toBe(false);
    expect(hasReachedChapterEnd(570, 600, 1200)).toBe(true);
    expect(hasReachedChapterEnd(0, 600, 580)).toBe(true);
    expect(hasReachedChapterEnd(0, 0, 0)).toBe(false);
  });

  it('estimates non-zero book progress before EPUB locations finish generating', () => {
    expect(estimateSpineProgress(0, 10, 6, 10)).toBeCloseTo(.05);
    expect(estimateSpineProgress(4, 10, 6, 10)).toBeCloseTo(.45);
    expect(estimateSpineProgress(20, 10, 1, 1)).toBe(0.9);
  });

  it('finds the bookmark that exactly matches the current CFI', () => {
    const bookmarks = [
      { id: 'one', bookId: 'book', cfi: 'epubcfi(/6/2)', createdAt: 1 },
      { id: 'two', bookId: 'book', cfi: 'epubcfi(/6/4)', createdAt: 2 },
    ];

    expect(findBookmarkAtCfi(bookmarks, 'epubcfi(/6/4)')?.id).toBe('two');
    expect(findBookmarkAtCfi(bookmarks, 'epubcfi(/6/6)')).toBeUndefined();
    expect(findBookmarkAtCfi(bookmarks, '')).toBeUndefined();
  });

  it('resolves EPUB 3 navigation hrefs relative to the navigation document', () => {
    const navigation = resolveEbookNavigation([{
      id: 'part-one',
      href: 'part01.xhtml',
      label: 'Part one',
      subitems: [{
        id: 'chapter-one',
        href: 'ch01.xhtml#page_3',
        label: 'Chapter one',
      }],
    }], 'xhtml/nav.xhtml');

    expect(navigation[0].href).toBe('xhtml/part01.xhtml');
    expect(navigation[0].subitems?.[0].href).toBe('xhtml/ch01.xhtml#page_3');
  });

  it('keeps package-relative NCX hrefs and CFIs stable', () => {
    expect(resolveEbookNavigationHref('xhtml/ch01.xhtml#page_3', 'toc.ncx'))
      .toBe('xhtml/ch01.xhtml#page_3');
    expect(resolveEbookNavigationHref('epubcfi(/6/4)', 'xhtml/nav.xhtml'))
      .toBe('epubcfi(/6/4)');
  });

  it('moves to the previous spine section when chapter-end navigation is used', async () => {
    const display = vi.fn(async () => undefined);
    const controller = new EbookReaderController();
    Object.assign(controller, {
      currentSection: {
        prev: () => ({ href: 'xhtml/ch01.xhtml' }),
      },
      rendition: { display },
    });

    await expect(controller.continueToPreviousChapter()).resolves.toBe(true);
    expect(display).toHaveBeenCalledWith('xhtml/ch01.xhtml');
  });

  it('scrolls the current chapter by ninety percent of the viewport', () => {
    const scrollContainer = document.createElement('div');
    Object.defineProperties(scrollContainer, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 2000 },
    });
    scrollContainer.scrollTop = 400;
    const controller = new EbookReaderController();
    Object.assign(controller, { scrollContainer });

    expect(controller.scrollByViewport(1)).toBe(true);
    expect(scrollContainer.scrollTop).toBe(850);
    expect(controller.scrollByViewport(-1)).toBe(true);
    expect(scrollContainer.scrollTop).toBe(400);
  });

  it('forwards keyboard events from EPUB documents and removes the listener on close', () => {
    const onKeyDown = vi.fn();
    const controller = new EbookReaderController({ onKeyDown });
    const ebookDocument = document.implementation.createHTMLDocument('Chapter');
    const attachKeyboardHandler = controller as unknown as {
      attachKeyboardHandler(document: Document): void;
    };

    attachKeyboardHandler.attachKeyboardHandler(ebookDocument);
    ebookDocument.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onKeyDown).toHaveBeenCalledOnce();

    controller.close();
    ebookDocument.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('provides both neighboring chapter labels at the end of a section', () => {
    const onChapterContinuation = vi.fn();
    const controller = new EbookReaderController({ onChapterContinuation });
    Object.assign(controller, {
      currentSection: {
        prev: () => ({ href: 'xhtml/ch01.xhtml' }),
        next: () => ({ href: 'xhtml/ch03.xhtml' }),
      },
      navigationByHref: new Map([
        ['xhtml/ch01.xhtml', { label: 'Chapter one' }],
        ['xhtml/ch03.xhtml', { label: 'Chapter three' }],
      ]),
    });

    (controller as unknown as { emitChapterContinuation(atChapterEnd: boolean): void })
      .emitChapterContinuation(true);

    expect(onChapterContinuation).toHaveBeenCalledWith({
      atChapterEnd: true,
      previousHref: 'xhtml/ch01.xhtml',
      previousLabel: 'Chapter one',
      nextHref: 'xhtml/ch03.xhtml',
      nextLabel: 'Chapter three',
    });
  });

  it('applies a theme to the current rendition without redisplaying the chapter', () => {
    const select = vi.fn();
    const override = vi.fn();
    const display = vi.fn();
    const ebookDocument = document.implementation.createHTMLDocument('Chapter');
    const controller = new EbookReaderController();
    Object.assign(controller, {
      currentContents: { document: ebookDocument },
      rendition: {
        themes: { select, override },
        display,
      },
    });

    controller.applyTheme('dark');

    expect(select).toHaveBeenCalledWith('onlytranslate-dark');
    expect(override).toHaveBeenCalledWith('color', EBOOK_THEME_COLORS.dark.foreground, true);
    expect(override).toHaveBeenCalledWith('background-color', EBOOK_THEME_COLORS.dark.background, true);
    expect(ebookDocument.documentElement.style.backgroundColor).toBe(EBOOK_THEME_COLORS.dark.background);
    expect(ebookDocument.documentElement.style.getPropertyPriority('background-color')).toBe('important');
    expect(ebookDocument.body.style.backgroundColor).toBe(EBOOK_THEME_COLORS.dark.background);
    expect(display).not.toHaveBeenCalled();
  });

  it('replaces publisher page colors when the rendered document theme changes', () => {
    const ebookDocument = document.implementation.createHTMLDocument('Chapter');
    ebookDocument.documentElement.style.backgroundColor = 'white';
    ebookDocument.body.style.backgroundColor = 'white';
    ebookDocument.body.style.color = 'black';

    applyEbookDocumentTheme(ebookDocument, 'dark');

    expect(ebookDocument.documentElement.style.colorScheme).toBe('dark');
    expect(ebookDocument.documentElement.style.backgroundColor).toBe('#111317');
    expect(ebookDocument.body.style.backgroundColor).toBe('#111317');
    expect(ebookDocument.body.style.color).toBe('#e6e8ec');
    expect(ebookDocument.body.style.getPropertyPriority('color')).toBe('important');
  });
});
