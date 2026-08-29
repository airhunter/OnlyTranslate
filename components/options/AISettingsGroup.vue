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
            <div class="prompt-variables" :aria-label="t('options.ai.availableVariables')">
              <span class="prompt-variables-label">{{ t('options.ai.availableVariables') }}</span>
              <el-button
                v-for="item in promptVariables"
                :key="item.variable"
                :data-variable="item.variable"
                size="small"
                plain
                :title="item.description"
                @click="insertVariable(item.variable)"
              >
                {{ item.variable }}
              </el-button>
            </div>
            <div v-if="contextWarning" class="warning-text">{{ contextWarning }}</div>
          </div>
        </div>

        <details class="prompt-preview">
          <summary>{{ t('options.ai.previewTitle') }}</summary>
          <div class="prompt-preview-section">
            <strong>System</strong>
            <pre>{{ promptPreview.system }}</pre>
          </div>
          <div class="prompt-preview-section">
            <strong>User</strong>
            <pre>{{ promptPreview.user }}</pre>
          </div>
        </details>
      </div>
      <!-- 底部控制栏 -->
      <div class="setting-card-footer">
        <el-button type="primary" link @click="resetTemplate">
          <el-icon><Refresh /></el-icon>
          {{ t('options.ai.resetTemplate') }}
        </el-button>
        <el-button data-testid="save-prompts" type="primary" :loading="isSaving" @click="savePrompts">
          {{ t('options.ai.savePrompts') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { defaultOption, servicesType } from '@/entrypoints/utils/option'
import { InfoFilled, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  hasValidTranslationTemplate,
  renderTranslationPrompt,
  usesTranslationContext,
} from '@/entrypoints/utils/translationPrompt'

const { config, saveConfig } = useConfig()
const { t } = useI18n()
const isSaving = ref(false)

const isAIService = computed(() => servicesType.isAI(config.value.service))

const userRoleError = computed(() => {
  const template = config.value.user_role?.[config.value.service] || ''
  if (!template) return null
  return hasValidTranslationTemplate(template)
    ? null
    : t('options.ai.missingVars', { vars: '{{translation_input}} / {{to}} + {{origin}}' })
})

const contextWarning = computed(() => {
  const template = config.value.user_role?.[config.value.service] || ''
  if (!template || !hasValidTranslationTemplate(template) || usesTranslationContext(template)) return null
  return t('options.ai.contextWarning')
})

const promptVariables = computed(() => [
  { variable: '{{translation_input}}', description: t('options.ai.variableTranslationInput') },
  { variable: '{{to}}', description: t('options.ai.variableTo') },
  { variable: '{{origin}}', description: t('options.ai.variableOrigin') },
  { variable: '{{title}}', description: t('options.ai.variableTitle') },
  { variable: '{{context}}', description: t('options.ai.variableContext') },
  { variable: '{{scene}}', description: t('options.ai.variableScene') },
])

const promptPreview = computed(() => renderTranslationPrompt(
  'The bank raised its interest rate.',
  config.value.to || 'zh-Hans',
  {
    scene: 'selection',
    title: t('options.ai.previewSampleTitle'),
    surroundingText: t('options.ai.previewSampleContext'),
  },
  config.value.system_role?.[config.value.service] || defaultOption.system_role,
  config.value.user_role?.[config.value.service] || defaultOption.user_role,
))

const insertVariable = (variable: string) => {
  const current = config.value.user_role?.[config.value.service] || ''
  config.value.user_role[config.value.service] = current
    ? `${current}${current.endsWith('\n') ? '' : '\n'}${variable}`
    : variable
}

const savePrompts = async () => {
  isSaving.value = true
  try {
    await saveConfig()
    ElMessage({ message: t('options.ai.saveSuccess'), type: 'success', duration: 2000 })
  } catch (error) {
    console.error('Failed to save prompt configuration:', error)
    ElMessage({ message: t('options.ai.saveFailed'), type: 'error', duration: 3000 })
  } finally {
    isSaving.value = false
  }
}

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

.warning-text {
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
  margin-top: 6px;
  line-height: 1.4;
}

.prompt-variables {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.prompt-variables-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-right: 2px;
}

.prompt-preview {
  margin: 8px 4px 0;
  border: 1px solid var(--fr-border-color-lighter);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
}

.prompt-preview summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.prompt-preview-section {
  margin-top: 12px;
}

.prompt-preview-section pre {
  margin: 6px 0 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
