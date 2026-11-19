export const PAGE_TRANSLATION_STATUS_EVENT = 'onlytranslate-page-state-changed';
export const PAGE_TRANSLATION_STATUS_MESSAGE = 'ONLY_TRANSLATE_PAGE_TRANSLATION_STATUS';

type PageTranslationSource = 'auto' | 'manual';

export type PageTranslationStatus =
    | { phase: 'idle' | 'translated' }
    | { phase: 'pending' | 'failed'; source: PageTranslationSource }
    | { phase: 'empty'; source: PageTranslationSource; reason: 'page-opt-out' | 'no-targets' | 'no-output' };

type PageStatusWindow = Window & { __onlyTranslatePageStatus?: PageTranslationStatus };

export function readPageTranslationStatus(): PageTranslationStatus {
    return (window as PageStatusWindow).__onlyTranslatePageStatus ?? { phase: 'idle' };
}

export function publishPageTranslationStatus(status: PageTranslationStatus): void {
    // Content scripts share this isolated-world value. The DOM event is only a notification.
    (window as PageStatusWindow).__onlyTranslatePageStatus = status;
    document.dispatchEvent(new Event(PAGE_TRANSLATION_STATUS_EVENT));
    const extensionGlobals = globalThis as typeof globalThis & {
        browser?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } };
        chrome?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } };
    };
    const extensionBrowser = extensionGlobals.browser ?? extensionGlobals.chrome;
    try {
        void extensionBrowser?.runtime?.sendMessage?.({ type: PAGE_TRANSLATION_STATUS_MESSAGE, phase: status.phase })
            ?.catch(() => undefined);
    } catch {
        // The extension runtime can disappear while the page is still open.
    }
}

export function canRestorePage(status: PageTranslationStatus): boolean {
    return status.phase === 'pending' || status.phase === 'translated';
}

export function pageTranslationMessage(status: PageTranslationStatus) {
    if (status.phase === 'failed') return 'runtime.pageTranslation.failed';
    if (status.phase !== 'empty') return null;
    if (status.reason === 'page-opt-out') return 'runtime.pageTranslation.optOut';
    if (status.reason === 'no-targets') return 'runtime.pageTranslation.noTargets';
    return 'runtime.pageTranslation.noOutput';
}
