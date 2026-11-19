import { createApp } from 'vue';
import type { App, ComponentPublicInstance } from 'vue';
import FloatingBall from '@/components/FloatingBall.vue';
import { config } from '@/entrypoints/utils/config';
import browser from 'webextension-polyfill';
import { storage } from '@wxt-dev/storage';
import { resolvePdfDocumentSource } from '@/entrypoints/pdf/url';
import { readPageTranslationStatus, type PageTranslationStatus } from '@/entrypoints/utils/pageTranslationStatus';

type FloatingBallInstance = ComponentPublicInstance & {
  syncTranslationState?: (status: PageTranslationStatus, showWarning?: boolean) => void;
}

let floatingBallInstance: FloatingBallInstance | null = null;
let app: App<Element> | null = null;

export interface FloatingBallTranslationActions {
  togglePageTranslation: (manual: boolean) => void;
}

let translationActions: FloatingBallTranslationActions = {
  togglePageTranslation: () => {
    console.error('Floating ball translation actions are not configured');
  }
};

export function configureFloatingBallTranslationActions(actions: FloatingBallTranslationActions) {
  translationActions = actions;
}

/**
 * 创建并挂载悬浮球
 * @param position 悬浮球位置 'left' | 'right'，如果不传入则使用配置中的值
 * @returns 
 */
export function mountFloatingBall(position?: 'left' | 'right') {
  // 如果配置禁用了悬浮球或已存在实例，则不创建
  if (config.disableFloatingBall || floatingBallInstance) {
    return;
  }

  // 使用传入的位置参数或配置中的位置
  const ballPosition = position || config.floatingBallPosition || 'right';
  const pdfSource = resolvePdfDocumentSource(window.location.href, document.contentType);
  // 更新配置
  config.floatingBallPosition = ballPosition;

  // 创建容器元素
  const container = document.createElement('div');
  container.id = 'only-translate-floating-ball-container';
  // Keep the viewport-fixed control outside body-level transform/filter
  // containing blocks used by some sites for theming or page layout.
  document.documentElement.appendChild(container);

  // 创建 Vue 应用实例
  app = createApp(FloatingBall, {
    position: ballPosition,
    showMenu: true,
    onDocClick: () => {
    },
    onSettingsClick: () => {
      browser.runtime.sendMessage({ type: 'openOptionsPage' });
    },
    pdfSource: pdfSource ?? '',
    onOpenPdf: (source: string) => {
      void browser.runtime.sendMessage({ type: 'openPdfReader', sourceUrl: source });
    },
    onOpenReading: () => {
      void browser.runtime.sendMessage({ type: 'openEbookLibrary' });
    },
    // 添加位置变化事件监听
    onPositionChanged: (newPosition: 'left' | 'right', offsetY: number | null) => {
      // 保存位置到配置
      config.floatingBallPosition = newPosition;
      config.floatingBallOffsetY = offsetY;
      
      // 保存配置到存储
      saveConfig();

    },
    onScopeChanged: (scope: 'smart' | 'full') => {
      config.translationScope = scope;
      saveConfig();
    },
    onServiceChanged: (service: string) => {
      config.service = service;
      saveConfig();
    },
    onTranslationToggle: (manual: boolean) => translationActions.togglePageTranslation(manual),
    offsetY: config.floatingBallOffsetY ?? null
  });

  // 挂载应用
  floatingBallInstance = app.mount(container);
  floatingBallInstance.syncTranslationState?.(readPageTranslationStatus(), false);
  return floatingBallInstance;
}

export function setFloatingBallTranslationState(status: PageTranslationStatus) {
  floatingBallInstance?.syncTranslationState?.(status);
}

/**
 * 保存配置到存储
 */
function saveConfig() {
  // 使用插件提供的存储 API 保存配置
  storage.setItem('local:config', JSON.stringify(config)).catch((error) => {
    console.error('Failed to save config:', error);
  });
}

/**
 * 卸载悬浮球
 */
export function unmountFloatingBall() {
  if (floatingBallInstance && app) {
    // 获取容器
    const container = document.getElementById('only-translate-floating-ball-container');
    
    // 卸载 Vue 应用
    app.unmount();
    floatingBallInstance = null;
    app = null;
    
    // 移除容器
    if (container) {
      container.remove();
    }
  }
}

/**
 * 切换悬浮球可见性
 */
export function toggleFloatingBall() {
  if (floatingBallInstance) {
    unmountFloatingBall();
    config.disableFloatingBall = true;
  } else {
    config.disableFloatingBall = false;
    mountFloatingBall();
  }
  
  // 保存配置到存储
  saveConfig();
}

/**
 * 切换悬浮球位置
 */
export function toggleFloatingBallPosition() {
  const newPosition = config.floatingBallPosition === 'left' ? 'right' : 'left';
  if (floatingBallInstance) {
    unmountFloatingBall();
    config.floatingBallPosition = newPosition;
    mountFloatingBall(newPosition);
  } else {
    config.floatingBallPosition = newPosition;
  }
  
  // 保存配置到存储
  saveConfig();
} 
