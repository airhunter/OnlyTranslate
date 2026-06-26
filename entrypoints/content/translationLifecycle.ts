type SendResponse = (response?: unknown) => void;
type RuntimeMessageHandler = (message: unknown, sender: unknown, sendResponse: SendResponse) => boolean;

interface RuntimeLike {
    onMessage: {
        addListener(handler: RuntimeMessageHandler): void;
    };
}

export interface PageTranslationLifecycleConfig {
    autoTranslate?: boolean;
    disableFloatingBall?: boolean;
    on?: boolean;
}

export interface PageTranslationLifecycleOptions {
    config: PageTranslationLifecycleConfig;
    document: Document;
    runtime: RuntimeLike;
    autoTranslateEnglishPage: (scope?: string) => void;
    restoreOriginalContent: () => void;
    onPageTranslationStateChange?: (isTranslated: boolean) => void;
}

export interface PageTranslationLifecycle {
    dispose(): void;
}

interface ContextMenuTranslateMessage {
    type: 'contextMenuTranslate';
    action: 'fullPage' | 'restore' | 'getStatus';
    scope?: string;
}

export function setupPageTranslationLifecycle(options: PageTranslationLifecycleOptions): PageTranslationLifecycle {
    let isFullPageTranslating = false;

    const toggleHandler = () => {
        if (options.config.disableFloatingBall !== true) return;

        isFullPageTranslating = !isFullPageTranslating;
        if (isFullPageTranslating) {
            options.autoTranslateEnglishPage();
        } else {
            options.restoreOriginalContent();
        }
    };

    options.document.addEventListener('onlytranslate-toggle-translation', toggleHandler);

    if (options.config.autoTranslate) {
        options.autoTranslateEnglishPage();
    }

    options.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: SendResponse) => {
        if (!isContextMenuTranslateMessage(message)) return false;

        if (options.config.on === false) {
            sendResponse({ status: 'disabled' });
            return true;
        }

        if (message.action === 'fullPage') {
            try {
                options.autoTranslateEnglishPage(message.scope);
                options.onPageTranslationStateChange?.(true);
                sendResponse({ status: 'success', action: 'translated' });
            } catch (error) {
                sendResponse({
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            return true;
        }

        if (message.action === 'restore') {
            options.restoreOriginalContent();
            options.onPageTranslationStateChange?.(false);
            sendResponse({ status: 'success', action: 'restored' });
            return true;
        }

        if (message.action === 'getStatus') {
            const hasTranslatedNodes = options.document.querySelectorAll('[data-fr-translated="true"]').length > 0;
            sendResponse({ status: 'success', isTranslated: hasTranslatedNodes });
            return true;
        }

        return false;
    });

    return {
        dispose() {
            options.document.removeEventListener('onlytranslate-toggle-translation', toggleHandler);
        }
    };
}

function isContextMenuTranslateMessage(message: unknown): message is ContextMenuTranslateMessage {
    if (!message || typeof message !== 'object') return false;

    const candidate = message as Partial<ContextMenuTranslateMessage>;
    return candidate.type === 'contextMenuTranslate'
        && (candidate.action === 'fullPage' || candidate.action === 'restore' || candidate.action === 'getStatus');
}
