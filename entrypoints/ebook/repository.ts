import type {
  Bookmark,
  EbookMetadataExtractor,
  EbookRecord,
  ReadingState,
  StorageEstimate,
  EbookSourceType,
} from './types';
import { getEbookFormat } from './types';
import {
  createEbookBackup,
  EbookBackupError,
  readEbookBackup,
} from './backup';

const DATABASE_NAME = 'onlytranslate-ebooks';
const DATABASE_VERSION = 1;
const BOOKS_STORE = 'books';
const PROGRESS_STORE = 'readingStates';
const BOOKMARKS_STORE = 'bookmarks';

export class EbookImportError extends Error {
  constructor(
    public readonly code: 'INVALID_FILE' | 'EMPTY_FILE' | 'INSUFFICIENT_STORAGE' | 'QUOTA_EXCEEDED' | 'PARSE_FAILED',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'EbookImportError';
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

async function calculateBookId(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function detectBookFormat(filename: string): 'epub' | 'pdf' | undefined {
  const normalized = filename.toLocaleLowerCase();
  if (normalized.endsWith('.epub')) return 'epub';
  if (normalized.endsWith('.pdf')) return 'pdf';
  return undefined;
}

function looksLikePdf(data: ArrayBuffer): boolean {
  const header = new TextDecoder('latin1').decode(data.slice(0, Math.min(1024, data.byteLength)));
  return header.includes('%PDF-');
}

export interface EbookImportOptions {
  sourceType?: EbookSourceType;
  sourceUrl?: string;
}

export class EbookRepository {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(
    private readonly indexedDb: IDBFactory = indexedDB,
    private readonly storageManager: Pick<StorageManager, 'estimate' | 'persist' | 'persisted'> | undefined = navigator.storage,
  ) {}

  async importBook(
    file: File,
    extractMetadata: EbookMetadataExtractor,
    options: EbookImportOptions = {},
  ): Promise<{ book: EbookRecord; duplicate: boolean }> {
    const format = detectBookFormat(file.name);
    if (!format) throw new EbookImportError('INVALID_FILE', 'Only EPUB and PDF files are supported');
    if (file.size <= 0) {
      throw new EbookImportError('EMPTY_FILE', 'The book file is empty');
    }

    const data = await file.arrayBuffer();
    if (format === 'pdf' && !looksLikePdf(data)) {
      throw new EbookImportError('PARSE_FAILED', 'The PDF could not be parsed');
    }
    const bookId = await calculateBookId(data);
    const existing = await this.getBook(bookId);
    if (existing) {
      const reopened = {
        ...existing,
        format: getEbookFormat(existing),
        sourceType: options.sourceType ?? existing.sourceType ?? 'local',
        sourceUrl: options.sourceUrl ?? existing.sourceUrl,
        lastOpenedAt: Date.now(),
      };
      await this.putBook(reopened);
      return { book: reopened, duplicate: true };
    }

    const estimate = await this.estimateStorage();
    const remaining = Math.max(0, estimate.quota - estimate.usage);
    if (estimate.quota > 0 && remaining < file.size) {
      throw new EbookImportError('INSUFFICIENT_STORAGE', 'There is not enough browser storage for this book');
    }

    let metadata;
    try {
      metadata = await extractMetadata(data.slice(0), file);
    } catch (error) {
      throw new EbookImportError('PARSE_FAILED', 'The book could not be parsed', { cause: error });
    }

    const now = Date.now();
    const book: EbookRecord = {
      bookId,
      fileBlob: new Blob([data], { type: file.type || (format === 'pdf' ? 'application/pdf' : 'application/epub+zip') }),
      filename: file.name,
      fileSize: file.size,
      title: metadata.title.trim() || file.name.replace(/\.(?:epub|pdf)$/i, ''),
      author: metadata.author.trim(),
      coverBlob: metadata.coverBlob,
      format,
      sourceType: options.sourceType ?? 'local',
      sourceUrl: options.sourceUrl,
      addedAt: now,
      lastOpenedAt: now,
    };

    try {
      await this.putBook(book);
      await this.storageManager?.persist?.();
      return { book, duplicate: false };
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw new EbookImportError('QUOTA_EXCEEDED', 'The browser storage quota was exceeded', { cause: error });
      }
      throw error;
    }
  }

  async listRecentBooks(): Promise<EbookRecord[]> {
    const database = await this.open();
    const transaction = database.transaction(BOOKS_STORE, 'readonly');
    const books = await requestResult(transaction.objectStore(BOOKS_STORE).getAll()) as EbookRecord[];
    await transactionDone(transaction);
    return books
      .map(book => ({ ...book, format: getEbookFormat(book), sourceType: book.sourceType ?? 'local' }))
      .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
  }

  async getBook(bookId: string): Promise<EbookRecord | undefined> {
    const database = await this.open();
    const transaction = database.transaction(BOOKS_STORE, 'readonly');
    const book = await requestResult(transaction.objectStore(BOOKS_STORE).get(bookId)) as EbookRecord | undefined;
    await transactionDone(transaction);
    return book ? { ...book, format: getEbookFormat(book), sourceType: book.sourceType ?? 'local' } : undefined;
  }

  async findBookBySourceUrl(sourceUrl: string): Promise<EbookRecord | undefined> {
    const books = await this.listRecentBooks();
    return books.find(book => book.sourceUrl === sourceUrl);
  }

  async markOpened(bookId: string): Promise<void> {
    const book = await this.getBook(bookId);
    if (!book) return;
    await this.putBook({ ...book, lastOpenedAt: Date.now() });
  }

  async removeBook(bookId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction([BOOKS_STORE, PROGRESS_STORE, BOOKMARKS_STORE], 'readwrite');
    const bookStore = transaction.objectStore(BOOKS_STORE);
    bookStore.delete(bookId);
    transaction.objectStore(PROGRESS_STORE).delete(bookId);
    const bookmarkStore = transaction.objectStore(BOOKMARKS_STORE);
    const bookmarkKeys = await requestResult(bookmarkStore.index('bookId').getAllKeys(bookId));
    bookmarkKeys.forEach(key => bookmarkStore.delete(key));
    const remainingBooks = await requestResult(bookStore.count());
    await transactionDone(transaction);
    if (remainingBooks === 0) await this.deleteDatabase(database);
  }

  async saveProgress(progress: ReadingState): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(PROGRESS_STORE, 'readwrite');
    transaction.objectStore(PROGRESS_STORE).put({ ...progress, updatedAt: Date.now() });
    await transactionDone(transaction);
  }

  async getProgress(bookId: string): Promise<ReadingState | undefined> {
    const database = await this.open();
    const transaction = database.transaction(PROGRESS_STORE, 'readonly');
    const progress = await requestResult(transaction.objectStore(PROGRESS_STORE).get(bookId)) as ReadingState | undefined;
    await transactionDone(transaction);
    return progress;
  }

  async addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<{ bookmark: Bookmark; duplicate: boolean }> {
    const database = await this.open();
    const transaction = database.transaction(BOOKMARKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const existing = await requestResult(store.index('bookIdCfi').get([bookmark.bookId, bookmark.cfi])) as Bookmark | undefined;
    if (existing) {
      await transactionDone(transaction);
      return { bookmark: existing, duplicate: true };
    }
    const created: Bookmark = {
      ...bookmark,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    store.add(created);
    await transactionDone(transaction);
    return { bookmark: created, duplicate: false };
  }

  async listBookmarks(bookId: string): Promise<Bookmark[]> {
    const database = await this.open();
    const transaction = database.transaction(BOOKMARKS_STORE, 'readonly');
    const bookmarks = await requestResult(transaction.objectStore(BOOKMARKS_STORE).index('bookId').getAll(bookId)) as Bookmark[];
    await transactionDone(transaction);
    return bookmarks.sort((left, right) => right.createdAt - left.createdAt);
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(BOOKMARKS_STORE, 'readwrite');
    transaction.objectStore(BOOKMARKS_STORE).delete(bookmarkId);
    await transactionDone(transaction);
  }

  async createBackup(): Promise<Blob> {
    const database = await this.open();
    const transaction = database.transaction([BOOKS_STORE, PROGRESS_STORE, BOOKMARKS_STORE], 'readonly');
    const [books, progressEntries, bookmarks] = await Promise.all([
      requestResult(transaction.objectStore(BOOKS_STORE).getAll()) as Promise<EbookRecord[]>,
      requestResult(transaction.objectStore(PROGRESS_STORE).getAll()) as Promise<ReadingState[]>,
      requestResult(transaction.objectStore(BOOKMARKS_STORE).getAll()) as Promise<Bookmark[]>,
    ]);
    await transactionDone(transaction);

    const progressByBook = new Map(progressEntries.map(progress => [progress.bookId, progress]));
    const bookmarksByBook = new Map<string, Bookmark[]>();
    bookmarks.forEach(bookmark => {
      const grouped = bookmarksByBook.get(bookmark.bookId) ?? [];
      grouped.push(bookmark);
      bookmarksByBook.set(bookmark.bookId, grouped);
    });
    return await createEbookBackup(books.map(record => ({
      record,
      progress: progressByBook.get(record.bookId),
      bookmarks: bookmarksByBook.get(record.bookId) ?? [],
    })));
  }

  async restoreBackup(source: Blob): Promise<{ bookCount: number; bookmarkCount: number }> {
    const backup = await readEbookBackup(source);
    const database = await this.open();
    const transaction = database.transaction([BOOKS_STORE, PROGRESS_STORE, BOOKMARKS_STORE], 'readwrite');
    const bookStore = transaction.objectStore(BOOKS_STORE);
    const progressStore = transaction.objectStore(PROGRESS_STORE);
    const bookmarkStore = transaction.objectStore(BOOKMARKS_STORE);
    let bookmarkCount = 0;

    try {
      for (const entry of backup.entries) {
        const existingBookmarkKeys = await requestResult(bookmarkStore.index('bookId').getAllKeys(entry.record.bookId));
        existingBookmarkKeys.forEach(key => bookmarkStore.delete(key));
        bookStore.put(entry.record);
        if (entry.progress) progressStore.put(entry.progress);
        else progressStore.delete(entry.record.bookId);
        entry.bookmarks.forEach(bookmark => {
          bookmarkStore.add({ ...bookmark, id: crypto.randomUUID() });
          bookmarkCount += 1;
        });
      }
      await transactionDone(transaction);
      try {
        await this.storageManager?.persist?.();
      } catch {
        // The restored data is already committed; persistence is best-effort.
      }
      return { bookCount: backup.entries.length, bookmarkCount };
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The browser may already have aborted the transaction.
      }
      if (isQuotaExceededError(error) || transaction.error?.name === 'QuotaExceededError') {
        throw new EbookBackupError('INSUFFICIENT_STORAGE', 'There is not enough browser storage to restore this backup', { cause: error });
      }
      if (error instanceof EbookBackupError) throw error;
      throw new EbookBackupError('INVALID_BACKUP', 'The ebook backup could not be restored', { cause: error });
    }
  }

  async estimateStorage(): Promise<StorageEstimate> {
    try {
      const [estimate, persisted] = await Promise.all([
        this.storageManager?.estimate?.(),
        this.storageManager?.persisted?.(),
      ]);
      return {
        usage: estimate?.usage ?? 0,
        quota: estimate?.quota ?? 0,
        persisted: persisted ?? false,
      };
    } catch {
      return { usage: 0, quota: 0, persisted: false };
    }
  }

  close(): void {
    if (!this.databasePromise) return;
    void this.databasePromise.then(database => database.close());
    this.databasePromise = undefined;
  }

  private async putBook(book: EbookRecord): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(BOOKS_STORE, 'readwrite');
    transaction.objectStore(BOOKS_STORE).put(book);
    await transactionDone(transaction);
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BOOKS_STORE)) {
          database.createObjectStore(BOOKS_STORE, { keyPath: 'bookId' });
        }
        if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
          database.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' });
        }
        if (!database.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const bookmarks = database.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
          bookmarks.createIndex('bookId', 'bookId');
          bookmarks.createIndex('bookIdCfi', ['bookId', 'cfi'], { unique: true });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          this.databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        this.databasePromise = undefined;
        reject(request.error ?? new Error('Failed to open the ebook database'));
      };
    });
    return this.databasePromise;
  }

  private async deleteDatabase(database: IDBDatabase): Promise<void> {
    database.close();
    this.databasePromise = undefined;
    await new Promise<void>((resolve, reject) => {
      const request = this.indexedDb.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to delete the ebook database'));
    });
  }
}
