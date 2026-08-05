import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readerTemplate = readFileSync(resolve(process.cwd(), 'entrypoints/ebook/App.vue'), 'utf8');
const readerStyles = readFileSync(resolve(process.cwd(), 'entrypoints/ebook/style.css'), 'utf8');

describe('ebook reader chapter navigation layout', () => {
  it('keeps chapter navigation in the toolbar and one primary action at chapter end', () => {
    expect(readerTemplate).toContain('class="chapter-toolbar-navigation"');
    expect(readerTemplate).toContain(':disabled="!chapterContinuation.previousHref || chapterNavigationPending"');
    expect(readerTemplate).toContain(':disabled="!chapterContinuation.nextHref || chapterNavigationPending"');
    expect(readerTemplate).not.toContain('chapter-edge-button');
    expect(readerTemplate).not.toContain('chapter-continuation__button--previous');
  });

  it('shows keyboard guidance with drawn keycaps', () => {
    expect(readerTemplate).toContain('class="reader-shortcuts"');
    expect(readerTemplate).toContain('class="reader-shortcuts__icon"');
    expect(readerTemplate).toContain('<kbd>PgUp</kbd><kbd>PgDn</kbd>');
    expect(readerTemplate).toContain('<kbd>Shift</kbd><span aria-hidden="true">+</span><kbd>Space</kbd>');
    expect(readerStyles).toContain('.reader-shortcut-row kbd');
  });
});
