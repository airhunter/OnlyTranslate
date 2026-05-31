import {method, urls} from "../utils/constant";
import {commonMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";
import { services } from "../utils/option";
import { t } from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

function normalizeOpenAICompatibleUrl(url: string): string {
    let normalizedUrl = url || '';
    if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
    }
    if (normalizedUrl.endsWith('/v1')) {
        return `${normalizedUrl}/chat/completions`;
    }
    if (!normalizedUrl.endsWith('/chat/completions') && !normalizedUrl.includes('/api/generate')) {
        return `${normalizedUrl}/v1/chat/completions`;
    }
    return normalizedUrl;
}

async function common(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    try {

        let token = config.token[config.service] || "";
        let url = config.proxy[config.service] || urls[config.service];
        
        // 从 customProviders 动态获取
        if (config.service.startsWith('custom_')) {
            const provider = config.customProviders?.find(p => p.id === config.service);
            if (provider) {
                token = provider.token || "";
                url = provider.url;
            }
            url = normalizeOpenAICompatibleUrl(url);
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
        console.error('API调用失败:', error);
        throw error;
    }
}

export default common;
