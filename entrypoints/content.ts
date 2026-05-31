import { handleTranslation, autoTranslateEnglishPage, restoreOriginalContent } from "./main/trans";
import { cache } from "./utils/cache";
import './style.css';
import { config, configReady } from "@/entrypoints/utils/config";
import { mountFloatingBall, unmountFloatingBall } from "@/entrypoints/utils/floatingBall";
import { mountSelectionTranslator, unmountSelectionTranslator } from "@/entrypoints/utils/selectionTranslator";
import { cancelAllTranslations } from "@/entrypoints/utils/translateApi";
import { t } from "@/entrypoints/utils/i18n";
import { hasActiveTextSelection } from "@/entrypoints/utils/selection";
import { setupPageTranslationLifecycle } from "@/entrypoints/content/translationLifecycle";
import { setupVideoSubtitle } from "@/entrypoints/content/videoSubtitleSetup";
import { setupOnboardingWidgets } from "@/entrypoints/content/onboardingSetup";
import { setupFloatingBallHotkey } from "@/entrypoints/content/floatingBallHotkey";
import { setupManualTranslationTriggers } from "@/entrypoints/content/manualTranslationTriggers";

export default defineContentScript({
    matches: ['<all_urls>'],  // 匹配所有页面
    runAt: 'document_end',  // 在页面加载完成后运行
    async main() {
        await configReady // 等待配置加载完成
        if (config.on === false) return; // 如果配置关闭，则不执行任何操作
        // 添加手动翻译事件监听器
        setupManualTranslationTriggers({
            config,
            document,
            window,
            navigator,
            handleTranslation,
            hasActiveTextSelection
        });
        // 添加悬浮球快捷键事件监听器
        setupFloatingBallHotkey({
            config,
            document,
            window,
            navigator,
            isDev: process.env.NODE_ENV === 'development'
        });
        setupPageTranslationLifecycle({
            config,
            document,
            runtime: browser.runtime,
            autoTranslateEnglishPage,
            restoreOriginalContent
        });

        // 挂载悬浮球（如果配置未禁用）
        if (config.disableFloatingBall !== true) {
            // 使用配置中的位置
            mountFloatingBall();
        }
        
        // 挂载划词翻译组件（如果配置未禁用）
        if (config.disableSelectionTranslator !== true) {
            mountSelectionTranslator();
        }
        
        setupOnboardingWidgets();

        setupVideoSubtitle();

        cache.cleaner();    // 检测是否清理缓存

        // background.ts
        browser.runtime.onMessage.addListener((message: { message: string; }, sender: any, sendResponse: () => void) => {
            if (message.message === 'clearCache') {
                cache.clean()
                sendResponse();
                return true;
            }
            return false;
        });
        
        // 处理悬浮球控制消息
        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: () => void) => {
            if (message.type === 'toggleFloatingBall') {
                if (message.isEnabled) {
                    mountFloatingBall();
                } else {
                    unmountFloatingBall();
                }
                sendResponse();
                return true;
            }
            return false;
        });
        
        // 处理划词翻译控制消息
        browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: () => void) => {
            if (message.type === 'updateSelectionTranslatorMode') {
                // 更新配置
                config.selectionTranslatorMode = message.mode;
                
                if (message.mode === 'disabled') {
                    unmountSelectionTranslator();
                } else {
                    // 如果之前没有挂载，现在挂载
                    if (!document.getElementById('only-translate-selection-translator-container')) {
                        mountSelectionTranslator();
                    }
                }
                sendResponse();
                return true;
            }
            return false;
        });
        
        // 在页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            // 取消所有待处理的翻译任务
            cancelAllTranslations();
            // 移除悬浮球
            unmountFloatingBall();
            // 移除划词翻译组件
            unmountSelectionTranslator();
        });
    }
})

// 清除所有翻译的函数
function clearAllTranslations() {
    // 1. 移除所有翻译结果元素
    document.querySelectorAll('.only-translate-translation').forEach(el => el.remove());

    // 2. 移除所有加载状态
    document.querySelectorAll('.only-translate-loading').forEach(el => el.remove());

    // 3. 移除所有错误状态
    document.querySelectorAll('.only-translate-failure').forEach(el => el.remove());

    // 4. 移除所有翻译相关的类名
    document.querySelectorAll('.only-translate-processed').forEach(el => {
        el.classList.remove('only-translate-processed');
    });

    // 5. 清除内存中的缓存
    cache.clean();

    console.log('已清除所有翻译缓存');
}

/**
 * 输入框翻译功能
 */
