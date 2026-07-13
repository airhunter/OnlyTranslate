// 消息模板工具
import {customModelString, defaultOption, services} from "./option";
import {config} from "@/entrypoints/utils/config";
import type { SubtitleTranslationJob } from '@/entrypoints/video/types'
import { buildSubtitleTranslationPrompt } from '@/entrypoints/service/subtitle'

// openai 格式的消息模板（通用模板）
function isOpenAIReasoningModel(model: string): boolean {
    return /^(?:gpt-5|o\d(?:-|$))/i.test(model)
}

function applyFastTranslationMode(payload: Record<string, unknown>, model: string, fastMode: boolean) {
    if (!fastMode) return

    if (config.service === services.deepseek) {
        if (model === 'deepseek-reasoner') {
            payload.model = 'deepseek-chat'
        }
        payload.thinking = { type: 'disabled' }
        return
    }

    if (isOpenAIReasoningModel(model)) {
        delete payload.temperature
        payload.reasoning_effort = 'low'
    }
}

export function commonMsgTemplate(origin: string, targetLang = config.to, fastMode = false) {
    // 检测是否使用自定义模型
    let model = config.model[config.service];
    let customModel = config.customModel[config.service];
    
    if (config.service.startsWith('custom_')) {
        const provider = config.customProviders?.find(p => p.id === config.service);
        if (provider) {
            model = provider.model;
            customModel = provider.customModel;
        }
    }
    
    model = model === customModelString ? customModel : model;

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    const payload: Record<string, unknown> = {
        'model': model,
        "temperature": 1.0,
        "reasoning_effort": config.thinking?.[config.service] ? 'medium' : 'none',
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ]
    }
    applyFastTranslationMode(payload, model, fastMode)
    return JSON.stringify(payload)
}

export function commonBatchMsgTemplate(origins: string[], targetLang = config.to, fastMode = false) {
    let model = config.model[config.service];
    let customModel = config.customModel[config.service];

    if (config.service.startsWith('custom_')) {
        const provider = config.customProviders?.find(p => p.id === config.service);
        if (provider) {
            model = provider.model;
            customModel = provider.customModel;
        }
    }

    model = model === customModelString ? customModel : model;
    model = model.replace(/（.*）/g, "");

    const payload: Record<string, unknown> = {
        'model': model,
        // 批量响应依赖稳定 JSON 数组，低温度用于降低格式漂移与重排概率。
        "temperature": 0.3,
        "reasoning_effort": config.thinking?.[config.service] ? 'medium' : 'none',
        'messages': [
            {
                'role': 'system',
                'content': 'You are a precise translation engine. Return only valid JSON.'
            },
            {
                'role': 'user',
                'content': [
                    `Translate each string in this JSON array into ${targetLang}.`,
                    'Return a JSON array of strings with the same length and order.',
                    'Do not merge, omit, reorder, explain, or add notes.',
                    'If a string contains tokens like __ONLY_TRANSLATE_INLINE_0_abc__, preserve each token exactly once and do not translate or alter it.',
                    JSON.stringify(origins)
                ].join('\n')
            },
        ]
    }
    applyFastTranslationMode(payload, model, fastMode)
    return JSON.stringify(payload)
}

export function commonSubtitleBatchMsgTemplate(job: SubtitleTranslationJob, fastMode = true) {
    let model = config.model[config.service]
    let customModel = config.customModel[config.service]

    if (config.service.startsWith('custom_')) {
        const provider = config.customProviders?.find(provider => provider.id === config.service)
        if (provider) {
            model = provider.model
            customModel = provider.customModel
        }
    }

    model = model === customModelString ? customModel : model
    model = model.replace(/（.*）/g, '')
    const prompt = buildSubtitleTranslationPrompt(job)
    const payload: Record<string, unknown> = {
        model,
        temperature: 0.2,
        reasoning_effort: config.thinking?.[config.service] ? 'medium' : 'none',
        messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
        ],
    }
    applyFastTranslationMode(payload, model, fastMode)
    return JSON.stringify(payload)
}

// deepseek
export function deepseekMsgTemplate(origin: string, targetLang = config.to, fastMode = false) {
    // 检测是否使用自定义模型
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    if (fastMode && model === 'deepseek-reasoner') {
        model = 'deepseek-chat'
    }

    const payload: {
        model: string;
        messages: Array<{ role: 'system' | 'user'; content: string }>;
        temperature?: number;
        thinking: { type: 'enabled' | 'disabled' };
        reasoning_effort?: 'high';
    } = {
        'model': model,
        thinking: { type: config.thinking?.[config.service] ? 'enabled' : 'disabled' },
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ]
    };

    // 如果不是 deepseek-reasoner 模型,则添加 temperature
    if (model !== 'deepseek-reasoner') {
        payload.temperature = 0.7;
    }
    if (fastMode) {
        payload.thinking = { type: 'disabled' };
    } else if (config.thinking?.[config.service]) {
        payload.reasoning_effort = 'high';
    }

    return JSON.stringify(payload);
}

