import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../entrypoints/utils/translateApi', () => ({
  cacheTranslationResult: vi.fn(),
  cancelAllTranslations: vi.fn(),
  isTranslationCancelledError: (error: unknown) => (error as { name?: string })?.name === 'TranslationCancelledError',
  translateText: vi.fn(),
}));
import JSZip from 'jszip';
import ePub from 'epubjs';
import { translateText } from '../../entrypoints/utils/translateApi';
import { createTranslatedEpub } from '../../entrypoints/ebook/translatedExport';
import { createMinimalEpubBuffer } from '../fixtures/ebook/minimalEpub';

let namespaceSpy: { mockRestore(): void };

beforeAll(() => {
  // happy-dom does not implement the XML namespace lookup EPUB.js expects.
  namespaceSpy = vi.spyOn(Element.prototype, 'getElementsByTagNameNS').mockImplementation(function (this: Element, namespace, localName) {
    return Array.from(this.getElementsByTagName('*')).filter(element =>
      (namespace === '*' || element.namespaceURI === namespace)
      && (localName === '*' || element.localName === localName)
    ) as unknown as HTMLCollectionOf<Element>;
  });
});

afterAll(() => namespaceSpy.mockRestore());
beforeEach(() => vi.clearAllMocks());

function fixtureBook() {
  return {
    title: 'Fixture Book',
    fileBlob: new Blob([createMinimalEpubBuffer()], { type: 'application/epub+zip' }),
  };
}

describe('translated EPUB export', () => {
  it('exports every spine chapter while preserving navigation and resources', async () => {
    const onProgress = vi.fn();
    const blob = await createTranslatedEpub(fixtureBook(), {
      translate: async source => `译文：${source}`,
      onProgress,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const firstFilenameLength = new DataView(bytes.buffer).getUint16(26, true);
    expect(new TextDecoder().decode(bytes.subarray(30, 30 + firstFilenameLength))).toBe('mimetype');
    expect(new DataView(bytes.buffer).getUint16(8, true)).toBe(0);

    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file('mimetype')?.async('text')).toBe('application/epub+zip');
    expect(zip.file('OEBPS/cover.svg')).toBeTruthy();
    const first = await zip.file('OEBPS/chapter1.xhtml')?.async('text');
    const second = await zip.file('OEBPS/chapter2.xhtml')?.async('text');
    expect(first).toContain('onlytranslate-ebook-translation');
    expect(second).toContain('onlytranslate-ebook-translation');
    const translatedXml = new DOMParser().parseFromString(first!, 'application/xhtml+xml');
    expect(translatedXml.querySelector('parsererror')).toBeNull();
    expect(translatedXml.querySelector('[data-onlytranslate-ebook-translation]')?.namespaceURI)
      .toBe('http://www.w3.org/1999/xhtml');

    const reopened = ePub(await blob.arrayBuffer());
    try {
      await reopened.ready;
      expect((await reopened.loaded.metadata).title).toBe('Fixture Book (Bilingual)');
      expect((await reopened.loaded.navigation).toc[0].subitems?.[0]?.href).toBe('chapter2.xhtml');
      const chapter = await reopened.spine.first().load(reopened.load.bind(reopened)) as Document;
      expect(chapter.querySelector('#start')).toBeTruthy();
      expect(chapter.querySelector('[data-onlytranslate-ebook-translation]')?.textContent).toContain('译文：');
      expect(chapter.querySelector('img')?.getAttribute('src')).toBe('cover.svg');
    } finally {
      reopened.destroy();
    }
    expect(onProgress).toHaveBeenCalledWith({ completed: 2, total: 2, phase: 'packaging' });
  });

  it('rejects an incomplete translation instead of returning a partial book', async () => {
    await expect(createTranslatedEpub(fixtureBook(), {
      translate: async () => { throw new Error('service unavailable'); },
    })).rejects.toMatchObject({ code: 'TRANSLATION' });
  });

  it('keeps batch translation enabled while preserving cancellation', async () => {
    vi.mocked(translateText).mockResolvedValue('译文');
    const controller = new AbortController();
    await createTranslatedEpub(fixtureBook(), { signal: controller.signal });
    expect(translateText).toHaveBeenCalled();
    for (const call of vi.mocked(translateText).mock.calls) {
      expect(call[2]).toMatchObject({ allowBatch: true, priority: 'background' });
      expect(call[2]).not.toHaveProperty('signal');
    }
  });

  it('identifies an unreadable EPUB separately from a translation failure', async () => {
    await expect(createTranslatedEpub({
      title: 'Broken book',
      fileBlob: new Blob(['not a zip']),
    })).rejects.toMatchObject({ code: 'EPUB' });
  });

  it('normalizes HTML entities in a chapter into valid exported XHTML', async () => {
    const zip = await JSZip.loadAsync(createMinimalEpubBuffer());
    const chapter = await zip.file('OEBPS/chapter1.xhtml')!.async('text');
    zip.file('OEBPS/chapter1.xhtml', chapter.replace('</body>', '<p>Alpha&nbsp;Beta</p></body>'));
    const fileBlob = await zip.generateAsync({ type: 'blob' });
    const result = await createTranslatedEpub({ title: 'Fixture Book', fileBlob }, {
      translate: async source => `译文：${source}`,
    });
    const exported = await JSZip.loadAsync(await result.arrayBuffer());
    const xhtml = await exported.file('OEBPS/chapter1.xhtml')!.async('text');
    const document = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelector('body')?.textContent).toContain('Alpha\u00a0Beta');
    expect(document.querySelector('body')?.textContent).toContain('译文：');
  });

  it('stops before reading the book when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const translate = vi.fn();
    await expect(createTranslatedEpub(fixtureBook(), {
      signal: controller.signal,
      translate,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(translate).not.toHaveBeenCalled();
  });

  it('stops promptly when cancelled during an in-flight translation', async () => {
    const controller = new AbortController();
    const translate = vi.fn(() => new Promise<string>(() => undefined));
    const exportPromise = createTranslatedEpub(fixtureBook(), {
      signal: controller.signal,
      translate,
    });
    await vi.waitFor(() => expect(translate).toHaveBeenCalled());
    controller.abort();
    await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not return a partially translated book when cancelled after a chapter', async () => {
    const controller = new AbortController();
    await expect(createTranslatedEpub(fixtureBook(), {
      signal: controller.signal,
      translate: async source => `译文：${source}`,
      onProgress: progress => {
        if (progress.completed === 1) controller.abort();
      },
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
