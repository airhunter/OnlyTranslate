import { describe, expect, it } from 'vitest';
import { fitEbookImagePage } from '../../entrypoints/ebook/pageLayout';

function createBookDocument(bodyMarkup: string): Document {
  const ebookDocument = document.implementation.createHTMLDocument('Doom Guy');
  ebookDocument.body.innerHTML = bodyMarkup;
  return ebookDocument;
}

describe('EPUB image page layout', () => {
  it('fits the semantic cover image to the reader viewport', () => {
    const ebookDocument = createBookDocument(`
      <section epub:type="cover">
        <figure class="img90" id="cover-image">
          <img alt="Doom Guy: Life in First Person" src="../images/9781647005368.jpg"
            style="height: 90vh; max-height: 8px !important">
          <figcaption></figcaption>
        </figure>
      </section>
    `);
    ebookDocument.body.setAttribute('epub:type', 'cover');

    expect(fitEbookImagePage(ebookDocument, { width: 1200, height: 900 })).toBe(true);

    const image = ebookDocument.querySelector('img') as HTMLImageElement;
    expect(ebookDocument.documentElement.dataset.onlytranslateEbookImagePage).toBe('true');
    expect(ebookDocument.body.style.minHeight).toBe('900px');
    expect(image.style.width).toBe('100%');
    expect(image.style.height).toBe('852px');
    expect(image.style.maxWidth).toBe('1152px');
    expect(image.style.maxHeight).toBe('852px');
    expect(image.style.getPropertyPriority('max-height')).toBe('important');
    expect(image.style.objectFit).toBe('contain');
  });

  it('fits a single-image title page with page-break markers', () => {
    const ebookDocument = createBookDocument(`
      <section epub:type="titlepage">
        <figure class="img90" id="ch00_fm02_title">
          <span epub:type="pagebreak" id="page_i"></span>
          <span epub:type="pagebreak" id="page_ii"></span>
          <img alt="Images" src="../images/title-image.jpg">
          <figcaption></figcaption>
        </figure>
      </section>
    `);
    ebookDocument.body.setAttribute('epub:type', 'frontmatter');

    expect(fitEbookImagePage(ebookDocument, { width: 1024, height: 768 })).toBe(true);
    expect((ebookDocument.querySelector('img') as HTMLImageElement).style.height).toBe('720px');
  });

  it('does not resize ordinary chapter illustrations', () => {
    const ebookDocument = createBookDocument(`
      <section epub:type="chapter">
        <p>Chapter text</p>
        <figure><img alt="Diagram" src="../images/diagram.jpg"></figure>
      </section>
    `);
    const image = ebookDocument.querySelector('img') as HTMLImageElement;

    expect(fitEbookImagePage(ebookDocument, { width: 1200, height: 900 })).toBe(false);
    expect(image.getAttribute('style')).toBeNull();
  });
});
