<template>

  <div class="popup-header">
    <div class="header-brand">
      <el-tooltip effect="dark" :content="'v' + appVersion" placement="bottom">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
          </svg>
        </div>
      </el-tooltip>
      <span class="header-name">只译</span>
    </div>
    <div class="header-right">
      <span class="status-text">{{ config.on ? '已启用' : '已禁用' }}</span>
      <el-switch v-model="config.on" @change="handlePluginStateChange" />
    </div>
  </div>

  <!-- ===== Body ===== -->
  <div class="popup-body">

    <!-- 插件禁用占位 -->
    <div v-if="!config.on" class="disabled-state">
      <el-empty description="插件已禁用" :image-size="60" />
    </div>

    <div v-show="config.on">

      <!-- 翻译当前页面按钮 -->
      <button class="translate-page-btn" :disabled="translating" @click="translateCurrentPage">
        <svg class="translate-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </svg>
        <span>{{ translating ? '翻译中...' : '翻译当前页面' }}</span>
      </button>

      <!-- 翻译模式 -->
      <div class="setting-row">
        <span class="setting-label">翻译模式</span>
        <div class="setting-control">
          <el-select v-model="config.display" placeholder="请选择翻译模式">
            <el-option class="select-left" v-for="item in options.display" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>

      <!-- 翻译服务 -->
      <div class="setting-row setting-row--tall">
        <span class="setting-label setting-label--with-action">
          <div class="label-inner">
            翻译服务
            <el-tooltip effect="dark" content="机器翻译：快速稳定；AI翻译：更自然流畅" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </div>
          <button class="more-services-link" @click="openSettingsPage">添加服务 ▸</button>
        </span>
        <div class="setting-control">
          <el-select v-model="config.service" placeholder="请选择翻译服务" class="service-select">
            <el-option class="select-left" v-for="item in availableServices" :key="item.value"
              :label="item.label" :value="item.value" :disabled="item.disabled"
              :class="{ 'select-divider': item.disabled }" />
          </el-select>
        </div>
      </div>

      <!-- 视频字幕翻译 -->
      <div class="setting-row">
        <span class="setting-label">
          视频字幕
          <el-tooltip effect="dark" content="在 YouTube 等平台上开启字幕后自动翻译" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control setting-control--switch">
          <el-switch v-model="config.enableVideoSubtitle" />
        </div>
      </div>

      <!-- 划词翻译 -->
      <div class="setting-row">
        <span class="setting-label">划词翻译</span>
        <div class="setting-control setting-control--switch">
          <el-switch 
            :model-value="config.selectionTranslatorMode !== 'disabled'" 
            @update:model-value="toggleSelectionTranslator"
          />
        </div>
      </div>

    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div class="popup-footer">
    <!-- 快捷键提示行 -->
    <div v-if="shortcuts.length" class="footer-shortcuts">
      <div v-for="s in shortcuts" :key="s.key" class="shortcut-row">
        <span class="shortcut-key">{{ s.key }}</span>
        <span class="shortcut-desc">{{ s.desc }}</span>
      </div>
    </div>
    <!-- 操作按钮行 -->
    <div class="footer-actions">
      <button class="text-link cache-link" :class="{ 'is-loading': cacheLoading, 'is-success': cacheStatus === 'success', 'is-failed': cacheStatus === 'failed' }"
        :disabled="cacheBtnDisabled" @click="clearCache">
        {{ cacheBtnText }}
      </button>
      <button class="text-link settings-link" @click="openSettingsPage">
        设置
      </button>
    </div>
  </div>

</template>

<script lang="ts" setup>

