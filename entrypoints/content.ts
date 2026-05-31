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
import { setupInputBoxTranslation } from "@/entrypoints/content/inputBoxTranslation";

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

// 初始化输入框翻译功能
setupInputBoxTranslation({
    config,
    document,
    window,
    runtime: browser.runtime,
    t
});
