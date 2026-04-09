/**
 * Chrome Translation API Offscreen 文档
 * 在 offscreen 环境中处理 Chrome Translation API 调用
 * 
 * 关键设计：
 * 1. Translator 缓存机制 - 避免重复创建，提高性能
 * 2. 预下载功能 - 在用户点击按钮时触发下载（保留用户手势上下文）
 * 3. 可用性检查 - 让 UI 能显示模型状态
 */

// 语言代码映射
const languageMap: { [key: string]: string } = {
    'zh-Hans': 'zh',
    'zh-Hant': 'zh-TW',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko',
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'ru': 'ru',
    'it': 'it',
    'pt': 'pt',
    'ar': 'ar',
    'hi': 'hi',
    'th': 'th',
    'vi': 'vi',
    'nl': 'nl',
    'pl': 'pl',
    'tr': 'tr'
};

// ============ Translator 缓存机制 ============
// 缓存已创建的 translator，避免重复创建
interface CachedTranslator {
    translator: any;
    sourceLanguage: string;
    targetLanguage: string;
    createdAt: number;
}

const translatorCache = new Map<string, CachedTranslator>();

// 生成缓存 key
function getCacheKey(sourceLang: string, targetLang: string): string {
    return `${sourceLang}->${targetLang}`;
}

// 从缓存获取 translator
function getCachedTranslator(sourceLang: string, targetLang: string): any | null {
    const key = getCacheKey(sourceLang, targetLang);
    const cached = translatorCache.get(key);
    if (cached) {
        console.log('使用缓存的 translator:', key);
        return cached.translator;
    }
    return null;
}

// 缓存 translator
function cacheTranslator(sourceLang: string, targetLang: string, translator: any): void {
    const key = getCacheKey(sourceLang, targetLang);
    translatorCache.set(key, {
        translator,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        createdAt: Date.now()
    });
    console.log('缓存 translator:', key);
}

// 检查是否支持 Chrome Translation API
function isChromeTranslationSupported(): boolean {
    console.log('检查 Translation API 支持:', {
        hasTranslation: 'translation' in self,
        hasTranslator: 'Translator' in self,
        hasLanguageDetector: 'LanguageDetector' in self,
        windowType: typeof window,
        selfType: typeof self
    });
    
    // 检查新的 API
    if ('translation' in self && 'createTranslator' in (self as any).translation) {
        return true;
    }
    
    // 检查旧的 API
    if ('Translator' in self && 'LanguageDetector' in self) {
        return true;
    }
    
    return false;
}

// ============ 可用性检查 ============
// 检查语言对的可用性状态
async function checkAvailability(sourceLang: string, targetLang: string): Promise<{
    available: boolean;
    status: 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'not-supported';
    message: string;
}> {
    if (!isChromeTranslationSupported()) {
        return {
            available: false,
            status: 'not-supported',
            message: '当前浏览器不支持 Chrome Translation API，需要 Chrome v138+'
        };
    }

    try {
        // 映射语言代码
        const fromLang = languageMap[sourceLang] || sourceLang;
        const toLang = languageMap[targetLang] || targetLang;

        // 检查缓存 - 如果已有缓存，说明可用
        if (getCachedTranslator(fromLang, toLang)) {
            return {
                available: true,
                status: 'available',
                message: '语言模型已就绪（已缓存）'
            };
        }

        // 使用新 API 检查可用性
        if ('Translator' in self && 'availability' in (self as any).Translator) {
            const status = await (self as any).Translator.availability({
                sourceLanguage: fromLang,
                targetLanguage: toLang
            });
            
            console.log('Translator availability:', { fromLang, toLang, status });
            
            switch (status) {
                case 'available':
                    return { available: true, status: 'available', message: '语言模型已就绪' };
                case 'downloadable':
                    return { available: false, status: 'downloadable', message: '需要下载语言模型' };
                case 'downloading':
                    return { available: false, status: 'downloading', message: '语言模型下载中...' };
                case 'unavailable':
                    return { available: false, status: 'unavailable', message: '不支持该语言组合' };
                default:
                    return { available: false, status: 'unavailable', message: `未知状态: ${status}` };
            }
        }

        // 旧 API 或没有 availability 方法，假设可用
        return {
            available: true,
            status: 'available',
            message: 'API 可用（无法检查状态）'
        };
    } catch (error) {
        console.error('检查可用性失败:', error);
        return {
            available: false,
            status: 'unavailable',
            message: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        };
    }
}

