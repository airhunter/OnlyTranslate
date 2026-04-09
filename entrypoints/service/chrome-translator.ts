import { config } from "@/entrypoints/utils/config";

/**
 * Chrome 内置翻译 API 服务
 * 基于 Chrome 浏览器的 Translation API 实现快速、安全的翻译
 * 
 * 使用 Chrome Offscreen API 在独立的 DOM 环境中运行翻译功能
 */

// 等待 offscreen 文档发送就绪信号（解决 race condition）
async function waitForOffscreenReady(timeout: number = 5000): Promise<void> {
    let readyListener: ((msg: any) => void) | null = null;
    
    const readyPromise = new Promise<void>((resolve) => {
        readyListener = (msg: any) => {
            if (msg.type === 'OFFSCREEN_READY') {
                if (readyListener) {
                    chrome.runtime.onMessage.removeListener(readyListener);
                }
                resolve();
            }
        };
        chrome.runtime.onMessage.addListener(readyListener);
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
            if (readyListener) {
                chrome.runtime.onMessage.removeListener(readyListener);
            }
            reject(new Error('等待 offscreen 就绪超时'));
        }, timeout);
    });

    return Promise.race([readyPromise, timeoutPromise]);
}

// 在 background script 中使用 offscreen API 处理翻译
async function translateWithOffscreen(message: any): Promise<any> {
    try {
        // 确保 offscreen 文档存在
        await ensureOffscreenDocument();

        // 向 offscreen 文档发送翻译请求
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CHROME_TRANSLATE_OFFSCREEN',
                data: {
                    text: message.origin,
                    from: config.from,
                    to: config.to
                }
            }, (response: any) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        // 检查响应
        if (response && typeof response === 'object' && 'success' in response) {
            const typedResponse = response as { success: boolean; result?: string; error?: string };
            if (typedResponse.success) {
                return typedResponse.result;
            } else {
                throw new Error(typedResponse.error || '翻译失败');
            }
        }

        throw new Error('无效的响应格式');
    } catch (error) {
        console.error('Offscreen 翻译失败:', error);
        throw new Error(`Chrome Translation API 不可用：${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 确保 offscreen 文档存在并已就绪
async function ensureOffscreenDocument() {
    try {
        // 检查是否已经有 offscreen 文档
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });

        if (existingContexts.length > 0) {
            return; // 已经存在，且之前已经确认就绪
        }

        // 关键：先设置 ready listener，再创建文档
        // 这样可以确保不会错过 offscreen 发送的 OFFSCREEN_READY 信号
        const readyPromise = waitForOffscreenReady();

        // 创建 offscreen 文档
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_SCRAPING'], // 使用 DOM_SCRAPING 原因来访问 Translation API
            justification: 'Chrome Translation API requires DOM context'
        });

        // 等待 offscreen 发送就绪信号
        await readyPromise;

        console.log('Offscreen 文档创建成功并已就绪');
    } catch (error) {
        console.error('创建 offscreen 文档失败:', error);
        throw new Error('无法创建 offscreen 文档');
    }
}

// 主翻译函数
export default async function chromeTranslator(message: any): Promise<any> {
    // console.log('Chrome Translator 收到消息:', message);

    const text = message.origin;
    
    if (!text || typeof text !== 'string' || text.trim() === '') {
        // console.error('翻译文本为空或无效:', { text, type: typeof text, message });
        throw new Error('翻译文本不能为空');
    }

    // 检查是否在 background script 环境中
    if (typeof window === 'undefined') {
        // console.log('在 background script 中，使用 offscreen API');
        // 在 background script 中，使用 offscreen API
        return await translateWithOffscreen(message);
    }

    // 如果在其他环境中，抛出错误
    throw new Error('Chrome Translation API 只能在 Google Chrome 浏览器 v138 stable 版本以上使用');
}

// ============ 导出的辅助函数 ============

/**
 * 检查语言模型可用性
 * @param sourceLang 源语言代码（如 'en'）
 * @param targetLang 目标语言代码（如 'zh-Hans'）
 * @returns 可用性状态信息
 */
export async function checkChromeTranslationAvailability(
    sourceLang: string = 'en',
    targetLang: string = 'zh-Hans'
): Promise<{
    available: boolean;
    status: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'not-supported';
    message: string;
}> {
    try {
        // 确保 offscreen 文档存在
        await ensureOffscreenDocument();

        // 发送检查请求
        const response = await new Promise<any>((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CHROME_TRANSLATE_CHECK_AVAILABILITY',
                data: { sourceLang, targetLang }
            }, (res) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(res);
                }
            });
        });

        return response;
    } catch (error) {
        return {
            available: false,
            status: 'unavailable',
            message: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        };
    }
}

/**
 * 预下载语言模型
 * 必须在用户手势上下文中调用（如按钮点击事件）
 * 
 * @param sourceLang 源语言代码（如 'en'）
 * @param targetLang 目标语言代码（如 'zh-Hans'）
 * @param onProgress 下载进度回调（0-100）
 * @returns 下载结果
 */
export async function preloadChromeTranslationModel(
    sourceLang: string = 'en',
    targetLang: string = 'zh-Hans',
    onProgress?: (progress: number) => void
): Promise<{ success: boolean; message: string }> {
    try {
        // 确保 offscreen 文档存在
        await ensureOffscreenDocument();

        // 监听进度更新
        const progressListener = (msg: any) => {
            if (msg.type === 'CHROME_TRANSLATE_PRELOAD_PROGRESS') {
                const { sourceLang: src, targetLang: tgt, progress } = msg.data || {};
                if (src === sourceLang && tgt === targetLang && onProgress) {
                    onProgress(progress);
                }
            }
        };
        chrome.runtime.onMessage.addListener(progressListener);

        try {
            // 发送预下载请求
            const response = await new Promise<any>((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'CHROME_TRANSLATE_PRELOAD',
                    data: { sourceLang, targetLang }
                }, (res) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(res);
                    }
                });
            });

            return response;
        } finally {
            // 移除进度监听器
            chrome.runtime.onMessage.removeListener(progressListener);
        }
    } catch (error) {
        return {
            success: false,
            message: `预下载失败: ${error instanceof Error ? error.message : '未知错误'}`
        };
    }
}