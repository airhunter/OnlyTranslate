import { describe, expect, it, vi } from 'vitest';

vi.mock('@/entrypoints/pdf/readerController', () => ({
  downloadRemotePdf: vi.fn(),
}));

import { addPdfToLibrary } from '@/entrypoints/pdf/library';

describe('PDF library integration', () => {
  it('downloads and stores an online PDF as a remote library record', async () => {
    const sourceUrl = 'https://example.com/paper.pdf';
    const file = new File(['%PDF-1.7'], 'paper.pdf', { type: 'application/pdf' });
    const book = {
      bookId: 'pdf-id',
      fileBlob: file,
      filename: file.name,
      fileSize: file.size,
      title: 'Paper',
      author: '',
      format: 'pdf' as const,
      sourceType: 'remote' as const,
      sourceUrl,
      addedAt: 1,
      lastOpenedAt: 1,
    };
    const repository = { importBook: vi.fn(async () => ({ book, duplicate: false })) };
    const download = vi.fn(async () => file);
    const extractMetadata = vi.fn(async () => ({ title: 'Paper', author: '' }));

    await expect(addPdfToLibrary({ repository, sourceUrl, download, extractMetadata }))
      .resolves.toEqual({ book, duplicate: false, file });
    expect(download).toHaveBeenCalledWith(sourceUrl);
    expect(repository.importBook).toHaveBeenCalledWith(file, extractMetadata, {
      sourceType: 'remote',
      sourceUrl,
    });
  });

  it('stores a selected local PDF without downloading it again', async () => {
    const file = new File(['%PDF-1.7'], 'local.pdf', { type: 'application/pdf' });
    const repository = {
      importBook: vi.fn(async () => ({
        book: { bookId: 'local-id' },
        duplicate: false,
      })),
    };
    const download = vi.fn();
    const extractMetadata = vi.fn(async () => ({ title: 'Local', author: '' }));

    await addPdfToLibrary({ repository: repository as never, file, download, extractMetadata });
    expect(download).not.toHaveBeenCalled();
    expect(repository.importBook).toHaveBeenCalledWith(file, extractMetadata, {
      sourceType: 'local',
      sourceUrl: undefined,
    });
  });
});
