import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.hoisted(() => vi.fn());
const setItem = vi.hoisted(() => vi.fn());

vi.mock('@wxt-dev/storage', () => ({
  storage: { getItem, setItem },
}));

import { loadReaderSettings, saveReaderSettings } from '../../entrypoints/ebook/settings';

describe('ebook reader settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('migrates existing settings to the independent bilingual display mode', async () => {
    getItem.mockResolvedValue({ fontScale: 120, lineHeight: 2 });

    await expect(loadReaderSettings()).resolves.toEqual({
      fontScale: 120,
      lineHeight: 2,
      displayMode: 'bilingual',
    });
  });

  it('keeps a valid independent display mode and persists it with reader settings', async () => {
    getItem.mockResolvedValue({ fontScale: 120, lineHeight: 2, displayMode: 'original' });
    const settings = await loadReaderSettings();

    expect(settings.displayMode).toBe('original');
    await saveReaderSettings(settings);
    expect(setItem).toHaveBeenCalledWith('local:ebook-reader-settings', settings);
  });

  it('falls back from an invalid stored display mode', async () => {
    getItem.mockResolvedValue({ fontScale: 100, lineHeight: 1.7, displayMode: 'unknown' });

    await expect(loadReaderSettings()).resolves.toMatchObject({ displayMode: 'bilingual' });
  });
});
