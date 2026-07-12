import {services} from "../utils/option";
import {method, urls} from "../utils/constant";
import {claudeMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

async function claude(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    assertSingleTranslationMessage(message);
    // 构建请求头
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-api-key', config.token[services.claude]);
    headers.append('anthropic-version', '2023-06-01');
    headers.append('anthropic-dangerous-direct-browser-access', 'true');

    const url = config.proxy[config.service] || urls[services.claude];

    try {
        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: claudeMsgTemplate(message.origin, message.targetLang)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        const textBlock = result.content.find((block: { type?: string }) => block.type === 'text');
        if (!textBlock?.text) throw new Error(t('runtime.upstreamNoContent'));
        return textBlock.text;
    } catch (error) {
        console.error('Claude API 调用失败:', error);
        throw error;
    }
}

export default claude;
