import { Config } from "./model";

export const services = {
    microsoft: "microsoft",
    deepL: "deepL",
    google: "google",
    openai: "openai",
    gemini: "gemini",
    zhipu: "zhipu",
    moonshot: "moonshot",
    claude: "claude",
    custom: "custom",
    deepseek: "deepseek",
    minimax: "minimax",
    jieyue: "jieyue",
    siliconCloud: "siliconCloud",
    openrouter: "openrouter",
    grok: "grok",
    newapi: "newapi",
    chromeTranslator: "chromeTranslator",
} as const;

export const servicesType = {
    machine: new Set<string>([
        services.microsoft,
        services.deepL,
        services.google,
        services.chromeTranslator,
    ]),
    AI: new Set<string>([
        services.openai,
        services.gemini,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.custom,
        services.deepseek,
        services.minimax,
        services.jieyue,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    useToken: new Set<string>([
        services.openai,
        services.gemini,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.deepL,
        services.deepseek,
        services.minimax,
        services.jieyue,
        services.custom,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    useModel: new Set<string>([
        services.openai,
        services.gemini,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.custom,
        services.deepseek,
        services.minimax,
        services.jieyue,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    useProxy: new Set<string>([
        services.openai,
        services.gemini,
        services.claude,
        services.google,
        services.deepL,
        services.moonshot,
        services.zhipu,
        services.deepseek,
        services.jieyue,
        services.siliconCloud,
        services.openrouter,
        services.grok,
    ]),
    useCustomUrl: new Set<string>([
        services.custom,
        services.newapi,
    ]),

    isMachine: (service: string) => servicesType.machine.has(service),
    isAI: (service: string) => servicesType.AI.has(service) || service.startsWith('custom_') || service === 'custom',
    isUseToken: (service: string) => servicesType.useToken.has(service) || service.startsWith('custom_') || service === 'custom',
    isUseProxy: (service: string) => servicesType.useProxy.has(service),
    isUseModel: (service: string) => servicesType.useModel.has(service) || service.startsWith('custom_') || service === 'custom',
    isCustom: (service: string) => service === services.custom || service.startsWith('custom_'),
    isNewApi: (service: string) => service === services.newapi,
    isUseCustomUrl: (service: string) => servicesType.useCustomUrl.has(service) || service.startsWith('custom_'),
};

export const customModelString = "自定义模型";

export const models = new Map<string, Array<string>>([
    [services.openai, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-5-chat-latest", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o", "o3", "o3-mini", customModelString]],
    [services.gemini, ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", customModelString]],
    [services.zhipu, ["glm-4.5", "GLM-4-Flash", "glm-4-plus", "glm-4", "glm-4v", customModelString]],
    [services.moonshot, ["kimi-k2-0711-preview", "kimi-k2-turbo-preview", "moonshot-v1-auto", "moonshot-v1-8k", "moonshot-v1-32k", customModelString]],
    [services.claude, ["claude-sonnet-4-0", "claude-opus-4-1", "claude-3-5-haiku-latest"]],
    [services.custom, ["gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-4o", "gemma:7b", "llama2:7b", "mistral:7b", customModelString]],
    [services.deepseek, ["deepseek-chat", "deepseek-reasoner", customModelString]],
    [services.minimax, ["chatcompletion_v2"]],
    [services.jieyue, ["step-1-8k", customModelString]],
    [services.newapi, ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gpt-5-nano", "gpt-5-mini", "gpt5", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", customModelString]],
    [services.grok, ["grok-4-0709", "grok-3-mini", customModelString]],
    [services.siliconCloud, [
        "Qwen/Qwen3-Coder-30B-A3B-Instruct",
        "Qwen/Qwen3-8B",
        "THUDM/GLM-Z1-9B-0414",
        "THUDM/GLM-4-9B-0414",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "Qwen/Qwen2.5-7B-Instruct",
        "internlm/internlm2_5-7b-chat",
        "THUDM/glm-4-9b-chat",
        customModelString
    ]]
]);

export const options = {
    on: [
        {value: true, label: "开启"},
        {value: false, label: "关闭"},
    ],
    autoTranslate: [
        {value: true, label: "开启"},
        {value: false, label: "关闭"},
    ],
    useCache: [
        {value: true, label: "开启"},
        {value: false, label: "关闭"},
    ],
    form: [{value: "auto", label: "自动检测"}],
    to: [
        {value: "zh-Hans", label: "简体中文"},
        {value: "en", label: "English"},
        {value: "ja", label: "日本語"},
        {value: "ko", label: "한국어"},
        {value: "fr", label: "Français"},
        {value: "ru", label: "Русский"},
    ],
    keys: [
        {value: "none", label: "无"},
        {value: "Computer", label: "键盘", disabled: true},
        {value: "Control", label: "Ctrl"},
        {value: "Alt", label: "Alt"},
        {value: "Shift", label: "Shift"},
        {value: "Escape", label: "ESC"},
        {value: "`", label: "`"},
        {value: "mouse", label: "鼠标", disabled: true},
        {value: "DoubleClick", label: "双击"},
        {value: "LongPress", label: "长按"},
        {value: "MiddleClick", label: "中键"},
        {value: "touchscreen", label: "触屏", disabled: true},
        {value: "TwoFinger", label: "双指"},
        {value: "ThreeFinger", label: "三指"},
        {value: "FourFinger", label: "四指"},
        {value: "DoubleClickScree", label: "双击屏幕"},
        {value: "TripleClickScree", label: "三击屏幕"},
        {value: "custom", label: "自定义快捷键"},
    ],
    services: [
        {value: "recommended", label: "推荐", disabled: true},
        {value: services.microsoft, label: "微软翻译", hint: "免配置，开箱即用"},
        {value: services.google, label: "Google 翻译", hint: "免配置，适合双语对照"},
        {value: services.chromeTranslator, label: "Chrome 内置 AI 翻译", hint: "本地模型，无需 API Key"},
        {value: services.deepL, label: "DeepL", hint: "翻译质量稳定，需 API Key"},
        {value: services.openai, label: "OpenAI", hint: "通用性强，需 API Key"},
        {value: services.deepseek, label: "DeepSeek", hint: "性价比高，需 API Key"},
        {value: services.gemini, label: "Gemini", hint: "Google 模型，需 API Key"},
        {value: services.claude, label: "Claude", hint: "写作风格好，需 API Key"},
        {value: "more-ai", label: "更多 AI 服务", disabled: true},
        {value: services.moonshot, label: "Kimi", hint: "Moonshot，需 API Key"},
        {value: services.zhipu, label: "智谱", hint: "GLM 系列，需 API Key"},
        {value: services.minimax, label: "MiniMax", hint: "需 API Key"},
        {value: services.jieyue, label: "阶跃星辰", hint: "Step 系列，需 API Key"},
        {value: services.siliconCloud, label: "SiliconCloud", hint: "模型聚合平台，需 API Key"},
        {value: services.grok, label: "Grok", hint: "xAI，需 API Key"},
        {value: "advanced", label: "高级接入", disabled: true},
        {value: services.custom, label: "自定义接口 (兼发配下网关)", hint: "兼容 OpenAI 格式接口"},
    ],
    display: [
        {value: 0, label: "仅译文"},
        {value: 1, label: "双语对照"},
    ],
    styles: [
        {value: "basic", label: "基础", disabled: true},
        {value: 0, label: "默认", class: "fluent-display-default", group: "basic"},
        {value: 1, label: "粗体", class: "fluent-display-bold", group: "basic"},
        {value: 2, label: "斜体", class: "fluent-display-italic", group: "basic"},
        {value: 3, label: "阴影", class: "fluent-display-text-shadow", group: "basic"},
        {value: "underline", label: "下划线", disabled: true},
        {value: 4, label: "实线下划线", class: "fluent-display-solid-underline", group: "underline"},
        {value: 5, label: "点状下划线", class: "fluent-display-dot-underline", group: "underline"},
        {value: 6, label: "波浪线", class: "fluent-display-wavy", group: "underline"},
        {value: "card", label: "卡片", disabled: true},
        {value: 7, label: "卡片模式", class: "fluent-display-card-mode", group: "card"},
        {value: 8, label: "现代卡片", class: "fluent-display-modern-card", group: "card"},
        {value: 9, label: "纸张样式", class: "fluent-display-paper", group: "card"},
        {value: "highlight", label: "高亮", disabled: true},
        {value: 10, label: "学习模式", class: "fluent-display-learning-mode", group: "highlight"},
        {value: 11, label: "马克笔", class: "fluent-display-marker", group: "highlight"},
        {value: 12, label: "渐隐高亮", class: "fluent-display-highlight-fade", group: "highlight"},
        {value: "background", label: "背景", disabled: true},
        {value: 13, label: "浅黄色", class: "fluent-display-lightyellow", group: "background"},
        {value: 14, label: "浅蓝色", class: "fluent-display-lightblue", group: "background"},
        {value: 15, label: "浅灰色", class: "fluent-display-lightgray", group: "background"},
        {value: "special", label: "特殊", disabled: true},
        {value: 16, label: "引用", class: "fluent-display-quote", group: "special"},
        {value: 17, label: "边框", class: "fluent-display-border", group: "special"},
        {value: 18, label: "聚焦", class: "fluent-display-focus", group: "special"},
        {value: 19, label: "清爽", class: "fluent-display-clean", group: "special"},
        {value: "pro", label: "进阶", disabled: true},
        {value: 20, label: "科技", class: "fluent-display-tech", group: "pro"},
        {value: 21, label: "优雅", class: "fluent-display-elegant", group: "pro"},
        {value: "transparent", label: "透明", disabled: true},
        {value: 22, label: "柔和", class: "fluent-display-dimmed", group: "transparent"},
        {value: 23, label: "透明模式", class: "fluent-display-transparent-mode", group: "transparent"},
    ],
    floatingBallHotkeys: [
        {value: "none", label: "无"},
        {value: "Alt+T", label: "Alt+T / Option+T"},
        {value: "Alt+A", label: "Alt+A / Option+A"},
        {value: "Alt+S", label: "Alt+S / Option+S"},
        {value: "Alt+D", label: "Alt+D / Option+D"},
        {value: "Alt+Q", label: "Alt+Q / Option+Q"},
        {value: "Ctrl+Shift+T", label: "Ctrl+Shift+T / Control+Shift+T"},
        {value: "Ctrl+Shift+A", label: "Ctrl+Shift+A / Control+Shift+A"},
        {value: "F9", label: "F9"},
        {value: "F10", label: "F10"},
        {value: "F11", label: "F11"},
        {value: "F12", label: "F12"},
        {value: "custom", label: "自定义快捷键"},
    ],
    theme: [
        {value: "auto", label: "跟随系统"},
        {value: "light", label: "浅色"},
        {value: "dark", label: "深色"},
    ],
    inputBoxTranslationTarget: [
        {value: "zh-Hans", label: "简体中文"},
        {value: "en", label: "English"},
        {value: "ja", label: "日本語"},
        {value: "ko", label: "한국어"},
        {value: "fr", label: "Français"},
        {value: "ru", label: "Русский"},
        {value: "es", label: "Español"},
        {value: "de", label: "Deutsch"},
        {value: "pt", label: "Português"},
        {value: "it", label: "Italiano"},
    ],
    inputBoxTranslationTrigger: [
        {value: "disabled", label: "关闭"},
        {value: "triple_space", label: "连续三次空格"},
        {value: "triple_equal", label: "连续三次等号 (=)"},
        {value: "triple_dash", label: "连续三次减号 (-)"},
    ],
};

export const defaultOption = {
    on: true,
    from: "auto",
    to: "zh-Hans",
    style: 1,
    display: 1,
    hotkey: "Control",
    service: services.microsoft,
    custom: "http://localhost:11434/v1/chat/completions",
    deeplx: "http://localhost:1188/translate",
    system_role: "You are a professional, authentic machine translation engine.",
    user_role: `Translate the following text into {{to}}, If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes:

{{origin}}`,
    count: 0,
    useCache: true,
    floatingBallHotkey: "Alt+T",
    inputBoxTranslationTrigger: "disabled",
    inputBoxTranslationTarget: "en",
};

export function isServiceConfigured(service: string, config: Config): boolean {
    if (service === services.microsoft || service === services.google || service === services.chromeTranslator) {
        return true;
    }

    if (servicesType.isNewApi(service)) {
        return !!(config.newApiUrl && config.token.newapi);
    }

    if (servicesType.isCustom(service)) {
        const customProvider = config.customProviders?.find(p => p.id === service);
        if (customProvider) {
            return !!customProvider.url; // 只要有 URL 就算配置好了
        }
        return !!config.custom; // 回退判断
    }

    if (servicesType.isUseToken(service)) {
        return !!config.token[service];
    }

    return false;
}
