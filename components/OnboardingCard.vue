<template>
  <div v-if="!dismissed" class="onboarding-card">
    <button class="onboarding-close" @click="dismiss">×</button>
    <div class="onboarding-header">
      <span class="onboarding-icon">
        <el-icon><ChatDotRound /></el-icon>
      </span>
      <h3 class="onboarding-title">欢迎使用「只译」</h3>
    </div>
    <p class="onboarding-desc">
      只译是一款专注翻译的浏览器插件。开始使用前，请先选择并配置一个翻译服务。
    </p>
    <div class="onboarding-services">
      <p class="onboarding-services-label">推荐服务：</p>
      <div class="onboarding-service-list">
        <div class="onboarding-service-item" @click="selectService('siliconCloud')">
          <span class="service-name">硅基流动</span>
          <span class="service-desc">免费额度，开箱即用</span>
        </div>
        <div class="onboarding-service-item" @click="selectService('deepseek')">
          <span class="service-name">DeepSeek</span>
          <span class="service-desc">高性价比 AI 翻译</span>
        </div>
        <div class="onboarding-service-item" @click="selectService('chromeTranslator')">
          <span class="service-name">Chrome 内置 AI</span>
          <span class="service-desc">无需配置，完全免费</span>
        </div>
      </div>
    </div>
    <button class="onboarding-dismiss" @click="dismiss">知道了，不再显示</button>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { storage } from '@wxt-dev/storage'
import { useConfig } from '@/composables/useConfig'

const { config } = useConfig()
const dismissed = ref(false)

onMounted(async () => {
  const val = await storage.getItem('local:onboardingDismissed')
  if (val === true || val === 'true') {
    dismissed.value = true
  }
})

const dismiss = async () => {
  dismissed.value = true
  await storage.setItem('local:onboardingDismissed', true)
}

const emit = defineEmits<{
  (e: 'navigate', panel: string): void
}>()

const selectService = (service: string) => {
  config.value.service = service
  emit('navigate', 'service')
}
</script>

<style scoped>
.onboarding-card {
  position: relative;
  background: var(--fr-bg-color);
  border: 1px solid var(--fr-border-color);
  border-left: 4px solid var(--fr-accent-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.onboarding-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--fr-text-color-regular);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.onboarding-close:hover {
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
}

.onboarding-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.onboarding-icon {
  font-size: 20px;
  color: var(--fr-accent-color);
}

.onboarding-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  margin: 0;
}

.onboarding-desc {
  font-size: 13px;
  color: var(--fr-text-color-regular);
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.onboarding-services {
  margin-bottom: 16px;
}

.onboarding-services-label {
  font-size: 13px;
  color: var(--fr-text-color-regular);
  margin: 0 0 10px 0;
  font-weight: 500;
}

.onboarding-service-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.onboarding-service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--fr-hover-color);
  border: 1px solid var(--fr-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.onboarding-service-item:hover {
  background: var(--fr-bg-color);
  border-color: var(--fr-accent-color);
}

.service-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fr-text-color-primary);
}

.service-desc {
  font-size: 12px;
  color: var(--fr-text-color-regular);
}

.onboarding-dismiss {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--fr-border-color);
  border-radius: 8px;
  color: var(--fr-text-color-regular);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.onboarding-dismiss:hover {
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
  border-color: var(--fr-border-color);
}
</style>