function setupInputBoxTranslation() {
    let keyPressCount = 0;
    let keyPressTimer: NodeJS.Timeout | null = null;
    let lastTriggerKey = '';
    const TRIPLE_KEY_TIMEOUT = 1000; // 1秒内连续按三下才生效
    
    // 监听键盘事件
    document.addEventListener('keydown', async (event) => {
        // 检查功能是否启用
        if (config.inputBoxTranslationTrigger === 'disabled') {
            return;
        }
        
        // 检查当前焦点元素是否为输入框
        const activeElement = document.activeElement as HTMLElement;
        if (!isInputElement(activeElement)) {
            return;
        }
        
        // 处理不同的触发方式
        const triggerType = config.inputBoxTranslationTrigger;
        
        if (triggerType === 'ctrl_enter') {
            // Ctrl+Enter 触发
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                await handleInputBoxTranslation(activeElement);
                return;
            }
        } else if (triggerType === 'triple_space' || triggerType === 'triple_equal' || triggerType === 'triple_dash') {
            // 连按三次触发
            let targetKey = '';
            switch (triggerType) {
                case 'triple_space':
                    targetKey = ' ';
                    break;
                case 'triple_equal':
                    targetKey = '=';
                    break;
                case 'triple_dash':
                    targetKey = '-';
                    break;
            }
            
            // 只响应目标按键
            if (event.key !== targetKey) {
                // 如果按的不是目标键，重置计数器
                keyPressCount = 0;
                lastTriggerKey = '';
                if (keyPressTimer) {
                    clearTimeout(keyPressTimer);
                    keyPressTimer = null;
                }
                return;
            }
            
            // 检查是否是同一个按键的连续按下
            if (lastTriggerKey !== targetKey) {
                keyPressCount = 1;
                lastTriggerKey = targetKey;
            } else {
                keyPressCount++;
            }
            
            // 如果是第三次按下目标键
            if (keyPressCount === 3) {
                event.preventDefault(); // 阻止默认输入
                await handleInputBoxTranslation(activeElement);
                keyPressCount = 0; // 重置计数器
                lastTriggerKey = '';
            }
            
            // 设置超时，如果在指定时间内没有连续按满三次，就重置计数器
            if (keyPressTimer) {
                clearTimeout(keyPressTimer);
            }
            keyPressTimer = setTimeout(() => {
                keyPressCount = 0;
                lastTriggerKey = '';
            }, TRIPLE_KEY_TIMEOUT);
        }
    });
}

/**
 * 检查元素是否为输入元素
 */
function isInputElement(element: HTMLElement): boolean {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const isInput = tagName === 'input';
    const isTextarea = tagName === 'textarea';
    const isContentEditable = element.contentEditable === 'true';
    
    // 对于input元素，还需要检查type属性
    if (isInput) {
        const inputType = (element as HTMLInputElement).type.toLowerCase();
        const textInputTypes = ['text', 'search', 'url', 'email', 'password'];
        return textInputTypes.includes(inputType);
    }
    
    return isTextarea || isContentEditable;
}

/**
 * 获取输入框中的文本
 */
function getInputBoxText(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input' || tagName === 'textarea') {
        return (element as HTMLInputElement | HTMLTextAreaElement).value.trim();
    } else if (element.contentEditable === 'true') {
        return element.innerText.trim();
    }
    
    return '';
}

/**
 * 根据触发方式去除末尾的触发符号
 */
function removeTriggerSymbols(text: string, triggerType: string): string {
    if (!text || triggerType === 'disabled' || triggerType === 'ctrl_enter') {
        return text;
    }
    
    let triggerSymbol = '';
    switch (triggerType) {
        case 'triple_space':
            triggerSymbol = ' ';
            break;
        case 'triple_equal':
            triggerSymbol = '=';
            break;
        case 'triple_dash':
            triggerSymbol = '-';
            break;
        default:
            return text;
    }
    
    // 去除末尾所有的触发符号
    let cleanedText = text;
    while (cleanedText.endsWith(triggerSymbol)) {
        cleanedText = cleanedText.slice(0, -1);
    }
    
    return cleanedText.trim();
}

/**
 * 设置输入框中的文本
 */
