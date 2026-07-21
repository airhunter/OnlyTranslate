import createDOMPurify from 'dompurify';

const FORBIDDEN_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'option',
  'button', 'portal', 'frame', 'frameset',
];

const MEDIA_SELECTOR = 'img[src], img[srcset], audio[src], video[src], video[poster], source[src], source[srcset], track[src], image[href], image[xlink\\:href], use[href], use[xlink\\:href]';
const TRANSLATED_INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'del', 'em', 'i', 'ins', 'kbd', 'mark',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'time', 'u', 'var',
]);
const TRANSLATED_INLINE_ATTRIBUTES = new Set(['href', 'title', 'lang', 'dir']);

function isRemoteUrl(value: string): boolean {
  return /^\s*(?:https?:)?\/\//i.test(value);
}

function stripRemoteCss(css: string): string {
  return css
    .replace(/@import\s+(?:url\()?\s*(['"]?)https?:\/\/[^;)'"\s]+\1\s*\)?\s*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?:https?:)?\/\/[^)'"\s]+\1\s*\)/gi, 'none');
}

/** Cleans an EPUB spine document without relying on webpage translation filters. */
export function sanitizeEbookDocument(document: Document): void {
  document.querySelectorAll(FORBIDDEN_TAGS.join(',')).forEach(element => element.remove());
  const purifier = createDOMPurify((document.defaultView ?? window) as unknown as Parameters<typeof createDOMPurify>[0]);
  document.body.innerHTML = purifier.sanitize(document.body.innerHTML, {
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ['srcdoc'],
    ADD_ATTR: ['epub:type'],
    ALLOW_DATA_ATTR: true,
  });

  document.querySelectorAll<HTMLElement>('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    });
    if (element.hasAttribute('style')) {
      element.setAttribute('style', stripRemoteCss(element.getAttribute('style') ?? ''));
    }
  });

  document.querySelectorAll<HTMLLinkElement>('link[href]').forEach(link => {
    if (isRemoteUrl(link.href)) link.remove();
  });
  document.querySelectorAll<HTMLStyleElement>('style').forEach(style => {
    style.textContent = stripRemoteCss(style.textContent ?? '');
  });
  document.querySelectorAll<HTMLElement>(MEDIA_SELECTOR).forEach(element => {
    for (const attribute of ['src', 'srcset', 'poster', 'href', 'xlink:href']) {
      const value = element.getAttribute(attribute);
      if (value && (isRemoteUrl(value) || /(?:^|,\s*)https?:\/\//i.test(value))) element.removeAttribute(attribute);
    }
  });

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    if (isRemoteUrl(anchor.getAttribute('href') ?? '')) {
      anchor.dataset.onlytranslateExternalLink = 'true';
      anchor.rel = 'noopener noreferrer';
    }
  });
}

export function sanitizeTranslatedInlineHtml(html: string): string {
  const purifier = createDOMPurify(window);
  const config = {
    ALLOWED_TAGS: Array.from(TRANSLATED_INLINE_TAGS),
    ALLOWED_ATTR: ['href', 'title', 'lang', 'dir'],
  };
  const supportsSemanticAllowlist = purifier.isSupported
    && purifier.sanitize('<strong>onlytranslate-probe</strong>', config).includes('<strong>');
  const purified = supportsSemanticAllowlist ? purifier.sanitize(html, config) : html;

  // Keep a small structural allowlist as defense in depth and for non-browser test DOMs.
  const template = document.createElement('template');
  template.innerHTML = purified;
  Array.from(template.content.querySelectorAll<HTMLElement>('*')).forEach(element => {
    const tag = element.tagName.toLocaleLowerCase();
    if (!TRANSLATED_INLINE_TAGS.has(tag)) {
      if (['script', 'style', 'img', 'iframe', 'object', 'embed', 'form'].includes(tag)) element.remove();
      else element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    Array.from(element.attributes).forEach(attribute => {
      if (!TRANSLATED_INLINE_ATTRIBUTES.has(attribute.name)) element.removeAttribute(attribute.name);
    });
    if (tag === 'a' && /^\s*(?:javascript|data):/i.test(element.getAttribute('href') ?? '')) {
      element.removeAttribute('href');
    }
  });
  return template.innerHTML;
}
