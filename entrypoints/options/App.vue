<template>
  <div class="options-root">
    <h1 class="options-title">只译 — 设置</h1>

    <div class="options-layout">
      <!-- Sidebar navigation -->
      <nav class="options-sidebar">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ 'nav-item--active': activePanel === item.key }"
          @click="activePanel = item.key"
        >
          {{ item.label }}
        </button>
      </nav>

      <!-- Content area -->
      <main class="options-content">
        <div class="content-panel">
          <OnboardingCard v-if="activePanel === 'service'" @navigate="handleNavigate" />
          <ServiceGroup v-if="activePanel === 'service'" />
          <AppearanceGroup v-if="activePanel === 'appearance'" />
          <InteractionGroup v-if="activePanel === 'interaction'" />
          <AISettingsGroup v-if="activePanel === 'ai'" />
          <GeneralGroup v-if="activePanel === 'general'" />
        </div>
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useTheme } from '@/composables/useTheme'
import OnboardingCard from '@/components/OnboardingCard.vue'
import ServiceGroup from '@/components/options/ServiceGroup.vue'
import AppearanceGroup from '@/components/options/AppearanceGroup.vue'
import InteractionGroup from '@/components/options/InteractionGroup.vue'
import AISettingsGroup from '@/components/options/AISettingsGroup.vue'
import GeneralGroup from '@/components/options/GeneralGroup.vue'
import '../../styles/theme.css'
import '../../styles/settings-row.css'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const { config, loadConfig } = useConfig()
const { updateTheme } = useTheme(config)
loadConfig().then(() => {
  updateTheme(config.value.theme || 'auto')
})

const activePanel = ref('service')

const navItems = [
  { key: 'service', label: '翻译服务' },
  { key: 'appearance', label: '翻译外观' },
  { key: 'interaction', label: '交互设置' },
  { key: 'ai', label: 'AI 设置' },
  { key: 'general', label: '通用' },
]

const handleNavigate = (panel: string) => {
  activePanel.value = panel
}
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

.options-layout {
  display: flex;
  gap: 0;
  border: none;
  border-radius: 12px;
  overflow: hidden;
  background: var(--fr-bg-color);
  min-height: 600px;
}

/* ===== Sidebar - 极简风格 ===== */
.options-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-right: 1px solid var(--fr-border-color-lighter);
  padding: 12px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin: 2px 8px;
  border: none;
  background: transparent;
  color: var(--fr-text-color-regular);
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  border-radius: 6px;
  position: relative;
}

.nav-item:hover {
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
}

.nav-item--active {
  background: transparent;
  color: var(--fr-accent-color);
  font-weight: 500;
}

.nav-item--active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 16px;
  background: var(--fr-accent-color);
  border-radius: 0 2px 2px 0;
}

.nav-item--active:hover {
  background: transparent;
}


/* ===== Content ===== */
.options-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.content-panel {
  padding: 16px 20px;
}
</style>
