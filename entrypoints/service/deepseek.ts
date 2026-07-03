import { method, urls } from "../utils/constant";
import { commonBatchMsgTemplate, deepseekMsgTemplate } from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";
import { t } from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";
import { isBatchTranslationMessage, logBatchTranslationRequest, parseBatchTranslationContent } from "./batch";

async function deepseek(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[config.service]}`
        });

        const url = config.proxy[config.service] || urls[config.service];

        const isBatch = isBatchTranslationMessage(message);
        if (isBatch) {
            logBatchTranslationRequest(config.service, message.origins);
        }

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: isBatch
                ? commonBatchMsgTemplate(message.origins, message.targetLang)
                : deepseekMsgTemplate(message.origin, message.targetLang)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        const content = result.choices[0].message.content;
        return isBatch
            ? parseBatchTranslationContent(content, message.origins.length)
            : contentPostHandler(content);
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default deepseek;
