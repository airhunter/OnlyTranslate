import { createApp } from 'vue';
import type { App, ComponentPublicInstance } from 'vue';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from 'wxt/utils/content-script-ui/shadow-root';
import SelectionTranslator from '@/components/SelectionTranslator.vue';
import selectionTranslatorStyles from '@/components/SelectionTranslator.css?inline';
import { config } from '@/entrypoints/utils/config';
import { storage } from '@wxt-dev/storage';

const SELECTION_TRANSLATOR_HOST_ID = 'only-translate-selection-translator-container';

interface MountedSelectionTranslator {
  app: App<Element>;
  instance: ComponentPublicInstance;
}

let selectionTranslatorInstance: ComponentPublicInstance | null = null;
let contentScriptContext: ContentScriptContext | null = null;
let selectionTranslatorUi: ShadowRootContentScriptUi<MountedSelectionTranslator> | null = null;
let selectionTranslatorUiPromise: Promise<ShadowRootContentScriptUi<MountedSelectionTranslator>> | null = null;
let shouldBeMounted = false;

export function initializeSelectionTranslator(context: ContentScriptContext) {
  contentScriptContext = context;
}

function canMountSelectionTranslator() {
  return !config.disableSelectionTranslator && config.selectionTranslatorMode !== 'disabled';
}

async function ensureSelectionTranslatorUi() {
  if (selectionTranslatorUi) return selectionTranslatorUi;
  if (selectionTranslatorUiPromise) return selectionTranslatorUiPromise;
  if (!contentScriptContext) {
    throw new Error('Selection translator content script context is not initialized');
  }

  selectionTranslatorUiPromise = createShadowRootUi<MountedSelectionTranslator>(contentScriptContext, {
    name: 'only-translate-selection-translator',
    position: 'overlay',
    anchor: 'body',
    zIndex: 2147483647,
    css: selectionTranslatorStyles,
    isolateEvents: true,
    onMount(container) {
      container.classList.add('notranslate');
      container.setAttribute('translate', 'no');
      const app = createApp(SelectionTranslator);
      const instance = app.mount(container);
      selectionTranslatorInstance = instance;
      return { app, instance };
    },
    onRemove(mounted) {
      mounted?.app.unmount();
      if (selectionTranslatorInstance === mounted?.instance) {
        selectionTranslatorInstance = null;
      }
    },
  }).then(ui => {
    ui.shadowHost.id = SELECTION_TRANSLATOR_HOST_ID;
    ui.shadowHost.classList.add('notranslate');
    ui.shadowHost.setAttribute('translate', 'no');
    selectionTranslatorUi = ui;
    return ui;
  }).finally(() => {
    selectionTranslatorUiPromise = null;
  });

  return selectionTranslatorUiPromise;
}

/**
 * 挂载选词翻译组件
 */
export async function mountSelectionTranslator() {
  // 如果已存在实例或配置禁用了此功能，则不创建
  if (!canMountSelectionTranslator()) {
    shouldBeMounted = false;
    return null;
  }

  shouldBeMounted = true;
  if (selectionTranslatorInstance) return selectionTranslatorInstance;

  try {
    const ui = await ensureSelectionTranslatorUi();
    if (!shouldBeMounted || !canMountSelectionTranslator()) return null;

    if (!ui.mounted) {
      ui.mount();
    }

    return selectionTranslatorInstance;
  } catch (error) {
    console.error('Failed to mount selection translator:', error);
    return null;
  }
}

/**
 * 卸载选词翻译组件
 */
export function unmountSelectionTranslator() {
  shouldBeMounted = false;
  if (selectionTranslatorUi?.mounted) {
    selectionTranslatorUi.remove();
  }
  selectionTranslatorInstance = null;
}

/**
 * 切换选词翻译组件的启用状态
 */
export function toggleSelectionTranslator() {
  if (shouldBeMounted || selectionTranslatorInstance) {
    unmountSelectionTranslator();
    config.disableSelectionTranslator = true;
  } else {
    config.disableSelectionTranslator = false;
    void mountSelectionTranslator();
  }
  
  // 保存配置到存储
  saveConfig();
}

/**
 * 保存配置到存储
 */
function saveConfig() {
  // 使用插件提供的存储API保存配置
  storage.setItem('local:config', JSON.stringify(config)).catch((error) => {
    console.error('Failed to save config:', error);
  });
} 
