<template>
  <div v-if="!dismissed" class="onboarding-card">
    <button class="onboarding-close" @click="dismiss">×</button>
    <div class="onboarding-header">
      <span class="onboarding-icon">
        <el-icon><ChatDotRound /></el-icon>
      </span>
      <h3 class="onboarding-title">{{ t('onboarding.title') }}</h3>
    </div>
    <p class="onboarding-desc">
      {{ t('onboarding.desc') }}
    </p>
    <div class="onboarding-services">
      <p class="onboarding-services-label">{{ t('onboarding.recommendedServices') }}</p>
      <div class="onboarding-service-list">
        <button class="onboarding-service-item" @click="selectService('siliconCloud')">
          <span class="service-name">{{ t('onboarding.siliconCloud') }}</span>
          <span class="service-desc">{{ t('onboarding.siliconCloudDesc') }}</span>
        </button>
        <button class="onboarding-service-item" @click="selectService('deepseek')">
          <span class="service-name">DeepSeek</span>
          <span class="service-desc">{{ t('onboarding.deepseekDesc') }}</span>
        </button>
        <button class="onboarding-service-item" @click="selectService('chromeTranslator')">
          <span class="service-name">{{ t('onboarding.chromeTranslator') }}</span>
          <span class="service-desc">{{ t('onboarding.chromeTranslatorDesc') }}</span>
        </button>
      </div>
    </div>
    <button class="onboarding-dismiss" @click="dismiss">{{ t('onboarding.dismiss') }}</button>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { storage } from '@wxt-dev/storage'
import { useConfig } from '@/composables/useConfig'
import { useI18n } from 'vue-i18n'
import { ChatDotRound } from '@element-plus/icons-vue'

const { config } = useConfig()
const { t } = useI18n()
const dismissed = ref(false)

onMounted(async () => {
  const value = await storage.getItem('local:onboardingDismissed')
  dismissed.value = value === true || value === 'true'
})

const dismiss = async () => {
  dismissed.value = true
  await storage.setItem('local:onboardingDismissed', true)
}

const selectService = (service: string) => {
  config.value.service = service
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
  width: 100%;
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
}
</style>
