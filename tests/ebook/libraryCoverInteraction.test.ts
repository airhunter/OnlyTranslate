import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const libraryTemplate = readFileSync(resolve(process.cwd(), 'entrypoints/ebook/App.vue'), 'utf8');
const libraryStyles = readFileSync(resolve(process.cwd(), 'entrypoints/ebook/style.css'), 'utf8');

describe('ebook library cover interaction', () => {
  it('opens a book from its keyboard-accessible cover button', () => {
    expect(libraryTemplate).toMatch(
      /<button\s+type="button"\s+class="cover"\s+:aria-label="`\$\{t\('ebook\.continueReading'\)\}: \$\{item\.record\.title\}`"\s+@click="openBook\(item\.record\)"/,
    );
    expect(libraryStyles).toContain('.cover:focus-visible');
  });

  it('keeps compact card actions aligned in a single row', () => {
    expect(libraryStyles).toContain('.book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));');
    expect(libraryStyles).toContain('.card-actions { display: grid; grid-template-columns: minmax(96px, 1fr) auto;');
    expect(libraryStyles).toContain('.card-actions > button { min-width: 0; white-space: nowrap; }');
    expect(libraryTemplate).toContain("t('ebook.exportAction')");
  });

  it('places the remove action in the card top-right corner', () => {
    expect(libraryTemplate).toContain('class="book-remove-button"');
    expect(libraryStyles).toContain('.book-remove-button { position: absolute;');
    expect(libraryStyles).toContain('top: 14px; right: 14px;');
  });

  it('renders a readable title cover for PDFs without embedded artwork', () => {
    expect(libraryTemplate).toContain("getEbookFormat(item.record) === 'pdf'");
    expect(libraryTemplate).toContain('getPdfCoverTitle(item.record)');
    expect(libraryStyles).toContain('.cover-fallback strong');
    expect(libraryStyles).toContain('-webkit-line-clamp: 5');
  });
});
