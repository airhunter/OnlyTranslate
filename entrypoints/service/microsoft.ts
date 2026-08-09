import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

const MICROSOFT_TRANSLATE_URL = "https://edge.microsoft.com/translate/translatetext";

export class MicrosoftEndpointUnavailableError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'MicrosoftEndpointUnavailableError';
    }
}

function escapePlainText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function decodePlainText(value: string): string {
    return value
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
}

async function microsoft(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    assertSingleTranslationMessage(message);
    // Short snippets are frequently misclassified by franc-min as ISO 639-3 codes
    // that this endpoint does not accept. In automatic mode, let Microsoft detect
    // the source language instead of forwarding the per-snippet detection result.
    const fromLang = config.from === 'auto' ? '' : config.from;
    const targetLang = message.targetLang || config.to;
    const url = `${MICROSOFT_TRANSLATE_URL}?from=${encodeURIComponent(fromLang)}&to=${encodeURIComponent(targetLang)}&isEnterpriseClient=false`;

    let resp: Response;
    try {
        resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([escapePlainText(message.origin)]),
        });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new MicrosoftEndpointUnavailableError(
            `${t('runtime.microsoftEndpointUnavailable')}: ${detail}`,
            { cause: error },
        );
    }

    if (!resp.ok) {
        const responseBody = await resp.text().catch(() => '');
        const detail = responseBody ? ` body: ${responseBody}` : '';
        throw new MicrosoftEndpointUnavailableError(
            `${t('runtime.microsoftEndpointUnavailable')}: HTTP ${resp.status} ${resp.statusText}${detail}`,
        );
    }

    try {
        const result = await resp.json() as unknown;
        if (!Array.isArray(result) || result.length !== 1) {
            throw new Error('expected exactly one translation result');
        }

        const translations = (result[0] as { translations?: unknown })?.translations;
        const translatedText = Array.isArray(translations)
            ? (translations[0] as { text?: unknown } | undefined)?.text
            : undefined;
        if (typeof translatedText !== 'string') {
            throw new Error('missing translated text');
        }

        return decodePlainText(translatedText);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`${t('runtime.microsoftInvalidResponse')}: ${detail}`, { cause: error });
    }
}

export default microsoft;
