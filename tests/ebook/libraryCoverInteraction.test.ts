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
});
