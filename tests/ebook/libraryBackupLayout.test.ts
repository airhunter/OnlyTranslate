import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const libraryTemplate = readFileSync(resolve(process.cwd(), 'entrypoints/ebook/App.vue'), 'utf8');

describe('ebook library backup layout', () => {
  it('keeps backup, restore, and uninstall guidance available in the full library', () => {
    expect(libraryTemplate).toContain("t('ebook.backupLibrary')");
    expect(libraryTemplate).toContain("t('ebook.restoreLibrary')");
    expect(libraryTemplate).toContain(':accept="EBOOK_BACKUP_EXTENSION"');
    expect(libraryTemplate).toContain("t('ebook.uninstallWarning')");
  });
});
