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

  it('uses the localized OnlyTranslate library name in every locale', () => {
    expect(messages['zh-CN'].ebook.libraryTitle).toBe('只译书架');
    expect(messages['en-US'].ebook.libraryTitle).toBe('OnlyTranslate Library');
    expect(messages['zh-TW'].ebook.libraryTitle).toBe('只譯書架');
    expect(messages['ja-JP'].ebook.libraryTitle).toBe('OnlyTranslate ライブラリ');
  });
});
