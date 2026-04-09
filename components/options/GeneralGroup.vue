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
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
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
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control">
        <el-input-number v-model="config.maxConcurrentTranslations" :min="1" :max="100" :step="1"
          style="width: 100%" @change="handleConcurrentChange" controls-position="right" />
      </div>
    </div>

    <!-- 代理地址 -->
    <div v-show="showProxy" class="setting-row">
      <span class="setting-label">
        代理地址
        <el-tooltip effect="dark" content="使用代理可以解决网络无法访问的问题，如不熟悉代理设置请留空！" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control">
        <el-input v-model="config.proxy[config.service]" placeholder="默认不使用代理" />
      </div>
    </div>

    <!-- 配置管理 -->
    <div class="config-mgmt">
      <div class="config-mgmt-title">配置管理</div>
      <div class="config-mgmt-btns">
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon>导出配置
        </el-button>
        <el-button type="success" @click="handleImport">
          <el-icon><Upload /></el-icon>导入配置
        </el-button>
      </div>
    </div>

    <!-- 导出配置显示区域 -->
    <div v-if="showExportBox" class="setting-row setting-row--col">
      <el-input v-model="exportData" type="textarea" :rows="6" readonly />
    </div>

    <!-- 导入配置输入区域 -->
    <div v-if="showImportBox" class="setting-row setting-row--col">
      <el-input v-model="importData" type="textarea" :rows="6" placeholder="请在此处粘贴您的JSON配置" />
      <div style="margin-top: 8px; text-align: right;">
        <el-button @click="saveImport">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { options, servicesType, defaultOption } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { ChatDotRound, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storage } from '@wxt-dev/storage'

const { config } = useConfig()

const showProxy = computed(() => servicesType.isUseProxy(config.value.service))

// Export/Import state
const showExportBox = ref(false)
const exportData = ref('')
const showImportBox = ref(false)
const importData = ref('')

// Handle concurrent change
const handleConcurrentChange = (currentValue: number | undefined) => {
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({ message: '并发数量必须在 1-100 之间', type: 'warning', duration: 2000 })
    config.value.maxConcurrentTranslations = 6
    return
  }
  ElMessage({ message: `并发数量已更新为 ${currentValue}`, type: 'success', duration: 2000 })
}

// Export config
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
  exportData.value = JSON.stringify(cleanedConfig, null, 2)
  showExportBox.value = !showExportBox.value
  showImportBox.value = false
}

// Import config
const handleImport = () => {
  showImportBox.value = !showImportBox.value
  showExportBox.value = false
}

const saveImport = async () => {
  try {
    const parsedConfig = JSON.parse(importData.value)
    if (!validateConfig(parsedConfig)) {
      ElMessage({ message: '配置无效或格式不正确, 请检查!', type: 'error' })
      return
    }
    await storage.setItem('local:config', JSON.stringify(parsedConfig))
    ElMessage({ message: '配置导入成功!', type: 'success' })
    showImportBox.value = false
    importData.value = ''
  } catch (e) {
    ElMessage({ message: '配置格式错误, 请检查!', type: 'error' })
  }
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

.config-mgmt-title {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
