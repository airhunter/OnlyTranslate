<template>
  <div class="general-group">
    <!-- 卡片1：界面外观 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">🌗 视觉呈现</h3>
        <p class="setting-card-desc">调整扩展面板和翻译气泡的明暗色彩流</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">颜色首选项</span>
          <div class="setting-control">
            <el-select v-model="config.theme" placeholder="请选择主题模式">
              <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片2：性能调度 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">🚀 性能与调度</h3>
        <p class="setting-card-desc">配置网络请求缓存并管理并发任务极限</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">
            启用本地缓存
            <el-tooltip effect="dark" content="开启缓存可以跨会话暂存相同的翻译请求，极大提升速度，但改变配置后旧有内容可能仍读旧档" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--switch">
            <el-switch v-model="config.useCache" />
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">
            渲染并发请求池
            <el-tooltip effect="dark" content="网页全文翻译时同时请求网络的最大片段数。增大可跑满宽带，但可能触发高频封控" placement="top-start" :show-after="500">
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
          <h3 class="setting-card-title">📦 本地数据管理</h3>
          <p class="setting-card-desc">导出此扩展的所有数据凭据或迁移至新设备</p>
        </div>
        <div class="config-autosave-badge">
          <div class="pulse-dot"></div>自动保存
        </div>
      </div>
      <div class="setting-card-body">
        <div class="config-mgmt-btns">
          <el-button type="primary" plain @click="handleExport">
            <el-icon><Download /></el-icon>导出完整配置 JSON
          </el-button>
          <el-button type="success" plain @click="handleImport">
            <el-icon><Upload /></el-icon>从备份恢复文件
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { options, defaultOption } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { InfoFilled, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storage } from '@wxt-dev/storage'

const { config } = useConfig()

// Handle concurrent change
const handleConcurrentChange = (currentValue: number | undefined) => {
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({ message: '并发数量必须在 1-100 之间', type: 'warning', duration: 2000 })
    config.value.maxConcurrentTranslations = 6
    return
  }
  ElMessage({ message: `并发数量已更新为 ${currentValue}`, type: 'success', duration: 2000 })
}

// Export config — download as JSON file
const handleExport = async () => {
  const configStr = await storage.getItem('local:config')
  if (!configStr) {
    ElMessage({ message: '没有找到配置信息', type: 'warning' })
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
  ElMessage({ message: '配置已导出', type: 'success', duration: 2000 })
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
        ElMessage({ message: '配置无效或格式不正确, 请检查!', type: 'error' })
        return
      }
      await storage.setItem('local:config', JSON.stringify(parsedConfig))
      ElMessage({ message: '配置导入成功，请刷新页面使配置生效!', type: 'success' })
    } catch {
      ElMessage({ message: '配置格式错误, 请检查!', type: 'error' })
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
