import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

const GOOGLE_TRANSLATE_HTML_URL = 'https://translate-pa.googleapis.com/v1/translateHtml';
const GOOGLE_TRANSLATE_HTML_API_KEY = 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520';
const GOOGLE_TRANSLATE_HTML_CLIENT = 'wt_lib';

function escapePlainText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\u00a0/g, '&nbsp;');
}

function decodePlainText(value: string): string {
    return value.replace(/&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos|nbsp);/gi, (entity, decimal, hexadecimal) => {
        if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
        if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
        switch (entity.toLowerCase()) {
            case '&amp;': return '&';
            case '&lt;': return '<';
            case '&gt;': return '>';
            case '&quot;': return '"';
            case '&apos;': return "'";
            case '&nbsp;': return '\u00a0';
            default: return entity;
        }
    });
}

async function google(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    assertSingleTranslationMessage(message);
    const targetLang = message.targetLang || config.to;
    const sourceLang = config.from === 'auto' ? 'auto' : config.from;
    const isHtml = message.textFormat === 'html';
    const requestText = isHtml ? message.origin : escapePlainText(message.origin);
    const resp = await fetch(GOOGLE_TRANSLATE_HTML_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json+protobuf',
            'X-Goog-API-Key': GOOGLE_TRANSLATE_HTML_API_KEY,
        },
        body: JSON.stringify([[[requestText], sourceLang, targetLang], GOOGLE_TRANSLATE_HTML_CLIENT]),
    });

    if (resp.ok) {
        const result = await resp.json() as unknown[];
        const translatedText = Array.isArray(result[0]) ? result[0][0] : undefined;
        if (typeof translatedText !== 'string') {
            throw new Error(t('runtime.googleInvalidResponse'));
        }
        return isHtml ? translatedText : decodePlainText(translatedText);
    } else {
        console.log(resp);
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
    }
}

export default google;
