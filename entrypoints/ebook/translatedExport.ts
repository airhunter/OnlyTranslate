import JSZip from 'jszip';
import { translateText } from '@/entrypoints/utils/translateApi';
import { EbookTranslationCoordinator, type EbookTranslationStatus } from './translationCoordinator';
import type { EbookRecord } from './types';

const EPUB_MIME_TYPE = 'application/epub+zip';

export interface TranslatedEpubProgress {
  completed: number;
  total: number;
  phase: 'translating' | 'packaging';
}

export interface TranslatedEpubOptions {
  signal?: AbortSignal;
  onProgress?: (progress: TranslatedEpubProgress) => void;
  translate?: (source: string) => Promise<string>;
}

export class TranslatedEpubExportError extends Error {
  constructor(
    public readonly code: 'EPUB' | 'TRANSLATION' | 'PACKAGING',
    cause: unknown,
  ) {
    super(`Bilingual EPUB export failed during ${code.toLowerCase()}`, { cause });
    this.name = 'TranslatedEpubExportError';
  }
}

function ensureActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('EPUB export cancelled', 'AbortError');
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('EPUB export cancelled', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('EPUB export cancelled', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
  });
}

function parseXml(source: string, expectedRoot: string, mimeType: DOMParserSupportedType = 'application/xml'): Document {
  const document = new DOMParser().parseFromString(source, mimeType);
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== expectedRoot) {
    throw new Error(`Invalid EPUB ${expectedRoot} document`);
  }
  return document;
}

function xmlElements(document: Document, localName: string): Element[] {
  return Array.from(document.getElementsByTagName('*')).filter(element => element.localName === localName);
}

function normalizeXhtmlEntities(xml: string, document: Document): string {
  const xmlEntities = new Set(['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']);
  const decoder = document.createElement('textarea');
  const decoded = new Map<string, string>();
  return xml.replace(/&[a-z][a-z\d]+;/gi, entity => {
    if (xmlEntities.has(entity)) return entity;
    const cached = decoded.get(entity);
    if (cached) return cached;
    decoder.innerHTML = entity;
    const value = decoder.value === entity
      ? entity
      : Array.from(decoder.value, character => `&#${character.codePointAt(0)};`).join('');
    decoded.set(entity, value);
    return value;
  });
}

