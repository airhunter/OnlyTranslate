import browser from 'webextension-polyfill';

export function getEbookPageUrl(
  bookId?: string,
  runtime: { getURL(path: string): string } = browser.runtime,
): string {
  const pageUrl = runtime.getURL('/ebook.html');
  if (!bookId) return pageUrl;
  const url = new URL(pageUrl);
  url.searchParams.set('bookId', bookId);
  return url.toString();
}

export function getRequestedEbookId(search: string): string | undefined {
  return new URLSearchParams(search).get('bookId') || undefined;
}
