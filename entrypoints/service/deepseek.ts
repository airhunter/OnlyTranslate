import { method, urls } from "../utils/constant";
import { deepseekMsgTemplate } from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";
import { t } from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

async function deepseek(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[config.service]}`
        });

        const url = config.proxy[config.service] || urls[config.service];

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: deepseekMsgTemplate(message.origin, message.targetLang)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        return contentPostHandler(result.choices[0].message.content);
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default deepseek;
