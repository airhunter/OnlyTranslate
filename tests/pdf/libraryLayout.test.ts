import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pdfTemplate = readFileSync(resolve(process.cwd(), 'entrypoints/pdf/App.vue'), 'utf8');
const pdfStyles = readFileSync(resolve(process.cwd(), 'entrypoints/pdf/style.css'), 'utf8');
const pdfController = readFileSync(resolve(process.cwd(), 'entrypoints/pdf/readerController.ts'), 'utf8');

describe('PDF library layout', () => {
  it('offers add, stored, export, and library actions in the PDF reader', () => {
    expect(pdfTemplate).toContain("t('pdf.addToLibrary')");
    expect(pdfTemplate).toContain("t('pdf.removeFromLibrary')");
    expect(pdfTemplate).toContain('await repository.removeBook(book.bookId)');
    expect(pdfTemplate).toContain("t('ebook.exportOriginal')");
    expect(pdfTemplate).toContain('@click="openLibrary"');
    expect(pdfTemplate).toContain('window.setTimeout(clearLibraryNotice, duration)');
    expect(pdfTemplate).toContain('@click="clearLibraryNotice"');
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
    expect(pdfTemplate).toContain('aria-keyshortcuts="ArrowLeft ArrowRight"');
    expect(pdfTemplate).not.toContain('class="chapter-toolbar-navigation pdf-page-navigation"');
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

  it('keeps scrolling inside the reader panes and reserves horizontal scrolling for a zoomed original', () => {
    expect(pdfStyles).toContain('html, body, #app { width: 100%; height: 100%; overflow: hidden; }');
    expect(pdfStyles).toContain('.pdf-original-panel { position: relative; overflow-x: auto;');
    expect(pdfStyles).toContain('.pdf-translation-panel { overflow-x: hidden; }');
    expect(pdfStyles).toContain('.pdf-workspace { min-width: 0; min-height: 0; overflow: hidden;');
    expect(pdfTemplate).toContain('(originalPanel.value.clientWidth || fallbackPanelWidth) - 42');
  });

  it('zooms the original PDF around the pointer without rerunning layout or translation', () => {
    expect(pdfTemplate).toContain('@wheel="handleOriginalWheel"');
    expect(pdfTemplate).toContain('(!event.ctrlKey && !event.metaKey)');
    expect(pdfTemplate).toContain('controller.renderPageCanvas(');
    expect(pdfTemplate).toContain('normalizedPdfPageAnchor(event.clientX');
    expect(pdfTemplate).toContain('panel.scrollLeft += anchoredClientX - anchor.clientX');
    expect(pdfTemplate).toContain('{{ Math.round(originalZoom * 100) }}%');
    expect(pdfTemplate).toContain("t('pdf.shortcutOriginalZoom')");
    expect(pdfTemplate).toContain("t('pdf.mouseWheel')");
    expect(pdfController).toContain('async renderPageCanvas(');
  });

  it('does not cover the original PDF with local layout diagnostics', () => {
    expect(pdfTemplate).not.toContain('class="pdf-semantic-status"');
    expect(pdfStyles).not.toContain('.pdf-semantic-status');
    expect(pdfTemplate).not.toContain('class="pdf-model-notice"');
    expect(pdfTemplate).toContain('class="pdf-layout-model-control"');
    expect(pdfTemplate).toContain("t('pdf.semanticModelStatusMissing')");
  });

  it('offers direct reading modes and page thumbnail navigation', () => {
    expect(pdfTemplate).toContain("@click=\"setDisplayMode('semantic')\"");
    expect(pdfTemplate).toContain("@click=\"setDisplayMode('translation')\"");
    expect(pdfTemplate).toContain("@click=\"setDisplayMode('original')\"");
    expect(pdfTemplate).not.toContain('setOverlayMode');
    expect(pdfTemplate).toContain('const previewOpen = ref(false)');
    expect(pdfTemplate).toContain('class="pdf-page-thumbnails"');
    expect(pdfTemplate).toContain('controller.renderThumbnail(thumbnailPage)');
    expect(pdfTemplate).toContain('Array.from({ length: pageCount.value }');
    expect(pdfTemplate).toContain('@dblclick.prevent="toggleOriginalPreview(thumbnailPage)"');
    expect(pdfTemplate).toContain('class="pdf-pane-resizer"');
    expect(pdfTemplate).toContain('@pointerdown="startPaneResize"');
    expect(pdfStyles).toContain('grid-template-columns: 116px minmax(280px, var(--pdf-original-panel-width)) 8px minmax(0, 1fr);');
    expect(pdfStyles).toContain('overflow-y: scroll;');
  });

  it('rebuilds cross-column and cross-page paragraph continuity before translation', () => {
    expect(pdfTemplate).toContain('addCrossPageContext(rendered.blocks, previousPage?.blocks, nextPage?.blocks)');
    expect(pdfTemplate).toContain('controller.extractPage(rendered.pageNumber - 1)');
    expect(pdfTemplate).toContain('controller.extractPage(rendered.pageNumber + 1)');
    expect(pdfTemplate).toContain('block.translationSource?.trim() || block.mathSource?.trim() || block.text');
    expect(pdfTemplate).toContain("t('pdf.continuesFromPreviousPage')");
  });

  it('keeps visual blocks clean and enlarges them on double click', () => {
    expect(pdfTemplate).not.toContain('<figcaption>{{ visualBlockLabel(block) }}</figcaption>');
    expect(pdfTemplate).not.toContain("t('pdf.formulaProtected')");
    expect(pdfTemplate).toContain('@dblclick.stop.prevent="openVisualLightbox(block)"');
    expect(pdfTemplate).toContain('@click.self="closeVisualLightbox"');
    expect(pdfTemplate).toContain("event.key === 'Escape' && enlargedVisualBlock.value");
    expect(pdfStyles).toContain('.pdf-visual-lightbox { position: fixed;');
  });

  it('renders detected visuals from the PDF at reading and lightbox resolution', () => {
    expect(pdfController).toContain('await attachVisualCrops(page, semanticBlocks, viewport)');
    expect(pdfController).toContain("const targetWidth = block.visualKind === 'formula' ? 1200 : 1500");
    expect(pdfController).toContain('const cropViewport = viewport.clone({');
    expect(pdfController).toContain('offsetX: -x * cropScale');
    expect(pdfController).toContain('viewport: cropViewport');
    expect(pdfController).toContain("block.visualKind === 'formula'");
    expect(pdfController).toContain('refineFormulaCanvas(crop, cropContext, cropScale)');
    expect(pdfTemplate).toContain(':style="visualBlockStyle(block)"');
    expect(pdfStyles).toContain('width: min(100%, var(--pdf-visual-display-width, 760px));');
  });

  it('renders protected paragraph math with inline KaTeX while keeping visual formulas as images', () => {
    expect(pdfTemplate).toContain("import katex from 'katex'");
    expect(pdfTemplate).toContain("import 'katex/dist/katex.min.css'");
    expect(pdfTemplate).toContain("displayMode: false");
    expect(pdfTemplate).toContain("trust: false");
    expect(pdfTemplate).toContain('v-html="readingBlockHtml(block, readingBlockSource(block))"');
    expect(pdfStyles).toContain('.pdf-block .katex {');
    expect(pdfTemplate).toContain("v-if=\"block.kind === 'visual'\"");
  });

  it('uses conservative reading blocks when the local layout model is unavailable', () => {
    expect(pdfTemplate).toContain("if (layoutStatus.mode !== 'semantic') return overlayTranslationBlocks.value");
    expect(pdfTemplate).toContain("usesSemanticLayout.value && layoutStatus.mode === 'semantic'");
    expect(pdfTemplate).toContain('if (pageCount.value && usesSemanticLayout.value) await renderCurrentPage()');
  });

  it('makes the missing layout model urgent and closes its panel after installation', () => {
    expect(pdfTemplate).toContain('ref="layoutModelControl"');
    expect(pdfTemplate).toContain("layoutModelControl.value?.removeAttribute('open')");
    expect(pdfTemplate).toContain('}, 2200)');
    expect(pdfStyles).toContain('.pdf-layout-model-control--missing > summary { border-color: rgb(205 67 74 / 34%);');
    expect(pdfStyles).toContain('.pdf-layout-model-control--missing .pdf-layout-model-control__icon { background: #d43f49; }');
  });
});