// ============ 预下载功能 ============
// 预下载语言模型（必须在用户手势上下文中调用）
async function preloadLanguageModel(
    sourceLang: string, 
    targetLang: string,
    onProgress?: (progress: number) => void
): Promise<{ success: boolean; message: string }> {
    if (!isChromeTranslationSupported()) {
        return { success: false, message: '浏览器不支持 Chrome Translation API' };
    }

    try {
        const fromLang = languageMap[sourceLang] || sourceLang;
        const toLang = languageMap[targetLang] || targetLang;

        console.log('开始预下载语言模型:', { fromLang, toLang });

        // 检查是否已有缓存
        if (getCachedTranslator(fromLang, toLang)) {
            return { success: true, message: '语言模型已就绪（使用缓存）' };
        }

        let translator: any;

        // 使用新 API 创建 translator（会触发下载）
        if ('translation' in self && 'createTranslator' in (self as any).translation) {
            translator = await (self as any).translation.createTranslator({
                sourceLanguage: fromLang,
                targetLanguage: toLang,
                monitor: (m: any) => {
                    m.addEventListener('downloadprogress', (e: any) => {
                        const progress = Math.floor(e.loaded * 100);
                        console.log('下载进度:', progress + '%');
                        if (onProgress) {
                            onProgress(progress);
                        }
                    });
                }
            });
        }
        // 使用旧 API
        else if ('Translator' in self) {
            translator = await (self as any).Translator.create({
                sourceLanguage: fromLang,
                targetLanguage: toLang,
                monitor: (m: any) => {
                    m.addEventListener('downloadprogress', (e: any) => {
                        const progress = Math.floor(e.loaded * 100);
                        console.log('下载进度:', progress + '%');
                        if (onProgress) {
                            onProgress(progress);
                        }
                    });
                }
            });
        } else {
            return { success: false, message: '没有可用的翻译 API' };
        }

        // 缓存 translator
        cacheTranslator(fromLang, toLang, translator);

        console.log('语言模型预下载完成:', { fromLang, toLang });
        return { success: true, message: '语言模型下载完成' };

    } catch (error) {
        console.error('预下载失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        // 处理用户手势错误
        if (errorMessage.includes('user gesture') || errorMessage.includes('user activation')) {
            return { 
                success: false, 
                message: '需要用户手势触发下载。请点击"预下载语言模型"按钮。' 
            };
        }
        
        return { success: false, message: `下载失败: ${errorMessage}` };
    }
}

// 支持的语言列表（Chrome Translation API 支持且常用的语言）
const SUPPORTED_LANGUAGES = new Set([
    'en', 'zh', 'zh-CN', 'zh-TW', 'ja', 'ko', 
    'es', 'fr', 'de', 'ru', 'it', 'pt', 
    'ar', 'hi', 'th', 'vi', 'nl', 'pl', 'tr',
    'id', 'ms', 'cs', 'da', 'el', 'fi', 'hu', 
    'no', 'ro', 'sk', 'sv', 'uk', 'bg', 'hr'
]);

// 检测文本语言
async function detectLanguage(text: string): Promise<string> {
    // 预处理：检查文本是否主要由数字/符号组成
    // 这类文本语言检测不可靠，直接返回英语
    const strippedText = text.replace(/[\d\s\+\-\*\/\=\$\%\@\#\!\?\.\,\:\;\(\)\[\]\{\}]/g, '');
    if (strippedText.length < 2) {
        console.log('文本主要由数字/符号组成，跳过语言检测，默认英语');
        return 'en';
    }

    // 简单检测：如果有明显的中文/日文/韩文字符，直接返回
    const chineseRegex = /[\u4e00-\u9fff]/;
    const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanRegex = /[\uac00-\ud7af]/;
    
    if (chineseRegex.test(text)) {
        return 'zh';
    } else if (japaneseRegex.test(text)) {
        return 'ja';
    } else if (koreanRegex.test(text)) {
        return 'ko';
    }

    // 如果文本中主要是拉丁字母，很可能是英语
    const latinRegex = /[a-zA-Z]/g;
    const latinMatches = text.match(latinRegex);
    if (latinMatches && latinMatches.length >= strippedText.length * 0.8) {
        console.log('文本主要是拉丁字母，默认英语');
        return 'en';
    }

    try {
        // 尝试使用新的 API
        if ('translation' in self && 'createDetector' in (self as any).translation) {
            const detector = await (self as any).translation.createDetector();
            const results = await detector.detect(text);
            
            if (results.length > 0) {
                const detected = results[0].detectedLanguage;
                // 检查置信度（如果有）
                const confidence = results[0].confidence;
                console.log('新 API 检测结果:', { detected, confidence, results });
                
                // 如果置信度太低，回退到英语
                if (confidence !== undefined && confidence < 0.5) {
                    console.log('置信度太低，回退到英语');
                    return 'en';
                }
                
                // 检测后验证：如果检测到的语言不在支持列表中，回退到英语
                if (!SUPPORTED_LANGUAGES.has(detected)) {
                    console.log('检测到的语言不支持:', detected, '，回退到英语');
                    return 'en';
                }
                
                return detected;
            }
            return 'en';
        }
        
        // 尝试使用旧的 API
        if ('LanguageDetector' in self) {
            const detector = await (self as any).LanguageDetector.create();
            const results = await detector.detect(text);
            
            if (results.length > 0) {
                const detected = results[0].detectedLanguage;
                // 检查置信度（如果有）
                const confidence = results[0].confidence;
                console.log('旧 API 检测结果:', { detected, confidence, results });
                
                // 如果置信度太低，回退到英语
                if (confidence !== undefined && confidence < 0.5) {
                    console.log('置信度太低，回退到英语');
                    return 'en';
                }
                
                // 检测后验证：如果检测到的语言不在支持列表中，回退到英语
                if (!SUPPORTED_LANGUAGES.has(detected)) {
                    console.log('检测到的语言不支持:', detected, '，回退到英语');
                    return 'en';
                }
                
                return detected;
            }
            return 'en';
        }
    } catch (error) {
        console.warn('Language detection failed:', error);
    }
    
    // 默认返回英语
    return 'en';
}

// 执行翻译（优先使用缓存）
async function performTranslation(text: string, fromLang: string, toLang: string): Promise<string> {
    console.log('开始翻译:', { text: text.substring(0, 50) + '...', fromLang, toLang });
    
    try {
        // 映射语言代码
        const mappedFrom = languageMap[fromLang] || fromLang;
        const mappedTo = languageMap[toLang] || toLang;
        
        // 优先使用缓存的 translator
        let translator = getCachedTranslator(mappedFrom, mappedTo);
        
        if (!translator) {
            console.log('没有缓存，创建新的 translator');
            
            // 尝试使用新的 API
            if ('translation' in self && 'createTranslator' in (self as any).translation) {
                console.log('使用新的 translation API');
                translator = await (self as any).translation.createTranslator({
                    sourceLanguage: mappedFrom,
                    targetLanguage: mappedTo
                });
            }
            // 尝试使用旧的 API
            else if ('Translator' in self) {
                console.log('使用旧的 Translator API');
                translator = await (self as any).Translator.create({
                    sourceLanguage: mappedFrom,
                    targetLanguage: mappedTo
                });
            } else {
                throw new Error('没有可用的翻译 API');
            }

            // 缓存新创建的 translator
            cacheTranslator(mappedFrom, mappedTo, translator);
        }

        let translatedText = '';
        
        // 检查是否支持流式翻译
        if (translator.translateStreaming) {
            console.log('使用流式翻译');
            const stream = translator.translateStreaming(text);
            for await (const chunk of stream) {
                translatedText += chunk;
            }
        } else if (translator.translate) {
            console.log('使用普通翻译');
            translatedText = await translator.translate(text);
        } else {
            throw new Error('翻译器不支持翻译方法');
        }

        console.log('翻译完成:', translatedText.substring(0, 50) + '...');
        return translatedText;
        
    } catch (error) {
        console.error('翻译执行失败:', error);
        throw error;
    }
}

// 处理翻译请求
async function handleTranslationRequest(data: any): Promise<string> {
    const { text, from, to } = data;
    
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return ""
    }

    // 检查是否支持 Chrome Translation API
    if (!isChromeTranslationSupported()) {
        throw new Error('当前浏览器不支持 Chrome Translation API，请确保使用 Google Chrome 浏览器 v138 stable 或更高版本。');
    }

    // 声明变量以便在 catch 块中使用
    let detectedLang = from;
    let fromLang = from;
    let toLang = to;
    
    try {
        // 检测源语言
        if (from === 'auto') {
            detectedLang = await detectLanguage(text);
            console.log('自动检测到的语言:', detectedLang);
        }
        
        // 映射语言代码 - 确保使用 Chrome API 支持的格式
        fromLang = languageMap[detectedLang] || detectedLang;
        toLang = languageMap[to] || to;

        console.log('语言映射:', { 
            original: { from, to }, 
            detected: detectedLang,
            mapped: { fromLang, toLang }
        });

        // 如果源语言和目标语言相同，不需要翻译
        if (fromLang === toLang) {
            console.log('源语言和目标语言相同，返回原文');
            return text;
        }

        // 执行翻译
        return await performTranslation(text, fromLang, toLang);

    } catch (error) {
        console.error('Chrome Translation API error:', error);
        console.error('错误详情:', {
            error: error,
            message: error instanceof Error ? error.message : '未知错误',
            from: from,
            to: to,
            detectedLang: detectedLang,
            fromLang: fromLang,
            toLang: toLang
        });
        
        // 提供更友好的错误信息
        if (error instanceof Error) {
            const errorMsg = error.message;
            
            // 用户手势错误 - 引导用户预下载
            if (errorMsg.includes('user gesture') || errorMsg.includes('user activation')) {
                throw new Error('需要先下载语言模型。请在设置页面点击"预下载语言模型"按钮。');
            }
            
            if (errorMsg.includes('not available') || errorMsg.includes('not ready')) {
                throw new Error('Chrome Translation API 暂时不可用。可能需要下载语言模型，请在设置页面预下载。');
            } else if (errorMsg.includes('language') || errorMsg.includes('not supported')) {
                throw new Error(`不支持的语言组合：${fromLang} -> ${toLang}。请尝试其他语言对或检查浏览器版本。`);
            } else if (errorMsg.includes('model')) {
                throw new Error('翻译模型未就绪，请在设置页面预下载语言模型。');
            }
        }
        
        throw new Error(`翻译失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 监听来自 background script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log('Offscreen 收到消息:', message);
    
    // 翻译请求
    if (message.type === 'CHROME_TRANSLATE_OFFSCREEN') {
        handleTranslationRequest(message.data)
            .then(result => {
                // console.log('Offscreen 翻译成功:', result.substring(0, 50) + '...');
                sendResponse({ success: true, result });
            })
            .catch(error => {
                console.error('Offscreen 翻译失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // 保持消息通道开放以支持异步响应
    }
    
    // 检查可用性
    if (message.type === 'CHROME_TRANSLATE_CHECK_AVAILABILITY') {
        checkAvailability(message.data?.sourceLang || 'en', message.data?.targetLang || 'zh')
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    available: false,
                    status: 'unavailable',
                    message: error instanceof Error ? error.message : '检查失败'
                });
            });
        
        return true;
    }
    
    // 预下载语言模型
    if (message.type === 'CHROME_TRANSLATE_PRELOAD') {
        const { sourceLang, targetLang } = message.data || { sourceLang: 'en', targetLang: 'zh' };
        
        preloadLanguageModel(sourceLang, targetLang, (progress) => {
            // 发送进度更新
            chrome.runtime.sendMessage({
                type: 'CHROME_TRANSLATE_PRELOAD_PROGRESS',
                data: { sourceLang, targetLang, progress }
            });
        })
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    message: error instanceof Error ? error.message : '预下载失败'
                });
            });
        
        return true;
    }
    
    return false;
});

// 初始化检查
console.log('Chrome Translation Offscreen 初始化');
console.log('Translation API 支持状态:', isChromeTranslationSupported());

// 发送就绪信号，通知 background script 监听器已注册完成
// 这是解决 race condition 的关键：让 background 等待此信号后再发送消息
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });