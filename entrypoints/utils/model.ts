import { defaultOption, services } from "./option";

interface IMapping {
    [key: string]: string;
}

interface IBooleanMapping {
    [key: string]: boolean;
}

// 内包，存储额外信息
interface IExtra {
    [key: string]: {
        secret?: string;
        expiration?: number;
    }
}

export interface CustomProvider {
    id: string;          // 唯一标识，例如 'custom_1712345678'
    name: string;        // 自定义名称，如 '本地 Ollama'
    protocol?: CustomProviderProtocol; // 兼容接口格式，旧配置默认按 OpenAI 处理
    url: string;         // 接口地址
    token: string;       // API Key
    model: string;       // 选中的模型
    customModel: string; // 自定义模型名
}

export type CustomProviderProtocol = 'openai' | 'anthropic';
export type TtsEngine = 'system' | 'edge';

export class Config {
    on: boolean; // 是否开启
    autoTranslate: boolean; // 是否即时翻译
    from: string;
    to: string;
    hotkey: string;
    style: number;
    display: number = 1;
    service: string;
    token: IMapping;
    ak: string;
    sk: string;
    appid: string;
    key: string;
    model: IMapping;
    customModel: IMapping;  // 自定义模型名称
    proxy: IMapping;  // 代理地址
    custom: string; // 本地服务地址
    extra: IExtra;  // 额外信息（内包信息）
    robot_id: IMapping;  // 机器人 ID（兼容 coze）
    system_role: IMapping;
    user_role: IMapping;
    thinking: IBooleanMapping; // 各 AI 服务是否启用思考模式
    count: number;  // 翻译次数
    theme: string;  // 主题模式：'auto' | 'light' | 'dark'
    uiLocale: string; // 界面语言：'auto' | 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP'
    useCache: boolean; // 是否使用缓存
    disableFloatingBall: boolean; // 是否禁用悬浮球
    floatingBallPosition: 'left' | 'right'; // 悬浮球位置
    floatingBallOffsetY: number | null; // 悬浮球距离页面顶部的位置，未拖动时为 null
    floatingBallHotkey: string; // 悬浮球快捷键
    customFloatingBallHotkey: string; // 自定义悬浮球快捷键
    customHotkey: string; // 自定义鼠标悬浮快捷键
    disableSelectionTranslator: boolean; // 是否禁用划词翻译
    deeplx: string; // DeepLX 服务地址
    selectionTranslatorMode: string; // 划词翻译显示模式: 'disabled' | 'bilingual' | 'translation-only'
    newApiUrl: string; // NewAPI地址
    maxConcurrentTranslations: number; // 最大并发翻译数量
    youdaoAppKey: string; // 有道翻译 App Key
    youdaoAppSecret: string; // 有道翻译 App Secret
    tencentSecretId: string; // 腾讯云 Secret ID
    tencentSecretKey: string; // 腾讯云 Secret Key
    azureOpenaiEndpoint: string; // Azure OpenAI 端点地址
    animations: boolean; // 是否启用动画效果
    bidirectionalTranslation: boolean; // 是否启用默认目标语言与互译语言的双向互译
    bidirectionalTarget: string; // 双向互译的另一侧语言
    inputBoxTranslationTrigger: string; // 输入框翻译触发方式
    inputBoxTranslationTarget: string; // 输入框翻译目标语言
    enableVideoSubtitle: boolean; // 是否启用视频字幕翻译
    videoSubtitleFastMode: boolean; // 是否优先降低视频字幕翻译延迟
    customProviders: CustomProvider[]; // 动态自定义网关池
    activeBuiltinProviders: string[]; // 用户手动启用/留存在面板的内置预设服务 ID
    translationScope: 'smart' | 'full'; // 翻译范围：smart=智能识别主内容，full=翻译整个页面
    ttsEngine: TtsEngine; // 朗读引擎：system=系统语音，edge=Edge 在线语音
    ttsVoice: IMapping; // 各朗读引擎选中的音色，空字符串表示自动匹配语言

    constructor() {
        this.on = true;
        this.autoTranslate = false;
        this.from = defaultOption.from;
        this.to = defaultOption.to;
        this.style = defaultOption.style;
        this.display = defaultOption.display;
        this.hotkey = defaultOption.hotkey;
        this.service = defaultOption.service;
        this.token = {};
        this.ak = '';
        this.sk = '';
        this.appid = '';
        this.key = '';
        this.model = {};
        this.customModel = {};
        this.proxy = {};
        this.custom = defaultOption.custom;
        this.extra = {};
        this.robot_id = {};
        this.system_role = systemRoleFactory();
        this.user_role = userRoleFactory();
        this.thinking = {};
        this.count = 0;
        this.theme = 'auto';  // 默认跟随系统
        this.uiLocale = 'auto'; // 默认跟随浏览器
        this.useCache = true; // 默认开启缓存
        this.disableFloatingBall = false; // 默认启用悬浮球
        this.floatingBallPosition = 'right'; // 默认在右侧
        this.floatingBallOffsetY = null; // 默认使用右下角位置
        this.floatingBallHotkey = 'Alt+T'; // 默认快捷键为 Alt+T
        this.customFloatingBallHotkey = ''; // 自定义快捷键为空
        this.customHotkey = ''; // 自定义鼠标悬浮快捷键为空
        this.disableSelectionTranslator = false; // 默认不禁用划词翻译
        this.deeplx = ''; // DeepLX 默认服务地址
        this.selectionTranslatorMode = 'bilingual'; // 默认双语显示模式
        this.newApiUrl = 'http://localhost:3000'; // NewAPI 默认地址
        this.maxConcurrentTranslations = 6; // 默认最大并发数为6
        this.youdaoAppKey = ''; // 有道翻译 App Key
        this.youdaoAppSecret = ''; // 有道翻译 App Secret
        this.tencentSecretId = ''; // 腾讯云 Secret ID
        this.tencentSecretKey = ''; // 腾讯云 Secret Key
        this.azureOpenaiEndpoint = ''; // Azure OpenAI 端点地址
        this.animations = true; // 默认启用动画
        this.bidirectionalTranslation = false; // 默认关闭双向互译
        this.bidirectionalTarget = 'en'; // 默认与英文互译
        this.inputBoxTranslationTrigger = 'disabled'; // 默认关闭输入框翻译
        this.inputBoxTranslationTarget = 'en'; // 默认翻译成英文
        this.enableVideoSubtitle = true; // 默认启用视频字幕翻译
        this.videoSubtitleFastMode = true; // 默认优先视频字幕翻译速度
        this.customProviders = []; // 默认没有自定义节点
        this.activeBuiltinProviders = []; // 默认空的启用列表，加载时会进行迁移
        this.translationScope = 'smart'; // 默认智能识别主内容
        this.ttsEngine = 'system'; // 默认优先使用浏览器提供的系统语音
        this.ttsVoice = {}; // 默认按文本语言自动匹配音色
    }
}

// 构建所有服务的 system_role
function systemRoleFactory(): IMapping {
    let systems_role: IMapping = {};
    Object.keys(services).forEach(key => systems_role[key] = defaultOption.system_role);
    return systems_role;
}

// 构建所有服务的 user_role
function userRoleFactory(): IMapping {
    let users_role: IMapping = {};
    Object.keys(services).forEach(key => users_role[key] = defaultOption.user_role);
    return users_role;
}
