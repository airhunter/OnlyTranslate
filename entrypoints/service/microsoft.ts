import {services} from "../utils/option";
import {config} from "@/entrypoints/utils/config";
import {t} from "@/entrypoints/utils/i18n";

async function microsoft(message: any) {
    let fromLang = config.from === 'auto' ? '' : config.from;
    const targetLang = message.targetLang || config.to;

    const jwtToken = await refreshToken(config.token[services.microsoft]);
    const resp = await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?from=${fromLang}&to=${targetLang}&api-version=3.0&includeSentenceLength=true&textType=html`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.token[services.microsoft],
            'Authorization': 'Bearer ' + jwtToken
        },
        body: JSON.stringify([{Text: message.origin}])
    });

    if (resp.ok) {
        let result = await resp.json();
        return result[0].translations[0].text;
    } else {
        console.log(resp)
        throw new Error(t('runtime.translateFailedStatus', { status: resp.status, statusText: resp.statusText, detail: ` body: ${await resp.text()}` }));
    }
}

async function refreshToken(token: string) {
    const decodedToken = parseJwt(token);
    const currentTimestamp = Math.floor(Date.now() / 1000); // 当前时间的UNIX时间戳（秒）
    if (decodedToken && currentTimestamp < decodedToken.exp) {
        return token;
    }
    // 如果令牌无效或已过期，则尝试获取新令牌
    const resp = await fetch("https://edge.microsoft.com/translate/auth")
    if (resp.ok) return resp.text();
    else throw new Error(t('runtime.requestFailed', { message: String(resp) }));
}

// 解析 jwt，返回解析后对象
function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export default microsoft;
