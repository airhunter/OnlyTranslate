import { describe, expect, it } from 'vitest';
import {
  applyEbookDisplayMode,
  collectEbookTranslationUnits,
  hasAllPlaceholders,
  insertEbookTranslation,
} from '../../entrypoints/ebook/unitizer';

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<html><head></head><body>${html}</body></html>`, 'text/html');
}

describe('ebook chapter unitizer', () => {
  it('selects deepest, non-overlapping semantic units and skips hidden or symbolic content', () => {
    const document = parse(`
      <h1>Chapter one</h1>
      <ul><li><p>Nested paragraph</p></li><li>Direct item</li></ul>
      <p hidden>Hidden words</p><p>***</p><section>Unselected prose</section>
    `);
    const units = collectEbookTranslationUnits(document);

    expect(units.map(unit => unit.sourceText)).toEqual(['Chapter one', 'Nested paragraph', 'Direct item']);
    expect(new Set(units.map(unit => unit.element))).toHaveLength(3);
  });

  it('collects Project Gutenberg leaf div prose without duplicating its metadata containers', () => {
    const document = parse(`
      <header>
        <h2>The Project Gutenberg eBook</h2>
        <div id="license">
          This eBook is for the use of anyone anywhere at no cost under the terms at
          <a href="https://www.gutenberg.org">www.gutenberg.org</a>.
        </div>
        <div id="machine-header">
          <p><strong>Title</strong>: Alice's Adventures in Wonderland</p>
          <div><p><strong>Author</strong>: Lewis Carroll</p></div>
        </div>
      </header>
    `);

    const units = collectEbookTranslationUnits(document);

    expect(units.map(unit => unit.element.id || unit.element.tagName)).toEqual([
      'H2',
      'license',
      'P',
      'P',
    ]);
    expect(units.find(unit => unit.element.id === 'license')?.sourceHtml)
      .toContain('<a href="https://www.gutenberg.org">www.gutenberg.org</a>');
    expect(units.some(unit => unit.element.id === 'machine-header')).toBe(false);
  });

  it('keeps semantic table cells as the translation unit when they contain layout divs', () => {
    const document = parse('<table><tbody><tr><td><div>Chapter title</div></td></tr></tbody></table>');

    const units = collectEbookTranslationUnits(document);

    expect(units).toHaveLength(1);
    expect(units[0].element.tagName).toBe('TD');
    expect(units[0].sourceText).toBe('Chapter title');
  });

  it('protects code/math placeholders and restores their original nodes', () => {
    const document = parse('<p>Hello <em>world</em> <code>x &lt; 2</code> and <math><mi>y</mi></math></p>');
    const [unit] = collectEbookTranslationUnits(document);

    expect(unit.sourceHtml).toContain('<em>world</em>');
    expect(unit.sourceHtml).toContain('{{ONLYTRANSLATE_PROTECTED_0}}');
    expect(hasAllPlaceholders('译文 {{ONLYTRANSLATE_PROTECTED_0}} {{ONLYTRANSLATE_PROTECTED_1}}', unit.placeholders)).toBe(true);

    const translation = insertEbookTranslation(unit, '<strong>你好</strong> {{ONLYTRANSLATE_PROTECTED_0}} {{ONLYTRANSLATE_PROTECTED_1}}');
    expect(translation.querySelector('code')?.textContent).toBe('x < 2');
    expect(translation.querySelector('math mi')?.textContent).toBe('y');
  });

  it('preserves EPUB presentation classes without duplicating ids or internal state', () => {
    const document = parse('<h2 id="episode-title" class="h2p centered">Episode one</h2>');
    const [unit] = collectEbookTranslationUnits(document);

    const translation = insertEbookTranslation(unit, '第一集');

    expect(translation.tagName).toBe('H2');
    expect(translation.classList.contains('h2p')).toBe(true);
    expect(translation.classList.contains('centered')).toBe(true);
    expect(translation.classList.contains('onlytranslate-ebook-translation')).toBe(true);
    expect(translation.classList.contains('onlytranslate-ebook-has-translation')).toBe(false);
    expect(translation.hasAttribute('id')).toBe(false);

    const replacement = insertEbookTranslation(unit, '第一集');
    expect(replacement.classList.contains('onlytranslate-ebook-has-translation')).toBe(false);
  });

  it('keeps original text visible until a translation exists in translation-only mode', () => {
    const document = parse('<p>Original paragraph</p><p>Still pending</p>');
    const units = collectEbookTranslationUnits(document);
    applyEbookDisplayMode(document, 'translation');
    insertEbookTranslation(units[0], 'Translated paragraph');

    expect(document.documentElement.dataset.onlytranslateEbookDisplay).toBe('translation');
    expect(units[0].element.classList.contains('onlytranslate-ebook-has-translation')).toBe(true);
    expect(units[1].element.classList.contains('onlytranslate-ebook-has-translation')).toBe(false);
    expect(document.querySelectorAll('[data-onlytranslate-ebook-translation]')).toHaveLength(1);
  });

  it('supports original, bilingual, and translation display states', () => {
    const document = parse('<p>Original paragraph</p>');

    applyEbookDisplayMode(document, 'original');
    expect(document.documentElement.dataset.onlytranslateEbookDisplay).toBe('original');
    applyEbookDisplayMode(document, 'bilingual');
    expect(document.documentElement.dataset.onlytranslateEbookDisplay).toBe('bilingual');
    applyEbookDisplayMode(document, 'translation');
    expect(document.documentElement.dataset.onlytranslateEbookDisplay).toBe('translation');
  });
});
