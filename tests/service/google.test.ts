import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/entrypoints/utils/config', () => ({ config: { from: 'auto', to: 'zh-Hans' } }));
vi.mock('@/entrypoints/utils/i18n', () => ({
  t: (_key: string, values: { status: number; detail: string }) => `Translation failed: ${values.status}${values.detail}`,
}));

import google from '../../entrypoints/service/google';

afterEach(() => vi.unstubAllGlobals());

describe('Google service adapter', () => {
  it('keeps the 429 status without including the anti-automation HTML page', async () => {
    const readBody = vi.fn(async () => '<html>anti-automation response</html>');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, statusText: 'Too Many Requests', text: readBody })));
    await expect(google({ origin: 'Hello' })).rejects.toThrow('Translation failed: 429');
    expect(readBody).not.toHaveBeenCalled();
  });
});
