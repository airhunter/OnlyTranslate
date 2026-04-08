<template>
  <div class="ai-settings-group">
    <!-- AI system 提示词 -->
    <div class="setting-row setting-row--col">
      <span class="setting-label">
        system 提示词
        <el-tooltip effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control setting-control--full">
        <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" placeholder="system message" />
      </div>
    </div>

    <!-- AI user 模板 -->
    <div class="setting-row setting-row--col">
      <span class="setting-label">
        user 模板
        <el-tooltip effect="dark" content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control setting-control--full">
        <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" placeholder="user message template" />
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
import { useConfig } from '@/composables/useConfig'
import { defaultOption } from '@/entrypoints/utils/option'
import { ChatDotRound, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { config } = useConfig()

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
