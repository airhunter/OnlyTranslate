<template>
  <div class="general-group">
    <!-- 主题设置 -->
    <div class="setting-row">
      <span class="setting-label">主题设置</span>
      <div class="setting-control">
        <el-select v-model="config.theme" placeholder="请选择主题模式">
          <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
    </div>

    <!-- 缓存翻译 -->
    <div class="setting-row">
      <span class="setting-label">
        缓存翻译
        <el-tooltip effect="dark" content="开启缓存可以提高翻译速度，减少重复请求，但可能导致翻译结果不是最新的" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control setting-control--switch">
        <el-switch v-model="config.useCache" />
      </div>
    </div>

    <!-- 翻译并发数 -->
    <div class="setting-row">
      <span class="setting-label">
        翻译并发数
        <el-tooltip effect="dark" content="控制同时进行的最大翻译任务数，数值越高翻译速度越快，但可能占用更多系统资源" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control">
        <el-input-number v-model="config.maxConcurrentTranslations" :min="1" :max="100" :step="1"
          style="width: 100%" @change="handleConcurrentChange" controls-position="right" />
      </div>
    </div>

    <!-- 配置管理 -->
    <div class="config-mgmt">
      <div class="config-mgmt-header">
        <div class="config-mgmt-title">配置管理</div>
        <div class="config-autosave-hint">设置已自动保存</div>
      </div>
      <div class="config-mgmt-btns">
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon>导出配置
        </el-button>
        <el-button type="success" @click="handleImport">
          <el-icon><Upload /></el-icon>导入配置
        </el-button>
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
/* ===== Config management ===== */
.config-mgmt {
  padding: 10px 12px 8px;
  border-top: 1px solid var(--fr-section-title-border);
  margin-top: 4px;
}

.config-mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.config-mgmt-title {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-autosave-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.config-mgmt-btns {
  display: flex;
  gap: 8px;
}

.config-mgmt-btns .el-button {
  flex: 1;
}

/* ===== Select ===== */
.select-left {
  text-align: left;
}
</style>
