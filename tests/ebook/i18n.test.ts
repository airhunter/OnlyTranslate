import { describe, expect, it } from 'vitest';
import { messages } from '../../entrypoints/utils/i18n/messages';

describe('ebook i18n', () => {
  it('provides the complete ebook UI in all supported locales', () => {
    const locales = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP'] as const;
    const referenceKeys = Object.keys(messages['zh-CN'].ebook).sort();
    for (const locale of locales) {
      expect(Object.keys(messages[locale].ebook).sort()).toEqual(referenceKeys);
      expect(messages[locale].popup.ebookReader).toBeTruthy();
      expect(Object.values(messages[locale].ebook).every(value => typeof value === 'string' && value.length > 0)).toBe(true);
    }
  });
});
