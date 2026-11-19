import type { PageTranslationStatus } from '@/entrypoints/utils/pageTranslationStatus';

type SendResponse = (response?: unknown) => void;
type RuntimeMessageHandler = (message: unknown, sender: unknown, sendResponse: SendResponse) => boolean;

interface RuntimeLike {
    onMessage: {
        addListener(handler: RuntimeMessageHandler): void;
        removeListener?(handler: RuntimeMessageHandler): void;
    };
}

export interface PageTranslationLifecycleConfig {
    autoTranslate?: boolean;
    disableFloatingBall?: boolean;
    on?: boolean;
}

export interface PageTranslationLifecycleOptions {
    config: PageTranslationLifecycleConfig;
    runtime: RuntimeLike;
    autoTranslateEnglishPage: (scope?: string, manual?: boolean) => void;
    restoreOriginalContent: () => void;
    getPageTranslationStatus: () => PageTranslationStatus;
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
    if (options.config.autoTranslate) {
        options.autoTranslateEnglishPage();
    }

    const handleMessage: RuntimeMessageHandler = (message, _sender, sendResponse) => {
        if (!isContextMenuTranslateMessage(message)) return false;

        if (options.config.on === false) {
            sendResponse({ status: 'disabled' });
            return true;
        }

        if (message.action === 'fullPage') {
            try {
                options.autoTranslateEnglishPage(message.scope, true);
                sendResponse({ status: 'success', action: 'started' });
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
            sendResponse({ status: 'success', action: 'restored' });
            return true;
        }

        if (message.action === 'getStatus') {
            const pageTranslation = options.getPageTranslationStatus();
            sendResponse({ status: 'success', isTranslated: pageTranslation.phase === 'translated', pageTranslation });
            return true;
        }

        return false;
    };
    options.runtime.onMessage.addListener(handleMessage);

    return {
        dispose() {
            options.runtime.onMessage.removeListener?.(handleMessage);
        }
    };
}

function isContextMenuTranslateMessage(message: unknown): message is ContextMenuTranslateMessage {
    if (!message || typeof message !== 'object') return false;

    const candidate = message as Partial<ContextMenuTranslateMessage>;
    return candidate.type === 'contextMenuTranslate'
        && (candidate.action === 'fullPage' || candidate.action === 'restore' || candidate.action === 'getStatus');
}
