import {_service} from "@/entrypoints/service/_service";
import {config} from "@/entrypoints/utils/config";
import {CONTEXT_MENU_IDS} from "@/entrypoints/utils/constant";
import {services, servicesType} from "@/entrypoints/utils/option";
import {syncReleaseNotesInstallState} from "@/entrypoints/utils/releaseNotes";
import {t} from "@/entrypoints/utils/i18n";
import {
    checkChromeTranslationAvailability,
    preloadChromeTranslationModel
} from "@/entrypoints/service/chrome-translator";
import { isSubtitleBatchTranslationMessage } from '@/entrypoints/service/subtitle'
import {
    clearVideoSubtitleCache,
    pruneVideoSubtitleCache,
    videoSubtitleCacheInternals,
} from '@/entrypoints/video/cache'
import { VideoSubtitleCacheMaintenance } from '@/entrypoints/video/cacheMaintenance'
import { translateInputWithCurrentService } from '@/entrypoints/service/inputTranslation'
import { getCustomProviderProtocol } from '@/entrypoints/utils/providerEndpoint'
import { buildUninstallFeedbackUrl } from '@/entrypoints/utils/uninstallFeedback'

// 翻译状态管理
let translationStateMap = new Map<number, boolean>(); // tabId -> isTranslated

function isTranslationMessage(message: any): boolean {
    if (typeof message?.origin === 'string' && message.origin.trim().length > 0) return true;
    if (isSubtitleBatchTranslationMessage(message)) return true;
    return message?.type === 'BATCH_TRANSLATION'
        && Array.isArray(message.origins)
        && message.origins.length > 0
        && message.origins.every((origin: unknown) => typeof origin === 'string' && origin.trim().length > 0);
}

