import type { Bookmark, EbookRecord, ReadingState } from './types';

const BACKUP_MAGIC = new TextEncoder().encode('OTEBK001');
const BACKUP_HEADER_SIZE = BACKUP_MAGIC.byteLength + 4;
const MAX_MANIFEST_SIZE = 16 * 1024 * 1024;
const BACKUP_FORMAT = 'onlytranslate-ebook-library';
const BACKUP_VERSION = 1;

export const EBOOK_BACKUP_EXTENSION = '.onlytranslate-ebooks';
export const EBOOK_BACKUP_MIME_TYPE = 'application/vnd.onlytranslate.ebook-library';

export type EbookBackupErrorCode = 'INVALID_BACKUP' | 'UNSUPPORTED_VERSION' | 'INSUFFICIENT_STORAGE';

export class EbookBackupError extends Error {
  constructor(
    public readonly code: EbookBackupErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'EbookBackupError';
  }
}

export interface EbookBackupEntry {
  record: EbookRecord;
  progress?: ReadingState;
  bookmarks: Bookmark[];
}

interface BackupManifestBook {
  record: Omit<EbookRecord, 'fileBlob' | 'coverBlob'>;
  epubLength: number;
  epubType: string;
  coverLength: number;
  coverType: string;
  coverHash: string;
  progress?: ReadingState;
  bookmarks: Bookmark[];
}

interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: number;
  books: BackupManifestBook[];
}

function invalidBackup(message: string, cause?: unknown): EbookBackupError {
  return new EbookBackupError('INVALID_BACKUP', message, cause === undefined ? undefined : { cause });
}

function createHeader(manifestLength: number): ArrayBuffer {
  const header = new ArrayBuffer(BACKUP_HEADER_SIZE);
  new Uint8Array(header, 0, BACKUP_MAGIC.byteLength).set(BACKUP_MAGIC);
  new DataView(header).setUint32(BACKUP_MAGIC.byteLength, manifestLength, true);
  return header;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeNumber(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function parseRecord(value: unknown, epubLength: number): Omit<EbookRecord, 'fileBlob' | 'coverBlob'> {
  const format = value && isObject(value) && value.format === 'pdf'
    ? 'pdf'
    : value && isObject(value) && typeof value.filename === 'string' && value.filename.toLocaleLowerCase().endsWith('.pdf')
      ? 'pdf'
      : 'epub';
  if (!isObject(value)
    || typeof value.bookId !== 'string'
    || !/^[a-f\d]{64}$/.test(value.bookId)
    || typeof value.filename !== 'string'
    || !value.filename.toLocaleLowerCase().endsWith(`.${format}`)
    || value.fileSize !== epubLength
    || typeof value.title !== 'string'
    || typeof value.author !== 'string'
    || !isSafeNumber(value.addedAt)
    || !isSafeNumber(value.lastOpenedAt)
    || (value.format !== undefined && value.format !== 'epub' && value.format !== 'pdf')
    || (value.sourceType !== undefined && value.sourceType !== 'local' && value.sourceType !== 'remote')
    || !isOptionalString(value.sourceUrl)) {
    throw invalidBackup('The backup contains invalid ebook metadata');
  }

  return {
    bookId: value.bookId,
    filename: value.filename,
    fileSize: value.fileSize,
    title: value.title,
    author: value.author,
    format,
    sourceType: value.sourceType === 'remote' ? 'remote' : 'local',
    sourceUrl: value.sourceUrl,
    addedAt: value.addedAt,
    lastOpenedAt: value.lastOpenedAt,
  };
}

function parseProgress(value: unknown, bookId: string): ReadingState | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)
    || value.bookId !== bookId
    || !isOptionalString(value.cfi)
    || !isOptionalString(value.chapterHref)
    || (value.pageNumber !== undefined && !isSafeNumber(value.pageNumber, 1))
    || typeof value.percentage !== 'number'
    || !Number.isFinite(value.percentage)
    || value.percentage < 0
    || value.percentage > 1
    || !isSafeNumber(value.updatedAt)) {
    throw invalidBackup('The backup contains invalid reading progress');
  }
  return value as unknown as ReadingState;
}

function parseBookmarks(value: unknown, bookId: string): Bookmark[] {
  if (!Array.isArray(value)) throw invalidBackup('The backup contains invalid bookmarks');
  const cfiValues = new Set<string>();
  return value.map(item => {
    if (!isObject(item)
      || typeof item.id !== 'string'
      || !item.id
      || item.bookId !== bookId
      || typeof item.cfi !== 'string'
      || !item.cfi
      || !isOptionalString(item.chapterHref)
      || !isOptionalString(item.chapterLabel)
      || !isOptionalString(item.excerpt)
      || !isSafeNumber(item.createdAt)
      || cfiValues.has(item.cfi)) {
      throw invalidBackup('The backup contains invalid bookmarks');
    }
    cfiValues.add(item.cfi);
    return item as unknown as Bookmark;
  });
}

