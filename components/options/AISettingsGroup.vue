<template>
  <div class="ai-settings-group">
    <!-- 警告卡片：非 AI 服务时的说明提示 -->
    <div v-if="!isAIService" class="setting-card setting-card--warning">
      <div class="setting-card-body ai-notice-card">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ t('options.ai.nonAiNotice') }}</span>
      </div>
    </div>

    <!-- 高级开发提示词卡片 -->
    <div class="setting-card setting-card--full">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.ai.promptTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.ai.promptDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <!-- AI system 提示词 -->
        <div class="setting-row setting-row--col">
          <span class="setting-label">
            {{ t('options.ai.systemPrompt') }}
            <el-tooltip effect="dark" :content="t('options.ai.systemPromptTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--full">
            <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" :placeholder="t('options.ai.systemPlaceholder')" :autosize="{ minRows: 4, maxRows: 12 }" />
          </div>
        </div>

        <!-- AI user 模板 -->
        <div class="setting-row setting-row--col">
          <span class="setting-label">
            {{ t('options.ai.userTemplate') }}
            <el-tooltip effect="dark" :content="t('options.ai.userTemplateTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--full">
            <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" :placeholder="t('options.ai.userPlaceholder')" :autosize="{ minRows: 4, maxRows: 12 }" />
            <div v-if="userRoleError" class="error-text">{{ userRoleError }}</div>
          </div>
        </div>
      </div>
      <!-- 底部控制栏 -->
      <div class="setting-card-footer">
        <el-button type="primary" link @click="resetTemplate">
          <el-icon><Refresh /></el-icon>
          {{ t('options.ai.resetTemplate') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { defaultOption, servicesType } from '@/entrypoints/utils/option'
import { InfoFilled, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { config } = useConfig()
const { t } = useI18n()

const isAIService = computed(() => servicesType.isAI(config.value.service))

// Validate user_role template contains required variables
const userRoleError = computed(() => {
  const template = config.value.user_role?.[config.value.service] || ''
  if (!template) return null
  const missingVars: string[] = []
  if (!template.includes('{{to}}')) missingVars.push('{{to}}')
  if (!template.includes('{{origin}}')) missingVars.push('{{origin}}')
  if (missingVars.length > 0) {
    return t('options.ai.missingVars', { vars: missingVars.join('、') })
  }
  return null
})

// Reset template
const resetTemplate = () => {
  ElMessageBox.confirm(
    t('options.ai.resetConfirm'),
    t('options.ai.resetTitle'),
    { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role
    config.value.user_role[config.value.service] = defaultOption.user_role
    ElMessage({ message: t('options.ai.resetSuccess'), type: 'success', duration: 2000 })
  }).catch(() => {})
}
</script>

<style scoped>
/* ===== Card Dashboard Layout ===== */
.ai-settings-group {
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

.setting-card--full {
  grid-column: 1 / -1;
}

.setting-card--warning {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  grid-column: 1 / -1;
}

.ai-notice-card {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
  padding: 14px 20px !important;
}

.ai-notice-card .el-icon {
  font-size: 16px;
  color: var(--el-color-warning);
}

.setting-card:hover:not(.setting-card--warning) {
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

.setting-card-footer {
  padding: 12px 20px;
  background: var(--el-fill-color-extra-light);
  border-top: 1px solid var(--fr-border-color-lighter);
  display: flex;
  justify-content: flex-end;
}

/* Card inner rows customization */
.ai-settings-group :deep(.setting-row) {
  padding: 14px 4px;
  background: transparent !important;
}

.ai-settings-group :deep(.setting-row:not(:last-child)) {
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 6px;
  line-height: 1.4;
}
</style>
