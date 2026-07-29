import { storage } from '@wxt-dev/storage';
import {
  DEFAULT_READER_SETTINGS,
  type EbookDisplayMode,
  type EbookReaderSettings,
} from './types';

const STORAGE_KEY = 'local:ebook-reader-settings';
const DISPLAY_MODES = new Set<EbookDisplayMode>(['original', 'bilingual', 'translation']);

export async function loadReaderSettings(): Promise<EbookReaderSettings> {
  const stored = await storage.getItem<EbookReaderSettings>(STORAGE_KEY);
  return {
    fontScale: Math.min(180, Math.max(70, stored?.fontScale ?? DEFAULT_READER_SETTINGS.fontScale)),
    lineHeight: Math.min(2.6, Math.max(1.2, stored?.lineHeight ?? DEFAULT_READER_SETTINGS.lineHeight)),
    displayMode: stored?.displayMode && DISPLAY_MODES.has(stored.displayMode)
      ? stored.displayMode
      : DEFAULT_READER_SETTINGS.displayMode,
  };
}

export async function saveReaderSettings(settings: EbookReaderSettings): Promise<void> {
  await storage.setItem(STORAGE_KEY, settings);
}
