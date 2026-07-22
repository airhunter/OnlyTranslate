<template>
  <div class="general-group">
    <!-- 卡片1：界面外观 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.general.visualTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.general.visualDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">{{ t('options.general.uiLanguage') }}</span>
          <div class="setting-control">
            <el-select v-model="config.uiLocale" :placeholder="t('options.general.uiLanguagePlaceholder')">
              <el-option class="select-left" v-for="item in options.uiLocale" :key="item.value" :label="t(item.labelKey)" :value="item.value" />
            </el-select>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">{{ t('options.general.theme') }}</span>
          <div class="setting-control">
            <el-select v-model="config.theme" :placeholder="t('options.general.themePlaceholder')">
              <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="optionLabel(item)" :value="item.value" />
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片2：性能调度 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.general.performanceTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.general.performanceDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.general.useCache') }}
            <el-tooltip effect="dark" :content="t('options.general.useCacheTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--switch">
            <el-switch v-model="config.useCache" />
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.general.cacheManagement') }}
            <el-tooltip effect="dark" :content="t('options.general.clearCacheTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-button
              class="cache-clear-button"
              :type="cacheButtonType"
              :loading="cacheLoading"
              :disabled="cacheButtonDisabled"
              @click="handleClearCache"
            >
              <el-icon v-if="!cacheLoading"><Delete /></el-icon>
              {{ cacheButtonText }}
            </el-button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.general.concurrency') }}
            <el-tooltip effect="dark" :content="t('options.general.concurrencyTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-input-number v-model="config.maxConcurrentTranslations" :min="1" :max="100" :step="1"
              style="width: 100%" @change="handleConcurrentChange" controls-position="right" />
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片3：本站数据流转 -->
    <div class="setting-card">
      <div class="setting-card-header" style="display: flex; justify-content: space-between;">
        <div>
          <h3 class="setting-card-title">{{ t('options.general.dataTitle') }}</h3>
          <p class="setting-card-desc">{{ t('options.general.dataDesc') }}</p>
        </div>
        <div class="config-autosave-badge">
          <div class="pulse-dot"></div>{{ t('options.general.autosave') }}
        </div>
      </div>
      <div class="setting-card-body">
        <div class="config-mgmt-btns">
          <el-button type="primary" plain @click="handleExport">
            <el-icon><Download /></el-icon>{{ t('options.general.exportConfig') }}
          </el-button>
          <el-button type="success" plain @click="handleImport">
            <el-icon><Upload /></el-icon>{{ t('options.general.importConfig') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { options, defaultOption } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { Delete, InfoFilled, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storage } from '@wxt-dev/storage'
import { useI18n } from 'vue-i18n'
import { clearTranslationCache } from '@/entrypoints/utils/clearTranslationCache'

const { config } = useConfig()
const { t } = useI18n()

type OptionLike = { label: string; labelKey?: string }
const optionLabel = (item: OptionLike) => item.labelKey ? t(item.labelKey) : item.label

const cacheLoading = ref(false)
const cacheButtonDisabled = ref(false)
const cacheStatus = ref<'idle' | 'success' | 'failed'>('idle')
const cacheButtonText = computed(() => {
  if (cacheStatus.value === 'success') return t('common.cleared')
  if (cacheStatus.value === 'failed') return t('common.failed')
  if (cacheLoading.value) return t('common.clearing')
  return t('options.general.clearCacheAction')
})
const cacheButtonType = computed(() => {
  if (cacheStatus.value === 'success') return 'success'
  if (cacheStatus.value === 'failed') return 'danger'
  return 'primary'
})

const handleClearCache = async () => {
  if (cacheButtonDisabled.value) return
  cacheButtonDisabled.value = true
  cacheLoading.value = true
  cacheStatus.value = 'idle'

  try {
    await clearTranslationCache()
    cacheStatus.value = 'success'
    ElMessage.success(t('options.general.cacheCleared'))
  } catch (error) {
    console.error('清除缓存失败:', error)
    cacheStatus.value = 'failed'
    ElMessage.error(t('options.general.cacheClearFailed'))
  } finally {
    cacheLoading.value = false
    setTimeout(() => {
      cacheButtonDisabled.value = false
      cacheStatus.value = 'idle'
    }, 1500)
  }
}

// Handle concurrent change
const handleConcurrentChange = (currentValue: number | undefined) => {
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({ message: t('options.general.concurrencyInvalid'), type: 'warning', duration: 2000 })
    config.value.maxConcurrentTranslations = 6
    return
  }
  ElMessage({ message: t('options.general.concurrencyUpdated', { count: currentValue }), type: 'success', duration: 2000 })
}

// Export config — download as JSON file
const handleExport = async () => {
  const configStr = await storage.getItem('local:config')
  if (!configStr) {
    ElMessage({ message: t('options.general.configNotFound'), type: 'warning' })
    return
  }
  const configToExport = JSON.parse(configStr as string)
  const cleanedConfig = JSON.parse(JSON.stringify(configToExport))
  // Clean default prompts
  if (cleanedConfig.system_role) {
    for (const service in cleanedConfig.system_role) {
      if (cleanedConfig.system_role[service] === defaultOption.system_role) delete cleanedConfig.system_role[service]
    }
    if (Object.keys(cleanedConfig.system_role).length === 0) delete cleanedConfig.system_role
  }
  if (cleanedConfig.user_role) {
    for (const service in cleanedConfig.user_role) {
      if (cleanedConfig.user_role[service] === defaultOption.user_role) delete cleanedConfig.user_role[service]
    }
    if (Object.keys(cleanedConfig.user_role).length === 0) delete cleanedConfig.user_role
  }
  const json = JSON.stringify(cleanedConfig, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'only-translate-config.json'
  a.click()
  URL.revokeObjectURL(url)
  ElMessage({ message: t('options.general.configExported'), type: 'success', duration: 2000 })
}

// Import config — pick a JSON file
const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsedConfig = JSON.parse(text)
      if (!validateConfig(parsedConfig)) {
        ElMessage({ message: t('options.general.configInvalid'), type: 'error' })
        return
      }
      await storage.setItem('local:config', JSON.stringify(parsedConfig))
      ElMessage({ message: t('options.general.configImported'), type: 'success' })
    } catch {
      ElMessage({ message: t('options.general.configParseError'), type: 'error' })
    }
  }
  input.click()
}

