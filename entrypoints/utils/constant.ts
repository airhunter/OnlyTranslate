import { services } from "./option";

export const urls: any = {
    [services.deepL]: "https://api-free.deepl.com/v2/translate",
    [services.openai]: "https://api.openai.com/v1/chat/completions",
    [services.moonshot]: "https://api.moonshot.cn/v1/chat/completions",
    [services.custom]: "https://localhost:11434/v1/chat/completions",
    [services.zhipu]: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    [services.claude]: "https://api.anthropic.com/v1/messages",
    [services.deepseek]: "https://api.deepseek.com/chat/completions",
    [services.jieyue]: "https://api.stepfun.com/v1/chat/completions",
    [services.siliconCloud]: "https://api.siliconflow.cn/v1/chat/completions",
    [services.openrouter]: "https://openrouter.ai/api/v1/chat/completions",
    [services.grok]: "https://api.x.ai/v1/chat/completions",
}

export const method = {POST: "POST", GET: "GET",};

export const constants = {
    DoubleClick: "DoubleClick",
    LongPress: "LongPress",
    MiddleClick: "MiddleClick",
    TwoFinger: "TwoFinger",
    ThreeFinger: "ThreeFinger",
    FourFinger: "FourFinger",
    DoubleClickScreen: "DoubleClickScree",
    TripleClickScreen: "TripleClickScreen",
}

export const styles = {
    singleTranslation: 0,
    bilingualTranslation: 1,
}

export const CONTEXT_MENU_IDS = {
    TRANSLATE_FULL_PAGE: 'fluent-read-translate-full-page',
    RESTORE_ORIGINAL: 'fluent-read-restore-original',
}
