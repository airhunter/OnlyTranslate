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
import { setupContentRuntimeControls, setupContentUnloadCleanup } from "@/entrypoints/content/contentControls";

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

        setupContentRuntimeControls({
            runtime: browser.runtime,
            config,
            document,
            cache,
            mountFloatingBall,
            unmountFloatingBall,
            mountSelectionTranslator,
            unmountSelectionTranslator
        });

        setupContentUnloadCleanup({
            window,
            cancelAllTranslations,
            unmountFloatingBall,
            unmountSelectionTranslator
        });
    }
})

// 初始化输入框翻译功能
setupInputBoxTranslation({
    config,
    document,
    window,
    runtime: browser.runtime,
    t
});
