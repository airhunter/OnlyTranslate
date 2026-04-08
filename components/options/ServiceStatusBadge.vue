<template>
  <span class="status-badge" :class="isConfigured ? 'configured' : 'not-configured'">
    <span class="badge-dot"></span>
    {{ isConfigured ? '已配置' : '未配置' }}
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { servicesType } from '@/entrypoints/utils/option'

const props = defineProps<{
  service: string
}>()

const { config } = useConfig()

const isConfigured = computed(() => {
  const service = props.service
  const conf = config.value

  // Chrome Translator - always configured (no config needed)
  if (service === 'chromeTranslator') {
    return true
  }

  // Microsoft - always configured (uses edge auth by default)
  if (service === 'microsoft') {
    return true
  }

  // Token-based services
  if (servicesType.isUseToken(service)) {
    return !!conf.token?.[service]?.trim()
  }

  // AkSk services (yiyan)
  if (servicesType.isUseAkSk(service)) {
    return !!conf.ak?.trim() && !!conf.sk?.trim()
  }

  // Youdao
  if (servicesType.isYoudao(service)) {
    return !!conf.youdaoAppKey?.trim() && !!conf.youdaoAppSecret?.trim()
  }

  // Tencent
  if (servicesType.isTencent(service)) {
    return !!conf.tencentSecretId?.trim() && !!conf.tencentSecretKey?.trim()
  }

  // DeepLX
  if (service === 'deeplx') {
    return !!conf.deeplx?.trim()
  }

  // Custom
  if (servicesType.isCustom(service)) {
    return !!conf.custom?.trim()
  }

  // NewAPI
  if (servicesType.isNewApi(service)) {
    return !!conf.newApiUrl?.trim()
  }

  // Azure OpenAI
  if (servicesType.isAzureOpenai(service)) {
    return !!conf.azureOpenaiEndpoint?.trim()
  }

  // Coze
  if (servicesType.isCoze(service)) {
    return !!conf.robot_id?.[service]?.trim()
  }

  // Default: check if token exists
  return !!conf.token?.[service]?.trim()
})
</script>

<style scoped>
.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.configured {
  background: var(--fr-badge-configured-bg, #f0f9eb);
  color: var(--el-color-success);
}

.configured .badge-dot {
  background: var(--el-color-success);
}

.not-configured {
  background: var(--fr-badge-not-configured-bg, #f4f4f5);
  color: var(--fr-badge-not-configured-color, #909399);
}

.not-configured .badge-dot {
  background: var(--fr-badge-not-configured-color, #909399);
}
</style>