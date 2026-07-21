import { describe, expect, it } from 'vitest';
import { sanitizeEbookDocument, sanitizeTranslatedInlineHtml } from '../../entrypoints/ebook/sanitizer';

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<html><head></head><body>${html}</body></html>`, 'text/html');
}

describe('EPUB sanitization', () => {
  it('removes active content, event handlers, forms, and remote media', () => {
    const document = parse(`
      <script>window.pwned = true</script>
      <iframe></iframe>
      <form><input value="secret"></form>
      <p onclick="evil()" style="background:url(https://evil.example/a.png)">Safe text</p>
      <source src="https://evil.example/media.mp4" onerror="evil()">
      <a href="https://example.com/path">External</a>
      <a href="chapter-2.xhtml#note">Internal footnote</a>
    `);

    sanitizeEbookDocument(document);

    expect(document.querySelector('script,iframe,form,input')).toBeNull();
    expect(document.querySelector('p')?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('p')?.getAttribute('style')).not.toContain('https://');
    expect(document.querySelector('source')?.hasAttribute('src')).toBe(false);
    expect(document.querySelector('a[href^="https"]')?.getAttribute('data-onlytranslate-external-link')).toBe('true');
    expect(document.querySelector('a[href^="chapter"]')?.getAttribute('href')).toBe('chapter-2.xhtml#note');
  });

  it('allows safe inline translation structure but strips unsafe markup', () => {
    const cleaned = sanitizeTranslatedInlineHtml('<strong>Text</strong><ruby>漢<rt>かん</rt></ruby><a href="javascript:evil()">bad</a><img src=x>');
    expect(cleaned).toContain('<strong>Text</strong>');
    expect(cleaned).toContain('<ruby>');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).not.toContain('<img');
  });
});
