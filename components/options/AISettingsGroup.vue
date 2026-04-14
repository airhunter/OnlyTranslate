<template>
  <div class="ai-settings-group">
    <!-- 非 AI 服务时的说明提示 -->
    <div v-if="!isAIService" class="ai-notice">
      <el-icon><InfoFilled /></el-icon>
      <span>当前翻译服务不是 AI 服务，以下设置保存后不会生效，切换到 AI 翻译服务后才会应用。</span>
    </div>

    <!-- AI system 提示词 -->
    <div class="setting-row setting-row--col">
      <span class="setting-label">
        system 提示词
        <el-tooltip effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control setting-control--full">
        <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" placeholder="system message" :autosize="{ minRows: 4, maxRows: 12 }" />
      </div>
    </div>

    <!-- AI user 模板 -->
    <div class="setting-row setting-row--col">
      <span class="setting-label">
        user 模板
        <el-tooltip effect="dark" content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control setting-control--full">
        <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" placeholder="user message template" :autosize="{ minRows: 4, maxRows: 12 }" />
        <div v-if="userRoleError" class="error-text">{{ userRoleError }}</div>
      </div>
    </div>

    <!-- 恢复默认模板 -->
    <div class="setting-row" style="justify-content: flex-end;">
      <el-button type="primary" link @click="resetTemplate">
        <el-icon><Refresh /></el-icon>
        恢复默认模板
      </el-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { defaultOption, servicesType } from '@/entrypoints/utils/option'
import { InfoFilled, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { config } = useConfig()

const isAIService = computed(() => servicesType.isAI(config.value.service))

// Validate user_role template contains required variables
const userRoleError = computed(() => {
  const template = config.value.user_role?.[config.value.service] || ''
  if (!template) return null
  const missingVars: string[] = []
  if (!template.includes('{{to}}')) missingVars.push('{{to}}')
  if (!template.includes('{{origin}}')) missingVars.push('{{origin}}')
  if (missingVars.length > 0) {
    return `模板缺少必要变量：${missingVars.join('、')}，翻译将无法正常工作`
  }
  return null
})

// Reset template
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role
    config.value.user_role[config.value.service] = defaultOption.user_role
    ElMessage({ message: '已成功恢复默认翻译模板', type: 'success', duration: 2000 })
  }).catch(() => {})
}
</script>

<style scoped>
.ai-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 4px 12px 0;
  padding: 8px 12px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
  line-height: 1.5;
}

.ai-notice .el-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
