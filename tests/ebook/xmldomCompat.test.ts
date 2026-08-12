import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface XmldomDocument {
  documentElement: XmldomElement;
  createElement(name: string): XmldomElement;
  getElementsByTagName(name: string): ArrayLike<XmldomElement>;
}

interface XmldomElement {
  appendChild(child: XmldomElement): XmldomElement;
  getAttribute(name: string): string;
  getElementsByTagName(name: string): ArrayLike<XmldomElement>;
  textContent: string;
}

interface XmldomModule {
  DOMImplementation: new () => {
    createDocument(namespaceURI: string | null, qualifiedName: string): XmldomDocument;
  };
  DOMParser: new () => {
    parseFromString(source: string, mimeType: string): XmldomDocument;
  };
  XMLSerializer: new () => {
    serializeToString(node: XmldomDocument): string;
  };
}

const rootRequire = createRequire(import.meta.url);
const epubRequire = createRequire(rootRequire.resolve('epubjs/package.json'));
const xmldom = epubRequire('@xmldom/xmldom') as XmldomModule;
const xmldomPackage = epubRequire('@xmldom/xmldom/package.json') as { version: string };

describe('EPUB XML DOM compatibility', () => {
  it('uses the patched XML DOM version to parse EPUB package metadata', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata><title>Fixture Book</title></metadata>
        <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
      </package>`;
    const document = new xmldom.DOMParser().parseFromString(source, 'application/xml');

    expect(xmldomPackage.version).toBe('0.8.13');
    expect(document.getElementsByTagName('title')[0]?.textContent).toBe('Fixture Book');
    expect(document.getElementsByTagName('item')[0]?.getAttribute('href')).toBe('chapter.xhtml');
  });

  it('serializes deeply nested XML without exhausting the call stack', () => {
    const document = new xmldom.DOMImplementation().createDocument(null, 'root');
    let parent = document.documentElement;
    for (let depth = 0; depth < 5_000; depth += 1) {
      const child = document.createElement('node');
      parent.appendChild(child);
      parent = child;
    }

    const result = new xmldom.XMLSerializer().serializeToString(document);

    expect(result.startsWith('<root><node>')).toBe(true);
    expect(result.endsWith('</node></root>')).toBe(true);
  });
});