function setInputBoxText(element: HTMLElement, text: string): void {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input' || tagName === 'textarea') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        inputElement.value = text;
        
        // 触发input事件，以便网页能感知到值的变化
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.contentEditable === 'true') {
        element.innerText = text;
        
        // 触发input事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * 创建并显示翻译提示弹窗
 */
function createTranslationTooltip(element: HTMLElement, message: string, type: 'translating' | 'success' | 'error'): HTMLElement {
    // 移除已存在的提示
    removeExistingTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = `fluent-input-tooltip ${type}`;
    tooltip.id = 'fluent-input-translation-tooltip';
    
    // 添加图标和文字
    const icon = getTooltipIcon(type);
    tooltip.innerHTML = `${icon} ${message}`;
    
    // 计算位置
    const rect = element.getBoundingClientRect();
    const tooltipTop = rect.bottom + window.scrollY + 12;
    const tooltipLeft = rect.left + window.scrollX + (rect.width / 2);
    
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.transform = 'translateX(-50%)';
    
    // 如果禁用动画，直接显示，否则使用淡入效果
    if (!config.animations) {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateX(-50%) translateY(0)';
    } else {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 10);
    }
    
    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * 获取提示图标
 */
function getTooltipIcon(type: 'translating' | 'success' | 'error'): string {
    const icons = {
        translating: '•',
        success: '✓',
        error: '!'
    };
    return icons[type];
}

/**
 * 移除现有的提示弹窗
 */
function removeExistingTooltip(): void {
    const existing = document.getElementById('fluent-input-translation-tooltip');
    if (existing) {
        if (!config.animations) {
            // 如果禁用动画，直接移除
            existing.remove();
        } else {
            // 使用淡出动画
            existing.classList.add('hide');
            setTimeout(() => existing.remove(), 300);
        }
    }
}

/**
 * 添加输入框动画效果
 */
function addInputBoxAnimation(element: HTMLElement, animationType: 'translating' | 'success' | 'error'): void {
    // 如果禁用了动画，则不添加动画效果
    if (!config.animations) {
        return;
    }
    
    // 移除已存在的动画类
    element.classList.remove('fluent-input-translating', 'fluent-input-success', 'fluent-input-error');
    
    // 添加新的动画类
    element.classList.add(`fluent-input-${animationType}`);
    
    // 如果不是翻译中的动画，在动画完成后移除类
    if (animationType !== 'translating') {
        setTimeout(() => {
            element.classList.remove(`fluent-input-${animationType}`);
        }, animationType === 'success' ? 1000 : 600);
    }
}

/**
 * 专门用于输入框翻译的微软翻译函数（不使用缓存）
 * 通过background脚本调用，避免Firefox的CORS问题
 */
async function translateWithMicrosoft(text: string, targetLang: string): Promise<string> {
    try {
        // 发送消息给background脚本进行翻译
        const result = await browser.runtime.sendMessage({
            type: 'inputBoxTranslation',
            text: text,
            targetLang: targetLang
        });
        
        if (result && result.success) {
            return result.translatedText;
        } else {
            throw new Error(result?.error || t('runtime.microsoftTranslateFailed'));
        }
    } catch (error) {
        console.error('微软翻译请求失败:', error);
        throw error;
    }
}

/**
 * 处理输入框翻译
 */
async function handleInputBoxTranslation(element: HTMLElement): Promise<void> {
    let tooltip: HTMLElement | null = null;
    
    try {
        const originalText = getInputBoxText(element);
        
        if (!originalText) {
            return;
        }
        
        // 根据触发方式去除末尾的触发符号
        const cleanedText = removeTriggerSymbols(originalText, config.inputBoxTranslationTrigger);
        
        if (!cleanedText) {
            return;
        }
        
        // 显示翻译中的动画和提示
        addInputBoxAnimation(element, 'translating');
        tooltip = createTranslationTooltip(element, '微软翻译中', 'translating');
        
        try {
            // 直接调用微软翻译API，不使用缓存
            const translatedText = await translateWithMicrosoft(cleanedText, config.inputBoxTranslationTarget);
            
            if (translatedText && translatedText !== cleanedText) {
                // 移除翻译中的动画
                element.classList.remove('fluent-input-translating');
                
                // 设置翻译结果
                setInputBoxText(element, translatedText);
                
                // 显示成功动画和提示
                addInputBoxAnimation(element, 'success');
                removeExistingTooltip();
                tooltip = createTranslationTooltip(element, '翻译成功', 'success');
            } else {
                // 翻译结果与原文相同或为空
                element.classList.remove('fluent-input-translating');
                addInputBoxAnimation(element, 'error');
                removeExistingTooltip();
                tooltip = createTranslationTooltip(element, '内容无需翻译', 'error');
            }
        } catch (translationError) {
            // 翻译失败
            element.classList.remove('fluent-input-translating');
            addInputBoxAnimation(element, 'error');
            removeExistingTooltip();
            tooltip = createTranslationTooltip(element, '微软翻译失败', 'error');
            console.error('微软翻译失败:', translationError);
        }
        
        // 自动隐藏提示
        setTimeout(() => removeExistingTooltip(), 2500);
        
    } catch (error) {
        console.error('输入框翻译失败:', error);
        
        // 移除翻译中的动画
        element.classList.remove('fluent-input-translating');
        
        // 显示错误动画和提示
        addInputBoxAnimation(element, 'error');
        removeExistingTooltip();
        tooltip = createTranslationTooltip(element, '翻译服务暂时不可用', 'error');
        
        // 自动隐藏错误提示
        setTimeout(() => removeExistingTooltip(), 3000);
    }
}

// 初始化输入框翻译功能
setupInputBoxTranslation();
