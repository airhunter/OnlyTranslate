export const PAGE_TRANSLATE_OPT_OUT = '[translate="no"]';

export function isPageTranslationOptedOut(root: Element): boolean {
    return root.matches(`html:root${PAGE_TRANSLATE_OPT_OUT}`);
}

/** Only the document element of this session can be exempted, and only from translate=no. */
export function withPageTranslateOverride(selector: string, element: Element, allowedRoot?: Element): string {
    if (!allowedRoot || allowedRoot !== element.ownerDocument.documentElement) return selector;
    return selector.replaceAll(PAGE_TRANSLATE_OPT_OUT, `${PAGE_TRANSLATE_OPT_OUT}:not(html:root)`);
}

interface ManualPageTranslationRequest {
    token: string;
    root: Element;
    body: HTMLElement;
    url: string;
}

type PageGestureWindow = Window & { __onlyTranslatePageGesture?: ManualPageTranslationRequest };

export function captureManualPageTranslationRequest(): string {
    // The lazy page runtime may start after an SPA navigation. Capture the user gesture here.
    const token = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    (window as PageGestureWindow).__onlyTranslatePageGesture = {
        token, root: document.documentElement, body: document.body, url: document.URL
    };
    return token;
}

export function consumeManualPageTranslationRequest(token: string): boolean {
    const pageWindow = window as PageGestureWindow;
    const request = pageWindow.__onlyTranslatePageGesture;
    if (!request || request.token !== token) return false;
    delete pageWindow.__onlyTranslatePageGesture;
    return request.root === document.documentElement && request.body === document.body && request.url === document.URL;
}