import { computed, ref } from 'vue'
import { options, isServiceConfigured } from "../entrypoints/utils/option";
import { useConfig } from '@/composables/useConfig'
import { ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import browser from 'webextension-polyfill';
import { useTheme } from '@/composables/useTheme';


// Config management
const { config, loadConfig } = useConfig()
const { updateTheme } = useTheme(config)
loadConfig().then(() => {
  updateTheme(config.value.theme || 'auto')
})

// 应用版本号
const appVersion = browser.runtime.getManifest().version;

// 筛选翻译服务列表 - 只显示已配置的服务
const availableServices = computed(() => {
  type ServiceOption = { value: string; label: string; disabled?: boolean };
  const result: ServiceOption[] = [];
  let currentGroupHeader: ServiceOption | null = null;
  let currentGroupItems: ServiceOption[] = [];

  for (const item of options.services) {
    if (item.disabled) {
      // This is a group header - save it and reset the group items
      if (currentGroupHeader && currentGroupItems.length > 0) {
        result.push(currentGroupHeader);
        result.push(...currentGroupItems);
      }
      currentGroupHeader = item;
      currentGroupItems = [];
    } else {
      // This is a regular service - check if it's configured
      // Also apply the existing Google filter based on display mode
      const isGoogleDisplayFilter = item.value === 'google' && config.value.display !== 1;
      if (!isGoogleDisplayFilter && isServiceConfigured(item.value, config.value)) {
        currentGroupItems.push(item);
      }
    }
  }

  // Add the last group if it has items
  if (currentGroupHeader && currentGroupItems.length > 0) {
    result.push(currentGroupHeader);
    result.push(...currentGroupItems);
  }

  return result;
});

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被开启，恢复悬浮球为启用状态
  if (val) {
    config.value.disableFloatingBall = false;
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'toggleFloatingBall',
            isEnabled: true
          }).catch(() => {});
        }
      });
    });
    return;
  }

  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {});
          }
        });
      });
    }

    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {});
          }
        });
      });
    }
  }
};

// 划词翻译开关
const toggleSelectionTranslator = (val: boolean) => {
  config.value.selectionTranslatorMode = val ? 'bilingual' : 'disabled'
}

// ===== Footer: 快捷键显示 =====
const shortcuts = computed(() => {
  const list: { key: string; desc: string }[] = [];
  
  // 处理悬浮球快捷键 (全页翻译)
  let floatingKey = config.value.floatingBallHotkey;
  if (floatingKey === 'custom' && config.value.customFloatingBallHotkey) {
    floatingKey = config.value.customFloatingBallHotkey;
  }
  if (floatingKey && floatingKey !== 'none') {
    list.push({ key: floatingKey, desc: '全页翻译' });
  }
  
  // 处理悬浮翻译快捷键
  let hoverKey = config.value.hotkey;
  if (hoverKey === 'custom' && config.value.customHotkey) {
    hoverKey = config.value.customHotkey;
  }
  if (hoverKey && hoverKey !== 'none') {
    list.push({ key: hoverKey, desc: '划词即时翻译' });
  }
  
  return list;
});

// ===== Footer: 清除缓存 =====
const cacheBtnDisabled = ref(false);
const cacheBtnText = ref('清空缓存');
const cacheLoading = ref(false);
const cacheStatus = ref<'idle' | 'success' | 'failed'>('idle');

// ===== Body: 翻译当前页面 =====
const translating = ref(false);

async function translateCurrentPage() {
  try {
    translating.value = true;
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      ElMessage.error('未找到活动标签页');
      return;
    }
    await browser.tabs.sendMessage(tabs[0].id, {
      type: 'contextMenuTranslate',
      action: 'fullPage'
    });
  } catch (error) {
    console.error('翻译失败:', error);
    ElMessage.error('翻译失败');
  } finally {
    translating.value = false;
  }
}

const cacheBtnType = computed(() => {
  if (cacheStatus.value === 'success') return 'success';
  if (cacheStatus.value === 'failed') return 'danger';
  return 'default';
});

async function clearCache() {
  try {
    cacheBtnDisabled.value = true;
    cacheLoading.value = true;
    cacheBtnText.value = '清除中...';
    cacheStatus.value = 'idle';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('No active tab found');
    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    cacheStatus.value = 'success';
    cacheBtnText.value = '已清除';
  } catch (error) {
    console.error('清除缓存失败:', error);
    cacheStatus.value = 'failed';
    cacheBtnText.value = '失败';
  } finally {
    cacheLoading.value = false;
    setTimeout(() => {
      cacheBtnDisabled.value = false;
      cacheBtnText.value = '清空缓存';
      cacheStatus.value = 'idle';
    }, 1500);
  }
}

