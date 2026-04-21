<template>
  <span class="status-badge" :class="isConfigured ? 'configured' : 'not-configured'">
    <span class="badge-dot"></span>
    {{ isConfigured ? '已配置' : '未配置' }}
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { isServiceConfigured } from '@/entrypoints/utils/option'

const props = defineProps<{
  service: string
}>()

const { config } = useConfig()

const isConfigured = computed(() => isServiceConfigured(props.service, config.value))
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
