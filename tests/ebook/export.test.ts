import { describe, expect, it, vi } from 'vitest';
import {
  downloadOriginalBook,
  resolveOriginalBookFilename,
  type EbookDownloadEnvironment,
} from '../../entrypoints/ebook/export';

describe('ebook original file export', () => {
  it('downloads the stored blob with its original filename', () => {
    const blob = new Blob(['book'], { type: 'application/epub+zip' });
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const revokeObjectUrl = vi.fn();
    const environment: EbookDownloadEnvironment = {
      createObjectUrl: vi.fn(() => 'blob:original-book'),
      revokeObjectUrl,
      createAnchor: () => anchor,
      schedule: callback => callback(),
    };

    expect(downloadOriginalBook({ filename: 'Pride and Prejudice.epub', title: 'Pride and Prejudice', fileBlob: blob }, environment))
      .toBe('Pride and Prejudice.epub');
    expect(environment.createObjectUrl).toHaveBeenCalledWith(blob);
    expect(anchor.download).toBe('Pride and Prejudice.epub');
    expect(anchor.href).toBe('blob:original-book');
    expect(click).toHaveBeenCalledOnce();
    expect(anchor.isConnected).toBe(false);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:original-book');
  });

  it('provides a format-aware fallback when an older record has no filename', () => {
    expect(resolveOriginalBookFilename({
      filename: ' ',
      title: 'Research / Notes',
      fileBlob: new Blob(['pdf'], { type: 'application/pdf' }),
    })).toBe('Research _ Notes.pdf');
  });
});
