import {method} from "../utils/constant";
import {geminiMsgTemplate, geminiSubtitleBatchMsgTemplate} from "../utils/template";
import {customModelString} from "../utils/option";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";
import { isSubtitleBatchTranslationMessage, parseSubtitleTranslationContent } from './subtitle'


async function gemini(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    const isSubtitleBatch = isSubtitleBatchTranslationMessage(message)
    if (!isSubtitleBatch) assertSingleTranslationMessage(message);

    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 判断是否使用代理
    let url: string = config.proxy[config.service] ?
        config.proxy[config.service] : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.token[config.service]}`;

    const resp = await fetch(url, {
        method: method.POST,
        headers: {'Content-Type': 'application/json'},
        body: isSubtitleBatch
            ? geminiSubtitleBatchMsgTemplate(message.job, message.fastMode)
            : geminiMsgTemplate(message.origin, message.targetLang, message.fastMode),
    });
    if (resp.ok) {
        let result = await resp.json();
        const parts = result?.candidates?.[0]?.content?.parts
        const content = Array.isArray(parts)
            ? parts
                .filter((part: { thought?: boolean; text?: unknown }) => part?.thought !== true && typeof part?.text === 'string')
                .map((part: { text: string }) => part.text)
                .join('')
            : ''
        if (!content.trim()) throw new Error(t('runtime.upstreamNoContent'))
        return isSubtitleBatch
            ? parseSubtitleTranslationContent(content, message.job)
            : content;
    } else {
        console.log(resp)
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
    }
}

export default gemini;