function resolveArchivePath(baseFile: string, href: string): string {
  const resource = href.split(/[?#]/, 1)[0];
  if (!resource || resource.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(resource)) {
    throw new Error('Invalid EPUB resource path');
  }
  const segments = baseFile.split('/').slice(0, -1);
  for (const rawSegment of resource.split('/')) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      throw new Error('Invalid EPUB resource path');
    }
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length) throw new Error('EPUB resource escapes the archive');
      segments.pop();
    } else if (segment.includes('/') || segment.includes('\\')) {
      throw new Error('Invalid EPUB resource path');
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

async function findSpineDocuments(zip: JSZip): Promise<{ chapters: string[]; packagePath: string; packageXml: Document }> {
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('EPUB container is missing');
  const containerXml = parseXml(await container.async('text'), 'container');
  const packagePath = xmlElements(containerXml, 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath || !zip.file(packagePath)) throw new Error('EPUB package is missing');

  const packageXml = parseXml(await zip.file(packagePath)!.async('text'), 'package');
  const manifest = new Map(xmlElements(packageXml, 'item').map(item => [item.getAttribute('id'), item]));
  const spine = xmlElements(packageXml, 'itemref').flatMap(itemRef => {
    const item = manifest.get(itemRef.getAttribute('idref'));
    if (item?.getAttribute('media-type') !== 'application/xhtml+xml') return [];
    const href = item.getAttribute('href');
    return href ? [resolveArchivePath(packagePath, href)] : [];
  });
  if (!spine.length) throw new Error('EPUB contains no XHTML chapters');
  return { chapters: [...new Set(spine)], packagePath, packageXml };
}

export async function createTranslatedEpub(
  book: Pick<EbookRecord, 'fileBlob' | 'title'>,
  options: TranslatedEpubOptions = {},
): Promise<Blob> {
  let phase: TranslatedEpubExportError['code'] = 'EPUB';
  ensureActive(options.signal);
  try {
    const zip = await JSZip.loadAsync(await book.fileBlob.arrayBuffer());
    if (zip.file('META-INF/encryption.xml') || zip.file('META-INF/signatures.xml')) {
      throw new Error('Encrypted or signed EPUB files cannot be exported with translations');
    }
    const { chapters, packagePath, packageXml } = await findSpineDocuments(zip);
    let status: EbookTranslationStatus = { total: 0, completed: 0, failed: 0, running: false };
    let firstTranslationError: unknown;
    const coordinator = new EbookTranslationCoordinator({
      translate: async (source, context, translateOptions) => {
        try {
          const request = options.translate
            ? options.translate(source)
            : translateText(source, context, { ...translateOptions, priority: 'background' });
          // translateText disables batching when given a signal. Keep batching
          // for long books while making each request cancellable at this boundary.
          const result = await withAbortSignal(request, options.signal);
          if (!result.trim()) throw new Error('EPUB translation is empty');
          return result;
        } catch (error) {
          firstTranslationError ??= error;
          throw error;
        }
      },
      onStatus: next => { status = next; },
    });
    const cancel = () => coordinator.cancel();
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      options.onProgress?.({ completed: 0, total: chapters.length, phase: 'translating' });
      for (const [index, path] of chapters.entries()) {
        phase = 'EPUB';
        ensureActive(options.signal);
        const entry = zip.file(path);
        if (!entry) throw new Error(`EPUB chapter is missing: ${path}`);
        const source = await entry.async('text');
        // EPUB readers tolerate common HTML entities inside XHTML chapters.
        // Parse into HTMLElements for the unitizer, then validate the serialized
        // XHTML output before adding it back to the archive.
        const document = new DOMParser().parseFromString(
          source.replace(/^\uFEFF?\s*<\?xml[^>]*\?>\s*/i, ''),
          'text/html',
        );
        phase = 'TRANSLATION';
        await coordinator.start(document, { scene: 'ebook', title: book.title }, 'bilingual');
        ensureActive(options.signal);
        if (status.failed || status.completed !== status.total) {
          throw new Error(`EPUB chapter translation is incomplete: ${path}`, { cause: firstTranslationError });
        }
        phase = 'EPUB';
        const style = document.querySelector('#onlytranslate-ebook-style');
        if (style) style.textContent = '.onlytranslate-ebook-translation { color: #3975d7; margin-block: .35em .7em; }';
        const translatedXml = normalizeXhtmlEntities(new XMLSerializer().serializeToString(document), document);
        parseXml(translatedXml, 'html', 'application/xhtml+xml');
        zip.file(path, translatedXml);
        options.onProgress?.({ completed: index + 1, total: chapters.length, phase: 'translating' });
      }

      ensureActive(options.signal);
      phase = 'PACKAGING';
      const title = xmlElements(packageXml, 'title')[0];
      if (title) title.textContent = `${title.textContent?.trim() || book.title} (Bilingual)`;
      const uniqueId = packageXml.documentElement.getAttribute('unique-identifier');
      const identifier = xmlElements(packageXml, 'identifier')
        .find(element => element.getAttribute('id') === uniqueId);
      if (identifier) identifier.textContent = `urn:uuid:${crypto.randomUUID()}`;
      const modified = xmlElements(packageXml, 'meta')
        .find(element => element.getAttribute('property') === 'dcterms:modified');
      if (modified) modified.textContent = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      zip.file(packagePath, new XMLSerializer().serializeToString(packageXml));
      options.onProgress?.({ completed: chapters.length, total: chapters.length, phase: 'packaging' });
      const output = new JSZip();
      output.file('mimetype', EPUB_MIME_TYPE, { compression: 'STORE' });
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || entry.name === 'mimetype') continue;
        ensureActive(options.signal);
        output.file(entry.name, await entry.async('uint8array'), { compression: 'DEFLATE' });
      }
      ensureActive(options.signal);
      const result = await output.generateAsync({ type: 'blob', mimeType: EPUB_MIME_TYPE, compression: 'DEFLATE' });
      ensureActive(options.signal);
      return result;
    } finally {
      options.signal?.removeEventListener('abort', cancel);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TranslatedEpubExportError(phase, error);
  }
}
