import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pdfTemplate = readFileSync(resolve(process.cwd(), 'entrypoints/pdf/App.vue'), 'utf8');
const pdfStyles = readFileSync(resolve(process.cwd(), 'entrypoints/pdf/style.css'), 'utf8');

describe('PDF library layout', () => {
  it('offers add, stored, export, and library actions in the PDF reader', () => {
    expect(pdfTemplate).toContain("t('pdf.addToLibrary')");
    expect(pdfTemplate).toContain("t('pdf.inLibrary')");
    expect(pdfTemplate).toContain("t('ebook.exportOriginal')");
    expect(pdfTemplate).toContain('@click="openLibrary"');
  });

  it('loads saved PDF records and persists page progress', () => {
    expect(pdfTemplate).toContain('getRequestedPdfBookId(location.search)');
    expect(pdfTemplate).toContain('await repository.getProgress(book.bookId)');
    expect(pdfTemplate).toContain('pageNumber: pageNumber.value');
    expect(pdfTemplate).toContain('void savePdfProgress()');
  });

  it('uses the shared reader controls and removes current-page printing', () => {
    expect(pdfTemplate).toContain('resolveReaderKeyboardAction(event)');
    expect(pdfTemplate).toContain("window.addEventListener('keydown', handleReaderKeyDown)");
    expect(pdfTemplate).toContain('aria-keyshortcuts="ArrowLeft"');
    expect(pdfTemplate).toContain('aria-keyshortcuts="ArrowRight"');
    expect(pdfTemplate).toContain('loadReaderSettings()');
    expect(pdfTemplate).toContain('saveReaderSettings({');
    expect(pdfTemplate).toContain("t('ebook.fontSize')");
    expect(pdfTemplate).toContain("t('ebook.lineHeight')");
    expect(pdfTemplate).toContain('class="reader-progress pdf-reader-progress"');
    expect(pdfTemplate).not.toContain('printCurrentPage');
    expect(pdfTemplate).not.toContain("t('pdf.printPage')");
  });

  it('offers EPUB-style continuation at the end of each PDF reading page', () => {
    expect(pdfTemplate).toContain('class="pdf-page-continuation"');
    expect(pdfTemplate).toContain("t('pdf.continueNextPage')");
    expect(pdfTemplate).toContain("t('pdf.documentFinished')");
    expect(pdfTemplate).toContain('@click="continuePdfReading"');
    expect(pdfTemplate).toContain('goToPage(pageNumber.value + 1)');
  });

  it('keeps scrolling inside the reader panes without horizontal overflow', () => {
    expect(pdfStyles).toContain('html, body, #app { width: 100%; height: 100%; overflow: hidden; }');
    expect(pdfStyles).toContain('overflow-x: hidden; overflow-y: auto; scrollbar-gutter: stable;');
    expect(pdfStyles).toContain('.pdf-workspace { min-width: 0; min-height: 0; overflow: hidden;');
    expect(pdfTemplate).toContain('Math.max(240, originalPanel.value.clientWidth - 42)');
  });

  it('does not cover the original PDF with local layout diagnostics', () => {
    expect(pdfTemplate).not.toContain('class="pdf-semantic-status"');
    expect(pdfStyles).not.toContain('.pdf-semantic-status');
  });
});
