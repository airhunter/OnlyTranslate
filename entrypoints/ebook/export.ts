import type { EbookRecord } from './types';

export interface EbookDownloadEnvironment {
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createAnchor(): HTMLAnchorElement;
  schedule(callback: () => void): void;
}

const defaultEnvironment: EbookDownloadEnvironment = {
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement('a'),
  schedule: callback => window.setTimeout(callback, 0),
};

export function resolveOriginalBookFilename(
  book: Pick<EbookRecord, 'filename' | 'title' | 'fileBlob'>,
): string {
  const originalFilename = book.filename.trim();
  if (originalFilename) return originalFilename;

  const title = book.title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'OnlyTranslate-book';
  const extension = book.fileBlob.type === 'application/pdf' ? '.pdf' : '.epub';
  return title.toLocaleLowerCase().endsWith(extension) ? title : `${title}${extension}`;
}

export function downloadOriginalBook(
  book: Pick<EbookRecord, 'filename' | 'title' | 'fileBlob'>,
  environment: EbookDownloadEnvironment = defaultEnvironment,
): string {
  const filename = resolveOriginalBookFilename(book);
  const objectUrl = environment.createObjectUrl(book.fileBlob);
  const anchor = environment.createAnchor();
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  environment.schedule(() => environment.revokeObjectUrl(objectUrl));
  return filename;
}