// gemini
export function geminiMsgTemplate(origin: string, targetLang = config.to, fastMode = false) {
    const model = config.model[config.service] === customModelString
        ? config.customModel[config.service]
        : config.model[config.service]
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    const payload: Record<string, unknown> = {
        "generationConfig": {
            "thinkingConfig": {
                "thinkingBudget": config.thinking?.[config.service] ? 1024 : 0
            }
        },
        "contents": [
            {"role": "user", "parts": [{"text": user}]},
        ]
    }

    if (fastMode && /^gemini-2\.5-/i.test(model)) {
        payload.generationConfig = {
            thinkingConfig: {
                thinkingBudget: /pro/i.test(model) ? 128 : 0,
            },
        }
    } else if (fastMode && /^gemini-3/i.test(model)) {
        payload.generationConfig = {
            thinkingConfig: { thinkingLevel: 'minimal' },
        }
    }

    return JSON.stringify(payload)
}

export function geminiSubtitleBatchMsgTemplate(job: SubtitleTranslationJob, fastMode = true) {
    const model = config.model[config.service] === customModelString
        ? config.customModel[config.service]
        : config.model[config.service]
    const prompt = buildSubtitleTranslationPrompt(job)
    const generationConfig: Record<string, unknown> = {
        responseMimeType: 'application/json',
        thinkingConfig: {
            thinkingBudget: config.thinking?.[config.service] ? 1024 : 0,
        },
    }

    if (fastMode && /^gemini-2\.5-/i.test(model)) {
        generationConfig.thinkingConfig = {
            thinkingBudget: /pro/i.test(model) ? 128 : 0,
        }
    } else if (fastMode && /^gemini-3/i.test(model)) {
        generationConfig.thinkingConfig = { thinkingLevel: 'minimal' }
    }

    return JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [
            { role: 'user', parts: [{ text: prompt.user }] },
        ],
        generationConfig,
    })
}

// claude
export function claudeMsgTemplate(origin: string, targetLang = config.to) {
    let model = config.model[services.claude];
    if (model === "claude-3-5-haiku") model = "claude-3-5-haiku-20241022";
    else if (model === "claude-3-5-sonnet") model = "claude-3-5-sonnet-20241022";
    else if (model === "claude-3-opus") model = "claude-3-opus-20240229";

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    return JSON.stringify({
        model: model,
        max_tokens: 4096,
        stream: false,
        thinking: config.thinking?.[config.service]
            ? { type: 'enabled', budget_tokens: 1024 }
            : { type: 'disabled' },
        system: system,
        messages: [
            {role: "user", content: user},
        ]
    })
}

export function claudeSubtitleBatchMsgTemplate(job: SubtitleTranslationJob) {
    let model = config.model[services.claude]
    if (model === 'claude-3-5-haiku') model = 'claude-3-5-haiku-20241022'
    else if (model === 'claude-3-5-sonnet') model = 'claude-3-5-sonnet-20241022'
    else if (model === 'claude-3-opus') model = 'claude-3-opus-20240229'

    const prompt = buildSubtitleTranslationPrompt(job)
    return JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        system: prompt.system,
        messages: [
            { role: 'user', content: prompt.user },
        ],
    })
}

// 通义千问
export function tongyiMsgTemplate(origin: string, targetLang = config.to) {
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]
    const normalTemplate = () => {
        let system = config.system_role[config.service] || defaultOption.system_role;
        let user = (config.user_role[config.service] || defaultOption.user_role)
            .replace('{{to}}', targetLang).replace('{{origin}}', origin);

        return JSON.stringify({
            "model": model,
            "enable_thinking": config.thinking?.[config.service] === true,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        })
    }
    // 翻译模型qwen-mt-plus和qwen-mt-turbo的格式和通用的不同
    const mtModelTemplate = () => {
        const langMap = [
            {value: "zh-Hans", target: "zh"},
            {value: "en"},
            {value: "ja"},
            {value: "ko"},
            {value: "fr"},
            {value: "ru"},
        ]
        let targetItem = langMap.find(i => i.value === targetLang) || langMap[0]
        let resolvedTargetLang = targetItem.target || targetItem.value
        return JSON.stringify({
            "model": model,
            "messages": [
                {"role": "user", "content": origin},
            ],
            "translation_options": {
                "source_lang": "auto",
                "target_lang": resolvedTargetLang
            }
        })
    }
    return model.startsWith("qwen-mt") ? mtModelTemplate() : normalTemplate()

}

// 文心一言
export function yiyanMsgTemplate(origin: string, targetLang = config.to) {
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    return JSON.stringify({
        'temperature': 0.7,
        'disable_search': true, // 禁用搜索
        'messages': [
            {"role": "user", "content": user},
        ],
    })
}

export function minimaxTemplate(origin: string, targetLang = config.to) {

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    return JSON.stringify({
        model: "MiniMax-Text-01",
        stream: false,
        temperature: 0.7,
        thinking: { type: config.thinking?.[config.service] ? 'adaptive' : 'disabled' },
        messages: [
            {role: 'system', content: system},
            {role: 'user', content: user},
        ]
    })
}

export function cozeTemplate(origin: string, targetLang = config.to) {

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = (config.user_role[config.service] || defaultOption.user_role)
        .replace('{{to}}', targetLang).replace('{{origin}}', origin);

    return JSON.stringify({
        bot_id: config.robot_id[config.service],
        user: "OnlyTranslate",
        query: system + user,
        stream: false
    });
}
