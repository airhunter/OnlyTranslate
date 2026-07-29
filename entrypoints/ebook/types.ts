export interface EbookRecord {
  bookId: string;
  fileBlob: Blob;
  filename: string;
  fileSize: number;
  title: string;
  author: string;
  coverBlob?: Blob;
  addedAt: number;
  lastOpenedAt: number;
}

export interface EbookImportMetadata {
  title: string;
  author: string;
  coverBlob?: Blob;
}

export interface ReadingState {
  bookId: string;
  cfi?: string;
  chapterHref?: string;
  percentage: number;
  updatedAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  cfi: string;
  chapterHref?: string;
  chapterLabel?: string;
  excerpt?: string;
  createdAt: number;
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  persisted: boolean;
}

export type EbookDisplayMode = 'original' | 'bilingual' | 'translation';

export interface EbookReaderSettings {
  fontScale: number;
  lineHeight: number;
  displayMode: EbookDisplayMode;
}

export const DEFAULT_READER_SETTINGS: EbookReaderSettings = {
  fontScale: 100,
  lineHeight: 1.7,
  displayMode: 'bilingual',
};

export type EbookMetadataExtractor = (data: ArrayBuffer, file: File) => Promise<EbookImportMetadata>;
