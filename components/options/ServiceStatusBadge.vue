<template>
  <span class="status-badge" :class="isConfigured ? 'configured' : 'not-configured'">
    {{ isConfigured ? '✅ 已配置' : '🔑 未配置' }}
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
}

.configured {
  background: #f0f9eb;
  color: #67c23a;
}

.not-configured {
  background: #f4f4f5;
  color: #909399;
}

/* Dark mode */
:root.dark .configured {
  background: #1a3a1a;
}

:root.dark .not-configured {
  background: #2c2c2c;
  color: #6c6c6c;
}
</style>