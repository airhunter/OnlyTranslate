import {method, urls} from "../utils/constant";
import {commonMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";
import {t} from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

/**
 * Grok 服务实现
 * 使用 X.AI API，兼容 OpenAI 接口
 * 支持模型：grok-3-beta, grok-3-fast-beta, grok-3-mini-beta, grok-3-mini-fast-beta
 */
async function grok(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[config.service]}`
        });

        const url = config.proxy[config.service] || urls[config.service];

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: commonMsgTemplate(message.origin, message.targetLang)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        return contentPostHandler(result.choices[0].message.content);
    } catch (error) {
        console.error('Grok API调用失败:', error);
        throw error;
    }
}

export default grok; 
