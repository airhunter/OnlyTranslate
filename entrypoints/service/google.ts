import {method} from "../utils/constant";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";

async function google(message: any) {
    const targetLang = message.targetLang || config.to;
    let params: any = {
        client: 'gtx', sl: config.from, tl: targetLang, dt: 't', strip: 1, nonced: 1,
        'q': encodeURIComponent(message.origin),
    };
    let queryString = Object.keys(params).map((key: string) => key + '=' + params[key]).join('&');

    const resp = await fetch('https://translate.googleapis.com/translate_a/single?' + queryString, {
        method: method.GET,
    });

    if (resp.ok) {
        let result = await resp.json();
        let sentence = '';
        result[0].forEach((e: any) => sentence += e[0]);
        return sentence;
    } else {
        console.log(resp);
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
    }
}

export default google;
