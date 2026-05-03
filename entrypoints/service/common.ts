import {method, urls} from "../utils/constant";
import {commonMsgTemplate} from "../utils/template";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";
import { services } from "../utils/option";

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

async function common(message: any) {
    try {

        const service = typeof message.service === 'string' && message.service ? message.service : config.service;
        let token = config.token[service] || "";
        let url = config.proxy[service] || urls[service];
        
        // 从 customProviders 动态获取
        if (service.startsWith('custom_') || service === 'custom') {
            const provider = config.customProviders?.find(p => p.id === service);
            if (provider) {
                token = provider.token || "";
                url = provider.url;
            } else if (service === 'custom') {
                url = config.custom;
            }
            url = normalizeOpenAICompatibleUrl(url);
        }

        const headers = new Headers({
            'Content-Type': 'application/json'
        });
        
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }

        if(service === services.openrouter){
            headers.append('HTTP-Referer', 'https://github.com/airhunter/OnlyTranslate');
            headers.append('X-Title', 'OnlyTranslate');
        }

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: commonMsgTemplate(message.origin, message.targetLang, service)
        });

        if (!resp.ok) {
            throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
        }

        const result = await resp.json();
        return contentPostHandler(result.choices[0].message.content);
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default common;