function parseManifest(value: unknown): BackupManifest {
  if (!isObject(value) || value.format !== BACKUP_FORMAT || !isSafeNumber(value.createdAt) || !Array.isArray(value.books)) {
    throw invalidBackup('This is not an OnlyTranslate ebook backup');
  }
  if (value.version !== BACKUP_VERSION) {
    throw new EbookBackupError('UNSUPPORTED_VERSION', 'This ebook backup version is not supported');
  }

  const bookIds = new Set<string>();
  const books = value.books.map(item => {
    if (!isObject(item)
      || !isSafeNumber(item.epubLength, 1)
      || typeof item.epubType !== 'string'
      || !isSafeNumber(item.coverLength)
      || typeof item.coverType !== 'string'
      || typeof item.coverHash !== 'string'
      || (item.coverLength > 0 && !/^[a-f\d]{64}$/.test(item.coverHash))
      || (item.coverLength === 0 && item.coverHash !== '')) {
      throw invalidBackup('The backup manifest is incomplete');
    }
    const record = parseRecord(item.record, item.epubLength);
    if (bookIds.has(record.bookId)) throw invalidBackup('The backup contains duplicate ebooks');
    bookIds.add(record.bookId);
    return {
      record,
      epubLength: item.epubLength,
      epubType: item.epubType,
      coverLength: item.coverLength,
      coverType: item.coverType,
      coverHash: item.coverHash,
      progress: parseProgress(item.progress, record.bookId),
      bookmarks: parseBookmarks(item.bookmarks, record.bookId),
    };
  });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: value.createdAt,
    books,
  };
}

async function calculateHash(fileBlob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await fileBlob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createEbookBackup(entries: EbookBackupEntry[], createdAt = Date.now()): Promise<Blob> {
  const books: BackupManifestBook[] = await Promise.all(entries.map(async ({ record, progress, bookmarks }) => {
    const { fileBlob, coverBlob, ...metadata } = record;
    return {
      record: metadata,
      epubLength: fileBlob.size,
      epubType: fileBlob.type,
      coverLength: coverBlob?.size ?? 0,
      coverType: coverBlob?.type ?? '',
      coverHash: coverBlob ? await calculateHash(coverBlob) : '',
      progress,
      bookmarks,
    };
  }));
  const manifest: BackupManifest = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, books };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_MANIFEST_SIZE) {
    throw new EbookBackupError('INVALID_BACKUP', 'The ebook backup manifest is too large');
  }

  const payload = entries.flatMap(({ record }) => (
    record.coverBlob ? [record.fileBlob, record.coverBlob] : [record.fileBlob]
  ));
  return new Blob([createHeader(manifestBytes.byteLength), manifestBytes, ...payload], {
    type: EBOOK_BACKUP_MIME_TYPE,
  });
}

export async function readEbookBackup(source: Blob): Promise<{ createdAt: number; entries: EbookBackupEntry[] }> {
  if (source.size < BACKUP_HEADER_SIZE) throw invalidBackup('The ebook backup is incomplete');

  const header = await source.slice(0, BACKUP_HEADER_SIZE).arrayBuffer();
  const magic = new Uint8Array(header, 0, BACKUP_MAGIC.byteLength);
  if (!BACKUP_MAGIC.every((byte, index) => magic[index] === byte)) {
    throw invalidBackup('This is not an OnlyTranslate ebook backup');
  }

  const manifestLength = new DataView(header).getUint32(BACKUP_MAGIC.byteLength, true);
  if (manifestLength <= 0 || manifestLength > MAX_MANIFEST_SIZE || BACKUP_HEADER_SIZE + manifestLength > source.size) {
    throw invalidBackup('The ebook backup manifest is incomplete');
  }

  let manifestValue: unknown;
  try {
    const manifestBytes = await source.slice(BACKUP_HEADER_SIZE, BACKUP_HEADER_SIZE + manifestLength).arrayBuffer();
    manifestValue = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (error) {
    throw invalidBackup('The ebook backup manifest cannot be read', error);
  }
  const manifest = parseManifest(manifestValue);

  let offset = BACKUP_HEADER_SIZE + manifestLength;
  const entries: EbookBackupEntry[] = [];
  for (const item of manifest.books) {
    const epubEnd = offset + item.epubLength;
    const coverEnd = epubEnd + item.coverLength;
    if (coverEnd > source.size) throw invalidBackup('The ebook backup data is incomplete');

    const fileBlob = source.slice(offset, epubEnd, item.epubType || 'application/epub+zip');
    const coverBlob = item.coverLength > 0 ? source.slice(epubEnd, coverEnd, item.coverType) : undefined;
    if (await calculateHash(fileBlob) !== item.record.bookId
      || (coverBlob && await calculateHash(coverBlob) !== item.coverHash)) {
      throw invalidBackup('An ebook in the backup failed its integrity check');
    }
    entries.push({
      record: { ...item.record, fileBlob, coverBlob },
      progress: item.progress,
      bookmarks: item.bookmarks,
    });
    offset = coverEnd;
  }
  if (offset !== source.size) throw invalidBackup('The ebook backup contains unexpected trailing data');

  return { createdAt: manifest.createdAt, entries };
}
