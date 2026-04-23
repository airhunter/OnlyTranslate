import { services, servicesType } from "./option";
import { urls } from "./constant";

/**
 * Test connection for a translation service
 * @param service The service name
 * @param config The config object with token and proxy
 * @returns Promise with success status and message
 */
export async function testConnection(
  service: string,
  config: { token: Record<string, string>; proxy: Record<string, string>; model?: Record<string, string>; customModel?: Record<string, string> }
): Promise<{ success: boolean; message: string }> {
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

    return { success: false, message: "暂不支持测试此服务的连接" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testMicrosoft(signal: AbortSignal): Promise<{ success: boolean; message: string }> {
  try {
    const authResp = await fetch("https://edge.microsoft.com/translate/auth", {
      signal,
    });

    if (!authResp.ok) {
      return { success: false, message: `获取认证令牌失败: ${authResp.status} ${authResp.statusText}` };
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
      return { success: false, message: `翻译请求失败: ${translateResp.status} ${translateResp.statusText} ${errorBody}` };
    }

    const result = await translateResp.json();
    const translatedText = result[0]?.translations?.[0]?.text || "未知";

    return { success: true, message: `连接成功！翻译结果: "${translatedText}"` };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { success: false, message: "连接超时（10秒）" };
    }
    return { success: false, message: `连接失败: ${error.message || "未知错误"}` };
  }
}

async function testAI(
  service: string,
  config: { token: Record<string, string>; proxy: Record<string, string>; model?: Record<string, string>; customModel?: Record<string, string> },
  signal: AbortSignal
): Promise<{ success: boolean; message: string }> {
  try {
    const token = config.token[service] || "";
    // 除了 custom 和 newapi 以外，一般需要 token
    if (!token && service !== services.custom && service !== services.newapi) {
      return { success: false, message: "请先配置访问令牌" };
    }

    const url = config.proxy[service] || urls[service];
    if (!url) {
      return { success: false, message: "未找到服务地址" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // 只有在 token 存在时才添加 Authorization 头部
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (service === services.openrouter) {
      headers["HTTP-Referer"] = "https://fluent.thinkstu.com";
      headers["X-Title"] = "FluentRead";
    }

    // 获取当前配置的模型
    let currentModel = "gpt-3.5-turbo"; // 默认兜底
    if (config.model && config.model[service]) {
        currentModel = config.model[service];
        // 如果是自定义模型，则取自定义模型的名称
        if (currentModel === "自定义模型" && config.customModel && config.customModel[service]) {
            currentModel = config.customModel[service];
        }
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: "system", content: "You are a translator." },
          { role: "user", content: "Translate 'hello' to Chinese." },
        ],
        max_tokens: 100,
      }),
      signal,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      
      if (resp.status === 401) {
        return { success: false, message: "认证失败：请检查访问令牌是否正确" };
      }
      if (resp.status === 404) {
        return { success: false, message: "服务地址无效：请检查代理地址是否正确" };
      }
      
      return { success: false, message: `请求失败: ${resp.status} ${resp.statusText} ${errorBody}` };
    }

    const result = await resp.json();
    const translatedText = result.choices?.[0]?.message?.content || "未知";

    return { success: true, message: `连接成功！翻译结果: "${translatedText}"` };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { success: false, message: "连接超时（10秒）" };
    }
    return { success: false, message: `连接失败: ${error.message || "未知错误"}` };
  }
}

async function testDeepL(
  config: { token: Record<string, string>; proxy: Record<string, string> },
  signal: AbortSignal
): Promise<{ success: boolean; message: string }> {
  try {
    const token = config.token[services.deepL];
    if (!token) {
      return { success: false, message: "请先配置 DeepL 访问令牌" };
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
        return { success: false, message: "认证失败：请检查 DeepL 访问令牌是否正确" };
      }
      
      return { success: false, message: `请求失败: ${resp.status} ${resp.statusText}。请检查令牌是否正确` };
    }

    const result = await resp.json();
    const translatedText = result.translations?.[0]?.text || "未知";

    return { success: true, message: `连接成功！翻译结果: "${translatedText}"` };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { success: false, message: "连接超时（10秒）" };
    }
    return { success: false, message: `连接失败: ${error.message || "未知错误"}` };
  }
}