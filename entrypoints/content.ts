import { handleTranslation, autoTranslateEnglishPage, restoreOriginalContent } from "./main/trans";
import { cache } from "./utils/cache";
import './style.css';
import { config, configReady } from "@/entrypoints/utils/config";
import { mountFloatingBall, setFloatingBallTranslationState, unmountFloatingBall } from "@/entrypoints/utils/floatingBall";
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
import { setupContentUiMounting } from "@/entrypoints/content/contentUiMounting";

export default defineContentScript({
    matches: ['<all_urls>'],  // 匹配所有页面
    runAt: 'document_end',  // DOM 解析完成后注册页面能力，扩展 UI 会等待 window.load
    async main() {
        await configReady // 等待配置加载完成
        if (config.on === false) return; // 如果配置关闭，则不执行任何操作
        const inputBoxTranslation = setupInputBoxTranslation({
            config,
            document,
            window,
            runtime: browser.runtime,
            t
        });
        window.addEventListener('beforeunload', inputBoxTranslation.dispose, { once: true });
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
            restoreOriginalContent,
            onPageTranslationStateChange: setFloatingBallTranslationState
        });

        // 等页面 hydration 完成后再向 body 挂载扩展 UI，避免被 Next.js 等框架清理。
        const contentUiMounting = setupContentUiMounting({
            document,
            window,
            mount: () => {
                if (config.disableFloatingBall !== true) {
                    mountFloatingBall();
                }

                if (config.disableSelectionTranslator !== true) {
                    mountSelectionTranslator();
                }

                setupOnboardingWidgets();
            }
        });
        window.addEventListener('beforeunload', contentUiMounting.dispose, { once: true });

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