export default defineBackground({
    persistent: {
        safari: false,
    },
    main() {
        const isContextMenuSupported = !!browser.contextMenus
        const configureUninstallFeedback = () => {
            if (typeof browser.runtime.setUninstallURL !== 'function') return

            const uninstallUrl = buildUninstallFeedbackUrl(
                browser.runtime.getManifest().version,
                browser.i18n.getUILanguage(),
            )
            void browser.runtime.setUninstallURL(uninstallUrl).catch((error: unknown) => {
                console.warn('设置卸载反馈页面失败:', error)
            })
        }
        const videoSubtitleCacheMaintenance = new VideoSubtitleCacheMaintenance({
            alarms: browser.alarms,
            prune: () => pruneVideoSubtitleCache(),
            cacheKeyPrefix: videoSubtitleCacheInternals.cacheKeyPrefix,
            onError: error => console.warn('Video subtitle cache maintenance failed:', error),
        })

        browser.alarms.onAlarm.addListener((alarm: { name: string }) => {
            void videoSubtitleCacheMaintenance.handleAlarm(alarm.name)
        })
        browser.storage.onChanged.addListener((
            changes: Record<string, { newValue?: unknown }>,
            areaName: string,
        ) => {
            videoSubtitleCacheMaintenance.handleStorageChanges(changes, areaName)
        })
        void videoSubtitleCacheMaintenance.runNow()
        configureUninstallFeedback()

        browser.runtime.onInstalled.addListener((details: any) => {
            configureUninstallFeedback()
            void syncReleaseNotesInstallState(
                details?.reason,
                browser.runtime.getManifest().version
            ).catch((error) => {
                console.error('同步更新说明状态失败:', error);
            });
        });

        // 创建右键菜单项
        if (isContextMenuSupported) {
            try {
                // 创建父菜单
                browser.contextMenus.create({
                    id: 'onlytranslate-parent',
                    title: t('common.appName'),
                    contexts: ['page', 'selection'],
                });

                // 创建全文翻译子菜单
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE,
                    title: t('contextMenu.translateFullPage'),
                    parentId: 'onlytranslate-parent',
                    contexts: ['page', 'selection'],
                });

                // 创建撤销翻译子菜单
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.RESTORE_ORIGINAL,
                    title: t('contextMenu.restoreOriginal'),
                    parentId: 'onlytranslate-parent',
                    contexts: ['page', 'selection'],
                    enabled: false, // 初始状态为禁用
                });

                // 监听右键菜单点击事件
                browser.contextMenus.onClicked.addListener((info: any, tab: any) => {
                    if (!tab?.id) return;

                    if (info.menuItemId === CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE) {
                        // 发送消息到内容脚本触发全文翻译
                        browser.tabs.sendMessage(tab.id, {
                            type: 'contextMenuTranslate',
                            action: 'fullPage'
                        }).then(() => {
                            // 更新翻译状态
                            translationStateMap.set(tab.id!, true);
                            updateContextMenus(tab.id!);
                        }).catch((error: any) => {
                            console.error('Failed to send message to content script:', error);
                        });
                    } else if (info.menuItemId === CONTEXT_MENU_IDS.RESTORE_ORIGINAL) {
                        // 发送消息到内容脚本撤销翻译
                        browser.tabs.sendMessage(tab.id, {
                            type: 'contextMenuTranslate',
                            action: 'restore'
                        }).then(() => {
                            // 更新翻译状态
                            translationStateMap.set(tab.id!, false);
                            updateContextMenus(tab.id!);
                        }).catch((error: any) => {
                            console.error('Failed to send message to content script:', error);
                        });
                    }
                });

            } catch (error) {
                console.error('Error setting up context menu:', error);
            }
        } else {
            console.log("不支持右键菜单")
        }

        // 更新右键菜单状态
        const updateContextMenus = (tabId: number) => {
            const isTranslated = translationStateMap.get(tabId) || false;

            try {
                // 更新全文翻译菜单项
                browser.contextMenus.update(CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE, {
                    enabled: !isTranslated,
                    title: isTranslated
                        ? `${t('contextMenu.translateFullPage')} (${t('contextMenu.translated')})`
                        : t('contextMenu.translateFullPage')
                });
                // 更新撤销翻译菜单项
                browser.contextMenus.update(CONTEXT_MENU_IDS.RESTORE_ORIGINAL, {
                    enabled: isTranslated,
                    title: isTranslated
                        ? t('contextMenu.restoreOriginal')
                        : `${t('contextMenu.restoreOriginal')} (${t('contextMenu.notTranslated')})`
                });
            } catch (error) {
                console.error('Failed to update context menus:', error);
            }
        };

        // 监听标签页切换事件，更新菜单状态
        browser.tabs.onActivated.addListener((activeInfo: any) => {
            if (isContextMenuSupported) updateContextMenus(activeInfo.tabId);
        });

        // 监听标签页更新事件（页面刷新等）
        browser.tabs.onUpdated.addListener((tabId: any, changeInfo: any) => {
            if (changeInfo.status === 'complete') {
                // 页面加载完成，重置翻译状态
                translationStateMap.set(tabId, false);
                if (isContextMenuSupported) updateContextMenus(tabId);
            }
        });

        // 监听标签页关闭事件，清理状态
        browser.tabs.onRemoved.addListener((tabId: any) => {
            translationStateMap.delete(tabId);
        });

        // 处理翻译请求
        browser.runtime.onMessage.addListener((message: any) => {
            if (message?.type === 'CLEAR_VIDEO_SUBTITLE_CACHE') {
                return clearVideoSubtitleCache()
                    .then(removed => ({ success: true, removed }))
                    .catch((error: unknown) => ({
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                    }));
            }

            // 处理输入框翻译请求
            if (message?.type === 'inputBoxTranslation') {
                return translateInputWithCurrentService({
                    text: message.text,
                    targetLang: message.targetLang,
                    context: message.context,
                })
                    .then(translatedText => ({ success: true, translatedText }))
                    .catch(error => ({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }

            // 处理 Chrome AI 翻译可用性检查
            if (message?.type === 'CHROME_AI_CHECK_AVAILABILITY') {
                return checkChromeTranslationAvailability(
                    message.sourceLang || 'en',
                    message.targetLang || 'zh-Hans'
                );
            }

            // 处理 Chrome AI 翻译预下载
            if (message?.type === 'CHROME_AI_PRELOAD_MODEL') {
                return preloadChromeTranslationModel(
                    message.sourceLang || 'en',
                    message.targetLang || 'zh-Hans',
                    (progress) => {
                        // 发送进度更新到 options 页面
                        browser.runtime.sendMessage({
                            type: 'CHROME_AI_PRELOAD_PROGRESS',
                            sourceLang: message.sourceLang || 'en',
                            targetLang: message.targetLang || 'zh-Hans',
                            progress
                        }).catch(() => {}); // 忽略发送错误
                    }
                );
            }

            if (message?.type === 'openOptionsPage') {
                return browser.runtime.openOptionsPage()
                    .then(() => ({ success: true }))
                    .catch((error: unknown) => ({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }

            // 不是翻译消息的 runtime 通信不应进入翻译服务，避免空原文触发 AI 幻觉。
            if (!isTranslationMessage(message)) {
                return undefined;
            }

            // 处理普通翻译请求
            const customProvider = servicesType.isCustom(config.service)
                ? config.customProviders?.find(provider => provider.id === config.service)
                : undefined
            const handlerKey = customProvider && getCustomProviderProtocol(customProvider) === 'anthropic'
                ? services.claude
                : servicesType.isCustom(config.service)
                    ? services.openai
                    : config.service
            const serviceHandler = _service[handlerKey];

            if (!serviceHandler) {
                return Promise.reject(new Error(`Unsupported translation service: ${config.service}`));
            }

            return serviceHandler(message);
        });
    }
});
