import { describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: { runtime: { getURL: vi.fn() } },
}));

import { getEbookPageUrl, getRequestedEbookId } from '../../entrypoints/ebook/url';

describe('ebook extension URL', () => {
  it('resolves the WXT unlisted page from the extension root', () => {
    const getURL = vi.fn((path: string) => `moz-extension://onlytranslate${path}`);
    expect(getEbookPageUrl(undefined, { getURL })).toBe('moz-extension://onlytranslate/ebook.html');
    expect(getURL).toHaveBeenCalledWith('/ebook.html');
  });

  it('creates and reads a direct link to a saved book', () => {
    const getURL = vi.fn((path: string) => `chrome-extension://onlytranslate${path}`);
    const url = getEbookPageUrl('book id/one', { getURL });

    expect(url).toBe('chrome-extension://onlytranslate/ebook.html?bookId=book+id%2Fone');
    expect(getRequestedEbookId(new URL(url).search)).toBe('book id/one');
    expect(getRequestedEbookId('')).toBeUndefined();
  });
});
