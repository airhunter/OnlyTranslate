import { extractLibraryBookMetadata } from '@/entrypoints/ebook/importMetadata';
import type { EbookImportOptions, EbookRepository } from '@/entrypoints/ebook/repository';
import type { EbookMetadataExtractor, EbookRecord } from '@/entrypoints/ebook/types';
import { downloadRemotePdf } from './readerController';

export interface AddPdfToLibraryOptions {
  repository: Pick<EbookRepository, 'importBook'>;
  file?: File;
  sourceUrl?: string;
  download?: (sourceUrl: string) => Promise<File>;
  extractMetadata?: EbookMetadataExtractor;
}

export async function addPdfToLibrary(options: AddPdfToLibraryOptions): Promise<{
  book: EbookRecord;
  duplicate: boolean;
  file: File;
}> {
  const file = options.file
    ?? (options.sourceUrl ? await (options.download ?? downloadRemotePdf)(options.sourceUrl) : undefined);
  if (!file) throw new Error('No PDF source is available');
  const importOptions: EbookImportOptions = {
    sourceType: options.sourceUrl ? 'remote' : 'local',
    sourceUrl: options.sourceUrl,
  };
  const result = await options.repository.importBook(
    file,
    options.extractMetadata ?? extractLibraryBookMetadata,
    importOptions,
  );
  return { ...result, file };
}
