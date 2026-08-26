import {method} from "../utils/constant";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

async function google(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    assertSingleTranslationMessage(message);
    const targetLang = message.targetLang || config.to;
    const params: Record<string, string | number> = {
        client: 'gtx', sl: config.from, tl: targetLang, dt: 't', strip: 1, nonced: 1,
        'q': encodeURIComponent(message.origin),
    };
    let queryString = Object.keys(params).map((key: string) => key + '=' + params[key]).join('&');

    const resp = await fetch('https://translate.googleapis.com/translate_a/single?' + queryString, {
        method: method.GET,
    });

    if (resp.ok) {
        const result = await resp.json() as unknown[];
        const translationParts = Array.isArray(result[0]) ? result[0] : [];
        let sentence = '';
        translationParts.forEach((part) => {
            if (Array.isArray(part) && typeof part[0] === 'string') {
                sentence += part[0];
            }
        });
        return sentence;
    } else {
        console.log(resp);
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
    }
}

export default google;