// Validate config
const validateConfig = (configData: any): boolean => {
  if (typeof configData !== 'object' || configData === null) return false
  const requiredFields = ['on', 'service', 'display', 'from', 'to']
  for (const field of requiredFields) {
    if (!(field in configData)) return false
  }
  if (typeof configData.service !== 'string') return false
  return true
}
</script>

<style scoped>
/* ===== Card Dashboard Layout ===== */
.general-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  align-items: start;
  padding-top: 8px;
}

.setting-card {
  background: var(--el-bg-color);
  border: 1px solid var(--fr-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.setting-card-header {
  padding: 16px 20px 14px;
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.setting-card-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-card-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.setting-card-body {
  padding: 8px 16px 16px;
}

/* Card inner rows customization */
.general-group :deep(.setting-row) {
  padding: 14px 4px;
  background: transparent !important;
}

.general-group :deep(.setting-row:not(:last-child)) {
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.cache-clear-button {
  min-width: 128px;
}

/* ===== Config management ===== */
.config-autosave-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-color-success);
  font-weight: 600;
  background: var(--el-color-success-light-9);
  padding: 4px 8px;
  border-radius: 6px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--el-color-success);
  box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(103, 194, 58, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(103, 194, 58, 0); }
}

.config-mgmt-btns {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.config-mgmt-btns .el-button {
  width: 100%;
  margin-left: 0;
}
</style>
