import {method, urls} from "../utils/constant";
import {services} from "../utils/option";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";
import type { TranslationServiceMessage, TranslationServiceResult } from "./types";

async function deepl(message: TranslationServiceMessage): Promise<TranslationServiceResult> {
    // deepl 不支持 zh-Hans，需要转换为 zh
    const rawTargetLang = message.targetLang || config.to;
    let targetLang = rawTargetLang === 'zh-Hans' ? 'zh' : rawTargetLang;

    // 判断是否使用代理
    let url: string = config.proxy[config.service] ? config.proxy[config.service] : urls[services.deepL]

    const resp = await fetch(url, {
        method: method.POST,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'DeepL-Auth-Key ' + config.token[services.deepL]
        },
        body: JSON.stringify({
            text: [message.origin],
            target_lang: targetLang,
            tag_handling: 'html',
            context: message.context,  // 添加上下文辅助信息
            preserve_formatting: true
        })
    });

    if (resp.ok) {
        let result = await resp.json();
        return result.translations[0].text
    } else {
        console.log(resp)
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: '' }));
    }
}

export default deepl;
