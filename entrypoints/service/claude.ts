import {services} from "../utils/option";
import {method, urls} from "../utils/constant";
import {claudeMsgTemplate, claudeSubtitleBatchMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import { assertSingleTranslationMessage } from "./types";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";
import { isSubtitleBatchTranslationMessage, parseSubtitleTranslationContent } from './subtitle'
import { resolveCustomProviderEndpoint } from '@/entrypoints/utils/providerEndpoint'

async function claude(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    const isSubtitleBatch = isSubtitleBatchTranslationMessage(message)
    if (!isSubtitleBatch) assertSingleTranslationMessage(message);
    const provider = config.service.startsWith('custom_')
        ? config.customProviders?.find(item => item.id === config.service)
        : undefined
    const token = provider?.token || config.token[services.claude] || ''
    // 构建请求头
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    if (token) headers.append('x-api-key', token);
    headers.append('anthropic-version', '2023-06-01');
    headers.append('anthropic-dangerous-direct-browser-access', 'true');

    const url = provider
        ? resolveCustomProviderEndpoint(provider)
        : config.proxy[config.service] || urls[services.claude];

    try {
        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: isSubtitleBatch
                ? claudeSubtitleBatchMsgTemplate(message.job, message.fastMode)
                : message.prompt
                    ? claudeMsgTemplate(message.origin, message.targetLang, message.fastMode, message.prompt)
                    : message.promptContext
                        ? claudeMsgTemplate(message.origin, message.targetLang, message.fastMode, undefined, message.promptContext)
                        : claudeMsgTemplate(message.origin, message.targetLang, message.fastMode)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();
        const contentBlock = Array.isArray(result?.content)
            ? result.content.find((block: { type?: string; text?: unknown }) => typeof block?.text === 'string'
                && (!block.type || block.type === 'text'))
            : undefined
        const content = typeof contentBlock?.text === 'string' ? contentBlock.text : ''
        if (!content.trim()) throw new Error(t('runtime.upstreamNoContent'))
        return isSubtitleBatch
            ? parseSubtitleTranslationContent(content, message.job)
            : content;
    } catch (error) {
        console.error('Claude API 调用失败:', error);
        throw error;
    }
}

export default claude;
