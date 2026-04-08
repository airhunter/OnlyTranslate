<template>

  <!-- ===== Header ===== -->
  <div class="popup-header">
    <div class="header-brand">
      <div class="header-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </svg>
      </div>
      <span class="header-name">只译</span>
      <span class="header-version">v{{ appVersion }}</span>
    </div>
    <div class="header-right">
      <span class="status-text" :class="config.on ? 'status-on' : 'status-off'">
        {{ config.on ? '已启用' : '已禁用' }}
      </span>
      <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
    </div>
  </div>

  <!-- ===== Body ===== -->
  <div class="popup-body">

    <!-- 插件禁用占位 -->
    <div v-if="!config.on" class="disabled-state">
      <el-empty description="插件处于禁用状态" :image-size="60" />
    </div>

    <div v-show="config.on" class="sections-wrapper">

      <!-- Section: 翻译设置 -->
      <div class="section">
        <div class="section-title">翻译设置</div>

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
        <div class="setting-row">
          <span class="setting-label">
            翻译服务
            <el-tooltip effect="dark" content="机器翻译：快速稳定；AI翻译：更自然流畅" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.service" placeholder="请选择翻译服务">
              <el-option class="select-left" v-for="item in filteredServices" :key="item.value"
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
            <el-switch v-model="config.enableVideoSubtitle" inline-prompt active-text="开" inactive-text="关" />
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div class="popup-footer">
    <el-button class="footer-btn cache-btn" :type="cacheBtnType" :loading="cacheLoading"
      :disabled="cacheBtnDisabled" size="small" @click="clearCache">
      {{ cacheBtnText }}
    </el-button>
    <button class="footer-btn settings-link" @click="openSettingsPage">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
      </svg>
      更多设置
    </button>
  </div>

</template>

<script lang="ts" setup>

import { computed, ref } from 'vue'
import { options, servicesType } from "../entrypoints/utils/option";
import { useConfig } from '@/composables/useConfig'
import { ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import browser from 'webextension-polyfill';
import { useTheme } from '@/composables/useTheme';

// 应用版本号
const appVersion = browser.runtime.getManifest().version;

// Config management
const { config, loadConfig } = useConfig()
const { updateTheme } = useTheme(config)
loadConfig().then(() => {
  updateTheme(config.value.theme || 'auto')
})

// 筛选翻译服务列表
const filteredServices = computed(() => options.services.filter((service: any) =>
  !([service.google].includes(service.value) && config.value.display !== 1))
);

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

// ===== Footer: 清除缓存 =====
const cacheBtnDisabled = ref(false);
const cacheBtnText = ref('清除翻译缓存');
const cacheLoading = ref(false);
const cacheStatus = ref<'idle' | 'success' | 'failed'>('idle');

const cacheBtnType = computed(() => {
  if (cacheStatus.value === 'success') return 'success';
  if (cacheStatus.value === 'failed') return 'danger';
  return 'default';
});

async function clearCache() {
  try {
    cacheBtnDisabled.value = true;
    cacheLoading.value = true;
    cacheBtnText.value = '正在清除...';
    cacheStatus.value = 'idle';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('No active tab found');
    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    cacheStatus.value = 'success';
    cacheBtnText.value = '清除成功';
  } catch (error) {
    console.error('清除缓存失败:', error);
    cacheStatus.value = 'failed';
    cacheBtnText.value = '清除失败';
  } finally {
    cacheLoading.value = false;
    setTimeout(() => {
      cacheBtnDisabled.value = false;
      cacheBtnText.value = '清除翻译缓存';
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

/* ===== Header ===== */
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 11px;
  border-bottom: 1px solid var(--fr-header-border);
  background: var(--fr-bg-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 26px;
  height: 26px;
  background: var(--fr-accent-color);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-icon svg {
  width: 15px;
  height: 15px;
}

.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  letter-spacing: 0.3px;
}

.header-version {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  opacity: 0.7;
  margin-top: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
}

.status-on {
  color: var(--el-color-success);
}

.status-off {
  color: #909399;
}

/* ===== Body ===== */
.popup-body {
  padding: 10px 10px 6px;
  overflow-y: auto;
  max-height: 480px;
}

.popup-body::-webkit-scrollbar {
  width: 4px;
}

.popup-body::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 2px;
}

.dark .popup-body::-webkit-scrollbar-thumb {
  background: #333;
}

.disabled-state {
  padding: 20px 0;
}

.sections-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== Section card ===== */
.section {
  border: 1px solid var(--fr-section-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--fr-bg-color);
}

.section-title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--fr-text-color-regular);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 6px 12px 5px;
  background: var(--fr-section-title-bg);
  border-bottom: 1px solid var(--fr-section-title-border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 10px;
  background: var(--fr-accent-color);
  border-radius: 2px;
  flex-shrink: 0;
}

/* ===== Footer ===== */
.popup-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--fr-footer-border);
  background: var(--fr-bg-color);
}

.footer-btn {
  flex: 1;
}

.settings-link {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 12.5px;
  color: var(--fr-accent-color);
  cursor: pointer;
  background: none;
  border: 1px solid #d9ecff;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.settings-link:hover {
  background: #f0f8ff;
  border-color: #b3d8ff;
}

.dark .settings-link {
  border-color: #1a3a55;
}

.dark .settings-link:hover {
  background: #1e2a38;
  border-color: #2a4a6a;
}

/* ===== Select & Input ===== */
.select-left {
  text-align: left;
}

.select-divider {
  background: #f2f6fc;
  color: #409eff;
  font-size: 12px;
  padding: 4px 12px;
  cursor: default;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid #e4e7ed;
  margin: 4px 0;
  pointer-events: none;
  opacity: 0.9;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

</style>
