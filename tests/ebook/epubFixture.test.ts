import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: { tabs: { create: vi.fn() } },
}));
import ePub from 'epubjs';
import { EBOOK_RENDITION_OPTIONS, extractEpubMetadata } from '../../entrypoints/ebook/readerController';
import { createMinimalEpubBuffer } from '../fixtures/ebook/minimalEpub';

let namespaceSpy: { mockRestore(): void };

beforeAll(() => {
  // happy-dom does not currently return XML namespace matches used by EPUB.js.
  namespaceSpy = vi.spyOn(Element.prototype, 'getElementsByTagNameNS').mockImplementation(function (this: Element, namespace, localName) {
    return (Array.from(this.getElementsByTagName('*')) as Element[]).filter(element =>
      (namespace === '*' || element.namespaceURI === namespace)
      && (localName === '*' || element.localName === localName)
    ) as unknown as HTMLCollectionOf<Element>;
  });
});

afterAll(() => namespaceSpy.mockRestore());

describe('minimal EPUB fixture', () => {
  it('uses single-chapter vertical scrolling without continuous chapter preloading', () => {
    expect(EBOOK_RENDITION_OPTIONS).toMatchObject({
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false,
    });
    expect(EBOOK_RENDITION_OPTIONS).not.toHaveProperty('manager');
  });

  it('loads metadata, nested navigation, cover, image, footnote, and a stable CFI', async () => {
    const data = createMinimalEpubBuffer();
    const book = ePub(data.slice(0));
    try {
      await book.ready;
      const metadata = await book.loaded.metadata;
      const navigation = await book.loaded.navigation;
      const cover = await book.loaded.cover;
      const firstSection = book.spine.first();
      const firstDocument = await firstSection.load(book.load.bind(book)) as unknown as Document;
      const firstParagraph = firstDocument.querySelector('#start');
      const firstCfi = firstParagraph ? firstSection.cfiFromElement(firstParagraph) : '';
      const secondDocument = await book.spine.get(1).load(book.load.bind(book)) as unknown as Document;

      expect(metadata).toMatchObject({ title: 'Fixture Book', creator: 'Fixture Author' });
      expect(navigation.toc[0].subitems?.[0]).toMatchObject({ label: 'Nested Chapter', href: 'chapter2.xhtml' });
      expect(cover).toMatch(/\/OEBPS\/cover\.svg$/);
      expect(firstDocument.querySelector('img')?.getAttribute('src')).toBe('cover.svg');
      expect(firstDocument.querySelector('a')?.getAttribute('href')).toBe('chapter2.xhtml#note');
      expect(secondDocument.querySelector('#note')?.textContent).toContain('Footnote target');
      expect(firstCfi).toMatch(/^epubcfi\(/);
    } finally {
      book.destroy();
    }
  });

  it('extracts reader metadata before persistence', async () => {
    const data = createMinimalEpubBuffer();
    const metadata = await extractEpubMetadata(data, new File([data], 'fixture.epub', { type: 'application/epub+zip' }));
    expect(metadata.title).toBe('Fixture Book');
    expect(metadata.author).toBe('Fixture Author');
  });
});
