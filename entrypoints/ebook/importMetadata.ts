import type { EbookImportMetadata } from './types';

export async function extractLibraryBookMetadata(data: ArrayBuffer, file: File): Promise<EbookImportMetadata> {
  if (file.name.toLocaleLowerCase().endsWith('.pdf')) {
    return {
      title: file.name.replace(/\.pdf$/i, ''),
      author: '',
    };
  }
  const { extractEpubMetadata } = await import('./readerController');
  return extractEpubMetadata(data, file);
}
