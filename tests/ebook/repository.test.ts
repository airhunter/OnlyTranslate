import { IDBFactory } from 'fake-indexeddb';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EbookImportError, EbookRepository } from '../../entrypoints/ebook/repository';

const metadata = async () => ({
  title: 'Test Book',
  author: 'Test Author',
  coverBlob: new Blob(['cover'], { type: 'image/png' }),
});

describe('EbookRepository', () => {
  let repository: EbookRepository;
  let indexedDb: IDBFactory;
  const storageManager = {
    estimate: vi.fn(async () => ({ usage: 100, quota: 100_000 })),
    persist: vi.fn(async () => true),
    persisted: vi.fn(async () => true),
  };

  beforeEach(() => {
    vi.useRealTimers();
    indexedDb = new IDBFactory();
    repository = new EbookRepository(indexedDb, storageManager);
    vi.clearAllMocks();
  });

  afterEach(() => {
    repository.close();
    vi.unstubAllGlobals();
  });

  it('saves the EPUB blob and metadata only after parsing succeeds', async () => {
    const file = new File(['epub-one'], 'one.epub', { type: 'application/epub+zip' });
    const result = await repository.importBook(file, metadata);
    const saved = await repository.getBook(result.book.bookId);

    expect(result.duplicate).toBe(false);
    expect(saved?.title).toBe('Test Book');
    expect(saved?.author).toBe('Test Author');
    expect(saved?.fileBlob).toBeDefined();
    expect(saved?.fileSize).toBe(file.size);
    expect(saved).toHaveProperty('coverBlob');
    expect(storageManager.persist).toHaveBeenCalledOnce();
  });

  it('deduplicates by SHA-256 and updates the recent-open timestamp', async () => {
    const extractor = vi.fn(metadata);
    const first = await repository.importBook(new File(['same'], 'first.epub'), extractor);
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = await repository.importBook(new File(['same'], 'renamed.epub'), extractor);

    expect(second.duplicate).toBe(true);
    expect(second.book.bookId).toBe(first.book.bookId);
    expect(second.book.lastOpenedAt).toBeGreaterThan(first.book.lastOpenedAt);
    expect(extractor).toHaveBeenCalledOnce();
    expect(await repository.listRecentBooks()).toHaveLength(1);
  });

  it('sorts recent books and upserts reading progress', async () => {
    const first = (await repository.importBook(new File(['one'], 'one.epub'), metadata)).book;
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = (await repository.importBook(new File(['two'], 'two.epub'), metadata)).book;
    await repository.saveProgress({ bookId: first.bookId, cfi: 'epubcfi(/6/2)', chapterHref: 'one.xhtml', percentage: .2, updatedAt: 0 });
    await repository.saveProgress({ bookId: first.bookId, cfi: 'epubcfi(/6/4)', chapterHref: 'two.xhtml', percentage: .6, updatedAt: 0 });

    expect((await repository.listRecentBooks()).map(book => book.bookId)).toEqual([second.bookId, first.bookId]);
    expect(await repository.getProgress(first.bookId)).toMatchObject({ cfi: 'epubcfi(/6/4)', percentage: .6 });
  });

  it('deduplicates bookmarks and cascade-deletes book-owned data', async () => {
    const book = (await repository.importBook(new File(['book'], 'book.epub'), metadata)).book;
    await repository.saveProgress({ bookId: book.bookId, cfi: 'epubcfi(/6/2)', chapterHref: 'one.xhtml', percentage: .3, updatedAt: 0 });
    const first = await repository.addBookmark({ bookId: book.bookId, cfi: 'epubcfi(/6/2)', chapterHref: 'one.xhtml', chapterLabel: 'One', excerpt: 'Nearby text' });
    const duplicate = await repository.addBookmark({ bookId: book.bookId, cfi: 'epubcfi(/6/2)', chapterHref: 'one.xhtml', chapterLabel: 'One' });

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(await repository.listBookmarks(book.bookId)).toHaveLength(1);

    await repository.removeBook(book.bookId);
    expect(await repository.getBook(book.bookId)).toBeUndefined();
    expect(await repository.getProgress(book.bookId)).toBeUndefined();
    expect(await repository.listBookmarks(book.bookId)).toEqual([]);
  });

  it('deletes the ebook database only after the final book is removed', async () => {
    const deleteDatabase = vi.spyOn(indexedDb, 'deleteDatabase');
    const first = (await repository.importBook(new File(['first'], 'first.epub'), metadata)).book;
    const second = (await repository.importBook(new File(['second'], 'second.epub'), metadata)).book;

    await repository.removeBook(first.bookId);
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(await repository.listRecentBooks()).toHaveLength(1);

    await repository.removeBook(second.bookId);
    expect(deleteDatabase).toHaveBeenCalledOnce();
    expect(deleteDatabase).toHaveBeenCalledWith('onlytranslate-ebooks');
    expect(await repository.listRecentBooks()).toEqual([]);
  });

  it('leaves no record when parsing fails and rejects files larger than the remaining quota', async () => {
    const badFile = new File(['broken'], 'broken.epub');
    await expect(repository.importBook(badFile, async () => { throw new Error('bad archive'); }))
      .rejects.toMatchObject({ code: 'PARSE_FAILED' });
    expect(await repository.listRecentBooks()).toEqual([]);

    storageManager.estimate.mockResolvedValueOnce({ usage: 999, quota: 1000 });
    await expect(repository.importBook(new File(['far-too-large'], 'large.epub'), metadata))
      .rejects.toEqual(expect.objectContaining({ code: 'INSUFFICIENT_STORAGE' }));
  });

  it('validates the file extension and empty files', async () => {
    await expect(repository.importBook(new File(['x'], 'book.pdf'), metadata)).rejects.toMatchObject({ code: 'INVALID_FILE' });
    await expect(repository.importBook(new File([], 'empty.epub'), metadata)).rejects.toMatchObject({ code: 'EMPTY_FILE' });
  });

  it('backs up and restores EPUB files, progress, and bookmarks while preserving other books', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const backedUpBook = (await repository.importBook(new File(['book-to-back-up'], 'backup.epub'), metadata)).book;
    await repository.saveProgress({
      bookId: backedUpBook.bookId,
      cfi: 'epubcfi(/6/4)',
      chapterHref: 'chapter-two.xhtml',
      percentage: .45,
      updatedAt: 10,
    });
    await repository.addBookmark({
      bookId: backedUpBook.bookId,
      cfi: 'epubcfi(/6/6)',
      chapterHref: 'chapter-two.xhtml',
      chapterLabel: 'Chapter two',
      excerpt: 'Saved excerpt',
    });
    const backup = await repository.createBackup();
    const backupBytes = await backup.arrayBuffer();
    const manifestLength = new DataView(backupBytes).getUint32(8, true);
    const manifest = JSON.parse(new TextDecoder().decode(backupBytes.slice(12, 12 + manifestLength)));
    expect(manifest.books[0]).toMatchObject({ epubLength: 15, coverLength: 5 });

    repository.close();
    indexedDb = new IDBFactory();
    repository = new EbookRepository(indexedDb, storageManager);
    const otherBook = (await repository.importBook(new File(['other-book'], 'other.epub'), metadata)).book;
    const replacedBook = (await repository.importBook(new File(['book-to-back-up'], 'renamed.epub'), metadata)).book;
    await repository.saveProgress({ bookId: replacedBook.bookId, percentage: .9, updatedAt: 20 });
    await repository.addBookmark({ bookId: replacedBook.bookId, cfi: 'epubcfi(/6/8)' });

    await expect(repository.restoreBackup(backup)).resolves.toEqual({ bookCount: 1, bookmarkCount: 1 });
    expect((await repository.listRecentBooks()).map(book => book.bookId)).toEqual(expect.arrayContaining([
      backedUpBook.bookId,
      otherBook.bookId,
    ]));
    expect(await repository.getProgress(backedUpBook.bookId)).toMatchObject({ percentage: .45, cfi: 'epubcfi(/6/4)' });
    expect(await repository.listBookmarks(backedUpBook.bookId)).toEqual([
      expect.objectContaining({ cfi: 'epubcfi(/6/6)', excerpt: 'Saved excerpt' }),
    ]);
    expect(await (await repository.getBook(backedUpBook.bookId))?.fileBlob.text()).toBe('book-to-back-up');
  });

  it('rejects a corrupted backup before changing the existing library', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const backedUpBook = (await repository.importBook(new File(['original-book'], 'backup.epub'), metadata)).book;
    const backupBytes = new Uint8Array(await (await repository.createBackup()).arrayBuffer());
    backupBytes[backupBytes.length - 1] ^= 0xff;

    repository.close();
    indexedDb = new IDBFactory();
    repository = new EbookRepository(indexedDb, storageManager);
    const existing = (await repository.importBook(new File(['existing-book'], 'existing.epub'), metadata)).book;

    await expect(repository.restoreBackup(new Blob([backupBytes]))).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect((await repository.listRecentBooks()).map(book => book.bookId)).toEqual([existing.bookId]);
    expect(await repository.getBook(backedUpBook.bookId)).toBeUndefined();
  });
});
