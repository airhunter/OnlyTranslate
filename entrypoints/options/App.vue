<template>
  <div class="options-root">
    <h1 class="options-title">只译 — 设置</h1>

    <OnboardingCard />

    <div class="options-groups">
      <!-- Group 1: 翻译服务 -->
      <div class="options-group">
        <div class="group-header">
          <div class="group-indicator"></div>
          <h2 class="group-title">翻译服务</h2>
        </div>
        <div class="group-body">
          <ServiceGroup />
        </div>
      </div>

      <!-- Group 2: 翻译偏好 -->
      <div class="options-group">
        <div class="group-header">
          <div class="group-indicator"></div>
          <h2 class="group-title">翻译偏好</h2>
        </div>
        <div class="group-body">
          <PreferenceGroup />
        </div>
      </div>

      <!-- Group 3: 交互设置 -->
      <div class="options-group">
        <div class="group-header">
          <div class="group-indicator"></div>
          <h2 class="group-title">交互设置</h2>
        </div>
        <div class="group-body">
          <InteractionGroup />
        </div>
      </div>

      <!-- Group 4: 高级 -->
      <div class="options-group">
        <div class="group-header">
          <div class="group-indicator"></div>
          <h2 class="group-title">高级</h2>
        </div>
        <div class="group-body">
          <AdvancedGroup />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useConfig } from '@/composables/useConfig'
import { useTheme } from '@/composables/useTheme'
import OnboardingCard from '@/components/OnboardingCard.vue'
import ServiceGroup from '@/components/options/ServiceGroup.vue'
import PreferenceGroup from '@/components/options/PreferenceGroup.vue'
import InteractionGroup from '@/components/options/InteractionGroup.vue'
import AdvancedGroup from '@/components/options/AdvancedGroup.vue'
import '../../styles/theme.css'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const { config, loadConfig } = useConfig()
const { updateTheme } = useTheme(config)
loadConfig().then(() => {
  updateTheme(config.value.theme || 'auto')
})
</script>

<style scoped>
.options-root {
  min-height: 100vh;
}

.options-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.options-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.options-group {
  border: 1px solid var(--fr-section-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--fr-bg-color);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--fr-section-title-bg);
  border-bottom: 1px solid var(--fr-section-title-border);
}

.group-indicator {
  width: 4px;
  height: 16px;
  background: #5BB5F5;
  border-radius: 2px;
  flex-shrink: 0;
}

.group-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  margin: 0;
}

.group-body {
  padding: 16px;
}

.placeholder {
  color: var(--fr-text-color-regular);
  font-size: 13px;
  opacity: 0.5;
}
</style>