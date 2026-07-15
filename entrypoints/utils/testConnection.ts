import { services, servicesType } from "./option";
import { urls } from "./constant";
import type { CustomProvider } from "./model";

interface TestConnectionConfig {
  token: Record<string, string>;
  proxy: Record<string, string>;
  model?: Record<string, string>;
  customModel?: Record<string, string>;
  customProviders?: CustomProvider[];
}

export type ConnectionTestCode =
  | "success"
  | "unsupported"
  | "missing-token"
  | "missing-url"
  | "auth-failed"
  | "not-found"
  | "request-failed"
  | "timeout"
  | "network-error";

export interface ConnectionTestResult {
  success: boolean;
  code: ConnectionTestCode;
  translatedText?: string;
  detail?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

/**
 * Test connection for a translation service
 * @param service The service name
 * @param config The config object with token and proxy
 * @returns Promise with success status and message
 */
export async function testConnection(
  service: string,
  config: TestConnectionConfig
): Promise<ConnectionTestResult> {
  const timeout = 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    if (service === services.microsoft) {
      return await testMicrosoft(controller.signal);
    }

    if (servicesType.isAI(service)) {
      return await testAI(service, config, controller.signal);
    }

    if (service === services.deepL) {
      return await testDeepL(config, controller.signal);
    }

    return { success: false, code: "unsupported" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testMicrosoft(signal: AbortSignal): Promise<ConnectionTestResult> {
  try {
    const authResp = await fetch("https://edge.microsoft.com/translate/auth", {
      signal,
    });

    if (!authResp.ok) {
      return { success: false, code: "request-failed", detail: `${authResp.status} ${authResp.statusText}` };
    }

    const jwtToken = await authResp.text();

    const translateResp = await fetch(
      "https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=zh&api-version=3.0",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify([{ Text: "hello" }]),
        signal,
      }
    );

    if (!translateResp.ok) {
      const errorBody = await translateResp.text();
      return {
        success: false,
        code: "request-failed",
        detail: `${translateResp.status} ${translateResp.statusText} ${errorBody}`.trim(),
      };
    }

    const result = await translateResp.json() as unknown;
    const firstItem = Array.isArray(result) ? asRecord(result[0]) : null;
    const translations = firstItem?.translations;
    const firstTranslation = Array.isArray(translations) ? asRecord(translations[0]) : null;
    const translatedText = typeof firstTranslation?.text === "string" ? firstTranslation.text : "";

    return { success: true, code: "success", translatedText };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return { success: false, code: "timeout" };
    }
    return { success: false, code: "network-error", detail: getErrorMessage(error) };
  }
}

async function testAI(
  service: string,
  config: TestConnectionConfig,
  signal: AbortSignal
): Promise<ConnectionTestResult> {
  try {
    let token = config.token[service] || "";
    let url = config.proxy[service] || urls[service];
    let currentModel = "gpt-3.5-turbo"; // 默认兜底
    
    if (config.model && config.model[service]) {
        currentModel = config.model[service];
        if (currentModel === "自定义模型" && config.customModel && config.customModel[service]) {
            currentModel = config.customModel[service];
        }
    }

    if (service.startsWith('custom_')) {
        const provider = config.customProviders?.find(p => p.id === service);
        if (provider) {
            token = provider.token || "";
            url = provider.url;
            currentModel = provider.model === "自定义模型" ? provider.customModel : provider.model;
        }
    }

    // 除了 custom 以外，一般需要 token
    if (!token && !service.startsWith('custom_') && service !== services.newapi) {
      return { success: false, code: "missing-token" };
    }

    if (!url) {
      return { success: false, code: "missing-url" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // 只有在 token 存在时才添加 Authorization 头部
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (service === services.openrouter) {
      headers["HTTP-Referer"] = "https://github.com/airhunter/OnlyTranslate";
      headers["X-Title"] = "OnlyTranslate";
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: currentModel || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "你是一个专业的翻译器。请将用户的输入翻译为中文，且只能输出翻译结果，禁止输出任何拼音、解释或额外的英文字符。" },
          { role: "user", content: "hello" },
        ],
        max_tokens: 100,
      }),
      signal,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      
      if (resp.status === 401) {
        return { success: false, code: "auth-failed" };
      }
      if (resp.status === 404) {
        return { success: false, code: "not-found" };
      }
      
      return {
        success: false,
        code: "request-failed",
        detail: `${resp.status} ${resp.statusText} ${errorBody}`.trim(),
      };
    }

    const result = asRecord(await resp.json() as unknown);
    const choices = result?.choices;
    const firstChoice = Array.isArray(choices) ? asRecord(choices[0]) : null;
    const message = asRecord(firstChoice?.message);
    const translatedText = typeof message?.content === "string" ? message.content : "";

    return { success: true, code: "success", translatedText };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return { success: false, code: "timeout" };
    }
    return { success: false, code: "network-error", detail: getErrorMessage(error) };
  }
}

async function testDeepL(
  config: { token: Record<string, string>; proxy: Record<string, string> },
  signal: AbortSignal
): Promise<ConnectionTestResult> {
  try {
    const token = config.token[services.deepL];
    if (!token) {
      return { success: false, code: "missing-token" };
    }

    const url = config.proxy[services.deepL] || urls[services.deepL];

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `DeepL-Auth-Key ${token}`,
      },
      body: JSON.stringify({
        text: ["hello"],
        target_lang: "ZH",
      }),
      signal,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      
      if (resp.status === 401 || resp.status === 403) {
        return { success: false, code: "auth-failed" };
      }
      
      return {
        success: false,
        code: "request-failed",
        detail: `${resp.status} ${resp.statusText} ${errorBody}`.trim(),
      };
    }

    const result = asRecord(await resp.json() as unknown);
    const translations = result?.translations;
    const firstTranslation = Array.isArray(translations) ? asRecord(translations[0]) : null;
    const translatedText = typeof firstTranslation?.text === "string" ? firstTranslation.text : "";

    return { success: true, code: "success", translatedText };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return { success: false, code: "timeout" };
    }
    return { success: false, code: "network-error", detail: getErrorMessage(error) };
  }
}
