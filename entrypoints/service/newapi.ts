import { method, urls } from "../utils/constant";
import {commonMsgTemplate, deepseekMsgTemplate} from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";
import { t } from "@/entrypoints/utils/i18n";

async function newapi(message: any) {
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

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: commonMsgTemplate(message.origin, message.targetLang)
        });

        if (!resp.ok) {
            throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
        }

        const result = await resp.json();

        if (result.choices && result.choices.length > 0) {
            return contentPostHandler(result.choices[0].message.content);
        }

        throw new Error(t('runtime.upstreamNoContent'));
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default newapi;
