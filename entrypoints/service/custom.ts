import {commonMsgTemplate} from "../utils/template";
import {method} from "../utils/constant";
import {services} from "@/entrypoints/utils/option";
import {config} from "@/entrypoints/utils/config";
import {contentPostHandler} from "@/entrypoints/utils/check";

async function custom(message: any) {

    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', `Bearer ${config.token[services.custom]}`);

    let url = config.custom || '';
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    // 智能修正后缀
    if (url.endsWith('/v1')) {
        url += '/chat/completions';
    } else if (!url.endsWith('/chat/completions') && !url.includes('/api/generate')) {
        // 如果连 /v1 都没有且不是本地 Ollama 生成接口，自动加上标准后缀
        url += '/v1/chat/completions';
    }

    const resp = await fetch(url, {
        method: method.POST,
        headers: headers,
        body: commonMsgTemplate(message.origin)
    });

    if (resp.ok) {
        let result = await resp.json();
        return  contentPostHandler(result.choices[0].message.content);
    } else {
        console.log("翻译失败：", resp);
        throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
    }
}

export default custom;