import { describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: { tabs: { create: vi.fn() } },
}));
import { selectDroppedFile } from '../../entrypoints/ebook/dropImport';
import { estimateSpineProgress, findBookmarkAtCfi, hasReachedChapterEnd } from '../../entrypoints/ebook/readerController';

describe('ebook reader interactions', () => {
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
});
