import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../entrypoints/utils/config', () => ({
  config: { service: 'microsoft', from: 'auto', to: 'zh', style: 0, model: {}, customModel: {}, customProviders: [] },
  configReady: Promise.resolve(),
}));
vi.mock('../../entrypoints/utils/translateApi', () => ({ translateText: vi.fn() }));
import { config, configReady } from '../../entrypoints/utils/config';
import { createExportTranslator, ExportRateLimitError, ExportSettingsChangedError } from '../../entrypoints/ebook/exportTranslation';
import type { translateText, TranslateOptions } from '../../entrypoints/utils/translateApi';

const originalService = config.service;
const originalStyle = config.style;

beforeAll(async () => { await configReady; });
afterEach(() => {
  config.service = originalService;
  config.style = originalStyle;
});

describe('export translation scheduling', () => {
  it('stops all later Google export requests on the first 429 without per-item retries', async () => {
    config.service = 'google';
    const translate = vi.fn(async (_source: string, _context: unknown, _options: TranslateOptions) => { throw new Error('translation failed: 429'); });
    const run = createExportTranslator(undefined, translate as typeof translateText, 0);
    const results = await Promise.allSettled([
      run('first', { scene: 'ebook' }, { allowBatch: true }),
      run('second', { scene: 'ebook' }, { allowBatch: true }),
      run('third', { scene: 'ebook' }, { allowBatch: true }),
    ]);
    expect(translate).toHaveBeenCalledOnce();
    expect(translate.mock.calls[0][2]).toMatchObject({ allowBatch: false, priority: 'background', maxRetries: 0 });
    expect(results.every(result => result.status === 'rejected' && result.reason instanceof ExportRateLimitError)).toBe(true);
  });

  it('stops when translation settings change during an export', async () => {
    const translate = vi.fn(async () => 'translated');
    const run = createExportTranslator(undefined, translate as typeof translateText, 0);
    config.style += 1;
    await expect(run('source', { scene: 'ebook' }, {})).rejects.toBeInstanceOf(ExportSettingsChangedError);
    expect(translate).not.toHaveBeenCalled();
  });
});
