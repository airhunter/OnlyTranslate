import { method, urls } from "../utils/constant";
import {commonBatchMsgTemplate, commonMsgTemplate, commonSubtitleBatchMsgTemplate} from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";
import { t } from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";
import { isBatchTranslationMessage, logBatchTranslationRequest, parseBatchTranslationContent } from "./batch";
import { isSubtitleBatchTranslationMessage, parseSubtitleTranslationContent } from './subtitle'

async function newapi(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[config.service]}`
        });

        let url = config.newApiUrl

        if (!url) {
            throw new Error(t('runtime.newApiUrlMissing'));
        }

        if (url.endsWith('/')) {
            url = url.slice(0, -1); // 删除末尾的斜杠
        }

        // check has /v1
        if (url.endsWith('/v1')) {
            url += '/chat/completions';
        } else if (!url.endsWith('/chat/completions')) {
            url += '/v1/chat/completions';
        }

        const isSubtitleBatch = isSubtitleBatchTranslationMessage(message)
        const isBatch = isBatchTranslationMessage(message);
        if (isSubtitleBatch) {
            logBatchTranslationRequest(config.service, message.job.entries
                .filter(entry => entry.role === 'target')
                .map(entry => entry.text))
        }
        if (isBatch) {
            logBatchTranslationRequest(config.service, message.origins);
        }

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: isSubtitleBatch
                ? commonSubtitleBatchMsgTemplate(message.job, message.fastMode)
                : isBatch
                    ? commonBatchMsgTemplate(message.origins, message.targetLang, message.fastMode)
                    : commonMsgTemplate(message.origin, message.targetLang, message.fastMode)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();

        if (result.choices && result.choices.length > 0) {
            const content = result.choices[0].message.content;
            if (isSubtitleBatch) return parseSubtitleTranslationContent(content, message.job)
            return isBatch
                ? parseBatchTranslationContent(content, message.origins.length)
                : contentPostHandler(content);
        }

        throw new Error(t('runtime.upstreamNoContent'));
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default newapi;