// ===== Footer: 打开设置页 =====
function openSettingsPage() {
  browser.runtime.openOptionsPage()
}

</script>

<style scoped>

/* ===== Header - Minimalist Enterprise Style ===== */
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--fr-bg-color);
  border-bottom: 1px solid var(--fr-border-color-lighter);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 28px;
  height: 28px;
  background: var(--fr-hover-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.header-icon svg {
  width: 16px;
  height: 16px;
  color: var(--fr-text-color-primary);
}

.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  letter-spacing: 0.5px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--fr-text-color-regular);
}

/* ===== Body ===== */
.popup-body {
  padding: 16px 20px 10px;
  overflow-y: auto;
  max-height: 480px;
  background: var(--fr-bg-color);
}

.popup-body::-webkit-scrollbar {
  width: 4px;
}

.popup-body::-webkit-scrollbar-thumb {
  background: var(--fr-border-color);
  border-radius: 2px;
}

.disabled-state {
  padding: 32px 0;
}

/* ===== Translate Page Button - Solid Minimal Style ===== */
.translate-page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  width: 100%;
  padding: 0 20px;
  margin: 0 0 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  background: var(--fr-accent-color);
  border: 1px solid transparent;
  color: #ffffff;
  transition: all 0.2s ease;
}

.translate-page-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.dark .translate-page-btn:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.translate-page-btn:active {
  transform: translateY(0);
}

.translate-page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.translate-icon {
  width: 16px;
  height: 16px;
}

/* ===== Setting Row Overrides ===== */
:deep(.setting-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  min-height: 44px;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

:deep(.setting-row--tall) {
  align-items: flex-start;
  padding: 14px 0 12px;
}

:deep(.setting-label) {
  font-size: 13px;
  color: var(--fr-text-color-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.setting-label--with-action) {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

:deep(.label-inner) {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.setting-row:last-child) {
  border-bottom: none;
}

:deep(.setting-control) {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

:deep(.setting-control--switch) {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

/* Smaller el-switch */
:deep(.el-switch) {
  --el-switch-height: 20px;
  --el-switch-core-width: 36px;
}

/* ===== Select Styling - Unified Width ===== */
:deep(.setting-control .el-select) {
  width: 176px !important;
}

.service-select {
  flex: 1;
}

.more-services-link {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;
  white-space: nowrap;
}

.more-services-link:hover {
  color: var(--fr-text-color-primary);
}

.dark .more-services-link {
  color: var(--fr-accent-color);
}

/* ===== Footer ===== */
.popup-footer {
  display: flex;
  flex-direction: column;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--fr-border-color-lighter);
  background: var(--fr-bg-color);
  gap: 12px;
}

.footer-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.shortcut-key {
  min-width: 56px;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 600;
  font-size: 11px;
  color: var(--fr-text-color-primary);
  text-align: center;
  background: var(--fr-hover-color);
  border-radius: 4px;
}

.shortcut-desc {
  color: var(--fr-text-color-regular);
}

.footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 0;
}

.text-link {
  font-size: 12px;
  color: var(--fr-text-color-regular);
  cursor: pointer;
  background: var(--fr-hover-color);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 14px;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s ease;
}

.text-link:hover {
  color: var(--fr-text-color-primary);
  background: var(--fr-border-color-lighter);
  border-color: var(--fr-border-color);
}

.text-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-link.is-success {
  color: var(--el-color-success);
}

.text-link.is-failed {
  color: var(--el-color-danger);
}

.cache-link.is-loading {
  opacity: 0.7;
}

/* ===== Select & Input ===== */
.select-left {
  text-align: left;
}

/* ===== Select Divider ===== */
.select-divider {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  padding: 6px 12px 4px;
  cursor: default;
  font-weight: 500;
  pointer-events: none;
  opacity: 0.7;
  background: transparent;
  border-bottom: none;
  margin: 0;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--fr-border-color);
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

</style>