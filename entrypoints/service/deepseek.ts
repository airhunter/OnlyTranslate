import { method, urls } from "../utils/constant";
import { deepseekMsgTemplate } from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";

async function deepseek(message: any) {
    try {
        const service = typeof message.service === 'string' && message.service ? message.service : config.service;
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[service]}`
        });

        const url = config.proxy[service] || urls[service];

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: deepseekMsgTemplate(message.origin, message.targetLang, service)
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

export default deepseek;
