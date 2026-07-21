import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelAllTranslations = vi.hoisted(() => vi.fn());
vi.mock('../../entrypoints/utils/translateApi', () => ({
  cancelAllTranslations,
  isTranslationCancelledError: (error: unknown) => (error as { name?: string })?.name === 'TranslationCancelledError',
  translateText: vi.fn(),
}));

import { EbookTranslationCoordinator } from '../../entrypoints/ebook/translationCoordinator';

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

    await coordinator.start(document, 'Book · Chapter', 1);

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

    const running = coordinator.start(document, 'Old', 1);
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

    await coordinator.start(document, 'Chapter', 1);
    expect(statuses.at(-1)).toMatchObject({ failed: 1, running: false });
    await coordinator.retryFailed();

    expect(translate).toHaveBeenCalledTimes(3);
    expect(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).toHaveLength(2);
    expect(statuses.at(-1)).toMatchObject({ failed: 0, running: false });
  });
});
