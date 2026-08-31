import {method, urls} from "../utils/constant";
import {commonBatchMsgTemplate, commonMsgTemplate, commonSubtitleBatchMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";
import { services } from "../utils/option";
import { t } from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";
import { isBatchTranslationMessage, logBatchTranslationRequest, parseBatchTranslationContent } from "./batch";
import {
    isSubtitleBatchTranslationMessage,
    parseSubtitleTranslationContent,
} from './subtitle'
import { resolveCustomProviderEndpoint } from '@/entrypoints/utils/providerEndpoint'

async function common(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {

        let token = config.token[config.service] || "";
        let url = config.proxy[config.service] || urls[config.service];
        
        // 从 customProviders 动态获取
        if (config.service.startsWith('custom_')) {
            const provider = config.customProviders?.find(p => p.id === config.service);
            if (provider) {
                token = provider.token || "";
                url = resolveCustomProviderEndpoint(provider);
            }
        }

        const headers = new Headers({
            'Content-Type': 'application/json'
        });
        
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }

        if(config.service === services.openrouter){
            headers.append('HTTP-Referer', 'https://github.com/airhunter/OnlyTranslate');
            headers.append('X-Title', 'OnlyTranslate');
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
                    ? message.promptContext
                        ? commonBatchMsgTemplate(message.origins, message.targetLang, message.fastMode, message.promptContext)
                        : commonBatchMsgTemplate(message.origins, message.targetLang, message.fastMode)
                    : message.prompt
                        ? commonMsgTemplate(message.origin, message.targetLang, message.fastMode, message.prompt)
                        : message.promptContext
                            ? commonMsgTemplate(message.origin, message.targetLang, message.fastMode, undefined, message.promptContext)
                            : commonMsgTemplate(message.origin, message.targetLang, message.fastMode)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        const content = result.choices[0].message.content;
        if (isSubtitleBatch) return parseSubtitleTranslationContent(content, message.job)
        return isBatch
            ? parseBatchTranslationContent(content, message.origins.length)
            : contentPostHandler(content);
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default common;
