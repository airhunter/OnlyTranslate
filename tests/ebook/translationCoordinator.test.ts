import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelAllTranslations = vi.hoisted(() => vi.fn());
vi.mock('../../entrypoints/utils/translateApi', () => ({
  cacheTranslationResult: vi.fn(),
  cancelAllTranslations,
  isTranslationCancelledError: (error: unknown) => (error as { name?: string })?.name === 'TranslationCancelledError',
  translateText: vi.fn(),
}));

import {
  EbookTranslationCoordinator,
  type EbookTranslationStatus,
} from '../../entrypoints/ebook/translationCoordinator';

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<html><head></head><body>${html}</body></html>`, 'text/html');
}

describe('EbookTranslationCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses batch mode and prioritizes visible units', async () => {
    const document = parse('<p>Visible paragraph</p><p>Background paragraph</p>');
    const paragraphs = document.querySelectorAll('p');
    paragraphs[0].getBoundingClientRect = () => ({ top: 10, bottom: 30 } as DOMRect);
    paragraphs[1].getBoundingClientRect = () => ({ top: 5000, bottom: 5030 } as DOMRect);
    const translate = vi.fn(async (origin: string) => `译：${origin}`);
    const statuses: unknown[] = [];
    const coordinator = new EbookTranslationCoordinator({ translate, onStatus: status => statuses.push(status) });

    await coordinator.start(document, 'Book · Chapter', 'bilingual');

    expect(translate).toHaveBeenNthCalledWith(1, 'Visible paragraph', 'Book · Chapter', { allowBatch: true, priority: 'high' });
    expect(translate).toHaveBeenNthCalledWith(2, 'Background paragraph', 'Book · Chapter', { allowBatch: true, priority: 'background' });
    expect(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).toHaveLength(2);
    expect(statuses.at(-1)).toEqual({ total: 2, completed: 2, failed: 0, running: false });
  });

  it('does not let a cancelled chapter write into the document', async () => {
    let resolveTranslation!: (value: string) => void;
    const translate = vi.fn(() => new Promise<string>(resolve => { resolveTranslation = resolve; }));
    const document = parse('<p>Old chapter</p>');
    const coordinator = new EbookTranslationCoordinator({ translate });

    const running = coordinator.start(document, 'Old', 'bilingual');
    coordinator.cancel();
    resolveTranslation('旧章节译文');
    await running;

    expect(document.querySelector('[data-onlytranslate-ebook-translation]')).toBeNull();
  });

  it('tracks failures and retries only failed units', async () => {
    const document = parse('<p>First paragraph</p><p>Second paragraph</p>');
    const translate = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('第二段')
      .mockResolvedValueOnce('第一段');
    const statuses: Array<{ failed: number; running: boolean }> = [];
    const coordinator = new EbookTranslationCoordinator({ translate, onStatus: status => statuses.push(status) });

    await coordinator.start(document, 'Chapter', 'bilingual');
    expect(statuses.at(-1)).toMatchObject({ failed: 1, running: false });
    await coordinator.retryFailed();

    expect(translate).toHaveBeenCalledTimes(3);
    expect(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).toHaveLength(2);
    expect(statuses.at(-1)).toMatchObject({ failed: 0, running: false });
  });

  it('keeps the translation marker style when EPUB author CSS resets div styles', async () => {
    const document = parse(`
      <style>#pg-header div { all: inherit; color: #24272d; margin-block: 1em; }</style>
      <header id="pg-header"><div>Project Gutenberg license text</div></header>
    `);
    const coordinator = new EbookTranslationCoordinator({
      translate: vi.fn(async () => '古腾堡版权说明'),
    });

    await coordinator.start(document, 'Project Gutenberg', 'bilingual');

    const translation = document.querySelector<HTMLElement>('[data-onlytranslate-ebook-translation]');
    expect(translation).not.toBeNull();
    expect(document.defaultView?.getComputedStyle(translation!).color).toBe('#3975d7');
  });

  it('replaces the chapter and writes cache only after every fresh translation succeeds', async () => {
    const document = parse('<p>First paragraph</p><p>Second paragraph</p>');
    const translate = vi.fn()
      .mockResolvedValueOnce('旧译一')
      .mockResolvedValueOnce('旧译二')
      .mockResolvedValueOnce('新译一')
      .mockResolvedValueOnce('新译二');
    const cacheTranslation = vi.fn();
    const coordinator = new EbookTranslationCoordinator({ translate, cacheTranslation });

    await coordinator.start(document, 'Chapter', 'bilingual');
    await expect(coordinator.retranslate()).resolves.toBe('success');

    expect(translate).toHaveBeenNthCalledWith(3, 'First paragraph', 'Chapter', {
      allowBatch: true,
      priority: 'high',
      useCache: false,
    });
    expect(translate).toHaveBeenNthCalledWith(4, 'Second paragraph', 'Chapter', {
      allowBatch: true,
      priority: 'high',
      useCache: false,
    });
    expect(Array.from(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).map(node => node.textContent))
      .toEqual(['新译一', '新译二']);
    expect(cacheTranslation).toHaveBeenCalledTimes(2);
    expect(cacheTranslation).toHaveBeenNthCalledWith(1, 'First paragraph', '新译一');
    expect(cacheTranslation).toHaveBeenNthCalledWith(2, 'Second paragraph', '新译二');
  });

  it('keeps the previous chapter and cache untouched when a fresh translation fails', async () => {
    const document = parse('<p>First paragraph</p><p>Second paragraph</p>');
    const translate = vi.fn()
      .mockResolvedValueOnce('旧译一')
      .mockResolvedValueOnce('旧译二')
      .mockResolvedValueOnce('新译一')
      .mockRejectedValueOnce(new Error('offline'));
    const cacheTranslation = vi.fn();
    const statuses: EbookTranslationStatus[] = [];
    const coordinator = new EbookTranslationCoordinator({
      translate,
      cacheTranslation,
      onStatus: status => statuses.push(status),
    });

    await coordinator.start(document, 'Chapter', 'bilingual');
    await expect(coordinator.retranslate()).resolves.toBe('failed');

    expect(Array.from(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).map(node => node.textContent))
      .toEqual(['旧译一', '旧译二']);
    expect(cacheTranslation).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toEqual({ total: 2, completed: 2, failed: 0, running: false });
  });
});
