<template>
  <div class="service-group">
    <!-- 顶部控制台卡片 -->
    <div class="setting-card service-dashboard-card">
      <div class="setting-card-body" style="padding: 24px;">
        <div class="service-intro">
          <div class="service-intro-copy">
            <div class="service-intro-title">{{ t('options.service.introTitle') }}</div>
            <div class="service-intro-desc">
              {{ t('options.service.introDesc') }}
            </div>
            
            <div class="language-settings">
              <div class="dashboard-setting-row">
                <span class="setting-label">{{ t('options.service.defaultTarget') }}</span>
                <div class="setting-control">
                  <el-select v-model="config.to" :placeholder="t('options.service.targetPlaceholder')">
                    <el-option
                      v-for="item in options.to"
                      :key="item.value"
                      class="select-left"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>

              <div class="dashboard-setting-row">
                <span class="setting-label">{{ t('options.service.bidirectional') }}</span>
                <div class="setting-control bidirectional-toggle">
                  <el-switch v-model="config.bidirectionalTranslation" />
                  <span class="toggle-status">{{ config.bidirectionalTranslation ? t('options.service.enabled') : t('options.service.notEnabled') }}</span>
                </div>
              </div>

              <div v-if="config.bidirectionalTranslation" class="bidirectional-panel">
                <div class="dashboard-setting-row">
                  <span class="setting-label">{{ t('options.service.bidirectionalTarget') }}</span>
                  <div class="setting-control">
                    <el-select v-model="config.bidirectionalTarget" :placeholder="t('options.service.targetPlaceholder')">
                      <el-option
                        v-for="item in options.to"
                        :key="item.value"
                        class="select-left"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                </div>
                <p class="bidirectional-help">{{ bidirectionalHelpText }}</p>
              </div>
            </div>
          </div>
          
          <div class="current-service-panel">
            <div class="current-service-panel-title">{{ t('options.service.currentStatus') }}</div>
            <div class="current-service-panel-name">{{ currentServiceDisplay.title }}</div>
            <div class="current-service-panel-desc">{{ currentServiceDisplay.description }}</div>
            <div class="current-service-panel-meta">
              <span class="provider-badge" :class="currentServiceDisplay.configured ? 'provider-badge--configured' : ''">
                {{ currentServiceDisplay.configured ? t('options.service.ready') : t('options.service.notConfigured') }}
              </span>
              <span v-if="currentServiceDisplay.category" class="provider-badge">{{ currentServiceDisplay.category }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="provider-section">
      <div class="provider-section-meta">
        <div class="provider-section-title">{{ t('options.service.myServices') }}</div>
        <div class="provider-section-desc">{{ t('options.service.myServicesDesc') }}</div>
        <div style="margin-top: 16px;">
          <el-button type="primary" size="large" @click="showAddServiceDialog = true" style="width: 100%; font-weight: bold; height: 44px; border-radius: 8px;">
            + {{ t('options.service.addService') }}
          </el-button>
        </div>
      </div>

      <div class="provider-section-body">
        <article
          v-for="service in myServices"
          :key="service.id"
          class="provider-panel"
          :class="{ 'provider-panel--active': config.service === service.id, 'provider-panel--expanded': expandedServices[service.id] }"
        >
          <button type="button" class="provider-panel-head" @click="toggleExpanded(service.id)">
            <div class="provider-panel-title-wrap">
              <div class="provider-panel-title-row">
                <span class="provider-panel-title">{{ service.label }}</span>
                <span v-if="config.service === service.id" 
                      class="provider-badge provider-badge--active"
                      :class="{ 'provider-badge--error': !service.isConfigured }">
                  {{ service.isConfigured ? t('options.service.currentService') : t('options.service.currentServiceMissingConfig') }}
                </span>
                <span v-else-if="service.isConfigured" class="provider-badge provider-badge--configured">{{ t('options.service.configured') }}</span>
                <span v-else class="provider-badge">{{ t('options.service.notConfigured') }}</span>
              </div>
              <div class="provider-panel-hint">{{ service.hint }}</div>
            </div>
            <div class="provider-panel-actions">
              <el-button
                v-if="config.service !== service.id"
                size="small"
                plain
                @click.stop="setAsCurrent(service)"
              >
                {{ t('options.service.setCurrent') }}
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click.stop="removeService(service)"
              >
                {{ t('options.service.remove') }}
              </el-button>
              <span class="provider-panel-toggle">{{ expandedServices[service.id] ? t('options.service.collapse') : t('options.service.expand') }}</span>
            </div>
          </button>

          <!-- 展开的表单体 -->
          <div v-show="expandedServices[service.id]" class="provider-panel-body">
            
            <!-- 如果是自定义服务 -->
            <template v-if="service.isCustom">
              <div class="provider-form-row">
                <div class="provider-form-label">{{ t('options.service.providerName') }}</div>
                <div class="provider-form-control">
                  <el-input v-model="service.provider.name" :placeholder="t('options.service.providerNamePlaceholder')" />
                </div>
              </div>
              <div class="provider-form-row">
                <div class="provider-form-label">{{ t('options.service.providerUrl') }}</div>
                <div class="provider-form-control">
                  <el-input v-model="service.provider.url" :placeholder="t('options.service.providerUrlPlaceholder')" />
                </div>
              </div>
              <div class="provider-form-row">
                <div class="provider-form-label">API Key</div>
                <div class="provider-form-control">
                  <el-input v-model="service.provider.token" type="password" show-password :placeholder="t('options.service.customApiKeyPlaceholder')" />
                </div>
              </div>
              <div class="provider-form-row">
                <div class="provider-form-label">{{ t('options.service.modelName') }}</div>
                <div class="provider-form-control">
                  <el-input v-model="service.provider.customModel" :placeholder="t('options.service.modelNamePlaceholder')" @input="service.provider.model = customModelString" />
                </div>
              </div>
            </template>

            <!-- 如果是内置预设服务 -->
            <template v-else>
              <div v-if="usesToken(service.id)" class="provider-form-row">
                <div class="provider-form-label">
                  API Key
                  <a v-if="apiKeyLinks[service.id]" :href="apiKeyLinks[service.id]" target="_blank" rel="noopener noreferrer" class="apikey-link">{{ t('options.service.getApiKey') }}</a>
                </div>
                <div class="provider-form-control">
                  <el-input v-model="config.token[service.id]" type="password" show-password :placeholder="t('options.service.apiKeyPlaceholder')" />
                </div>
              </div>

              <div v-if="usesModel(service.id)" class="provider-form-row">
                <div class="provider-form-label">{{ t('options.service.model') }}</div>
                <div class="provider-form-control">
                  <div class="model-picker">
                    <el-select v-model="config.model[service.id]" filterable :placeholder="t('options.service.modelPlaceholder')" :loading="loadingModels[service.id]">
                      <el-option v-for="item in getModelOptions(service.id)" :key="item" class="select-left" :label="item" :value="item" />
                    </el-select>
                    <el-tooltip :content="canFetchModels(service.id) ? t('options.service.refreshModelsTip') : t('options.service.refreshModelsUnsupported')" placement="top">
                      <el-button
                        :icon="Refresh"
                        :loading="loadingModels[service.id]"
                        :disabled="!canFetchModels(service.id)"
                        plain
                        :aria-label="t('options.service.refreshModels')"
                        @click="handleFetchModels(service.id)"
                      />
                    </el-tooltip>
                  </div>
                  <div v-if="modelFetchHints[service.id]" class="model-fetch-hint">{{ modelFetchHints[service.id] }}</div>
                </div>
              </div>

              <div v-if="usesModel(service.id) && config.model[service.id] === customModelString" class="provider-form-row">
                <div class="provider-form-label">{{ t('options.service.customModel') }}</div>
                <div class="provider-form-control">
                  <el-input v-model="config.customModel[service.id]" :placeholder="t('options.service.customModelPlaceholder')" />
                </div>
              </div>

              <div v-if="usesProxy(service.id)" class="provider-form-row">
                <div class="provider-form-label">{{ usesModel(service.id) ? t('options.service.apiUrl') : t('options.service.proxyUrl') }}</div>
                <div class="provider-form-control">
                  <el-input :model-value="getProxyValue(service.id)" :placeholder="usesModel(service.id) ? t('options.service.apiUrlPlaceholder') : t('options.service.proxyUrlPlaceholder')" @update:model-value="setProxyValue(service.id, $event)" />
                  <div v-if="isProxyCustomized(service.id)" class="provider-inline-action">
                    <el-button type="primary" link size="small" @click="resetProxy(service.id)">{{ t('options.service.resetDefault') }}</el-button>
                  </div>
                </div>
              </div>
            </template>

            <!-- 统一测试连接按钮 -->
            <div class="provider-form-row">
              <div class="provider-form-label">{{ t('options.service.connectionTest') }}</div>
              <div class="provider-form-control provider-form-control--inline">
                <el-button type="primary" size="small" plain :loading="testingService === service.id" @click="handleTestConnection(service.id)">
                  {{ testingService === service.id ? t('options.service.testing') : t('options.service.testConnection') }}
                </el-button>
              </div>
            </div>
          </div>
        </article>
        
        <div v-if="myServices.length === 0" class="empty-services-hint">
          {{ t('options.service.emptyServices') }}
        </div>
      </div>
    </section>

    <!-- 服务库弹窗 -->
    <el-dialog v-model="showAddServiceDialog" :title="t('options.service.addService')" width="600px" custom-class="add-service-dialog">
      <div class="service-gallery">
        <div class="gallery-category">{{ t('options.service.customCategory') }}</div>
        <div class="gallery-grid">
          <div class="gallery-item gallery-item--custom" @click="addCustomProvider">
            <div class="gallery-item-icon">+</div>
            <div class="gallery-item-info">
              <div class="gallery-item-title">{{ t('options.service.customGateway') }}</div>
              <div class="gallery-item-desc">{{ t('options.service.customGatewayDesc') }}</div>
            </div>
          </div>
        </div>

        <div class="gallery-category" style="margin-top: 24px;">{{ t('options.service.builtinPresets') }}</div>
        <div class="gallery-grid">
          <div 
            v-for="preset in availablePresets" 
            :key="preset.value" 
            class="gallery-item"
            :class="{ 'gallery-item--disabled': preset.isActive }"
            @click="!preset.isActive && addPresetProvider(preset.value)"
          >
            <div class="gallery-item-info">
              <div class="gallery-item-title">
                {{ preset.label }}
                <span v-if="preset.isActive" class="gallery-item-tag">{{ t('options.service.alreadyAdded') }}</span>
              </div>
              <div class="gallery-item-desc">{{ preset.hint }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { customModelString, options, services, servicesType, isServiceConfigured } from '@/entrypoints/utils/option'
import { urls } from '@/entrypoints/utils/constant'
import { useConfig } from '@/composables/useConfig'
import { testConnection } from '@/entrypoints/utils/testConnection'
import { canFetchProviderModels, fetchProviderModels, getStaticModelOptions } from '@/entrypoints/utils/modelCatalog'
import { useI18n } from 'vue-i18n'

const { config } = useConfig()
const { t } = useI18n()

const showAddServiceDialog = ref(false)

const testingService = computed({
  get: () => state.testingService,
  set: (value: string) => { state.testingService = value }
})

const state = reactive({
  testingService: '',
  expandedServices: {} as Record<string, boolean>,
  loadingModels: {} as Record<string, boolean>,
  modelOptions: {} as Record<string, string[]>,
  modelFetchHints: {} as Record<string, string>
})

const expandedServices = state.expandedServices
const loadingModels = state.loadingModels
const modelFetchHints = state.modelFetchHints

// 所有预设的库定义
const allPresets = [
  { value: services.openai, label: 'OpenAI', hintKey: 'options.service.presetHints.openai' },
  { value: services.deepseek, label: 'DeepSeek', hintKey: 'options.service.presetHints.deepseek' },
  { value: services.gemini, label: 'Gemini', hintKey: 'options.service.presetHints.gemini' },
  { value: services.claude, label: 'Claude', hintKey: 'options.service.presetHints.claude' },
  { value: services.moonshot, label: 'Kimi', hintKey: 'options.service.presetHints.moonshot' },
  { value: services.zhipu, label: '智谱', hintKey: 'options.service.presetHints.zhipu' },
  { value: services.minimax, label: 'MiniMax', hintKey: 'options.service.presetHints.minimax' },
  { value: services.jieyue, label: '阶跃星辰', hintKey: 'options.service.presetHints.jieyue' },
  { value: services.siliconCloud, label: 'SiliconCloud', hintKey: 'options.service.presetHints.siliconCloud' },
  { value: services.grok, label: 'Grok', hintKey: 'options.service.presetHints.grok' },
  { value: services.deepL, label: 'DeepL', hintKey: 'options.service.presetHints.deepl' }
]

// 组合计算出最终的我的服务列表
const myServices = computed(() => {
  const result: any[] = []
  
  // 1. 添加所有启用的内置服务
  if (config.value.activeBuiltinProviders) {
    for (const pid of config.value.activeBuiltinProviders) {
      const preset = allPresets.find(p => p.value === pid)
      if (preset) {
        result.push({
          id: preset.value,
          isCustom: false,
          label: preset.label,
          hint: t(preset.hintKey),
          isConfigured: isConfigured(preset.value)
        })
      }
    }
  }

  // 2. 添加所有自定义服务
  if (config.value.customProviders) {
    for (const provider of config.value.customProviders) {
      result.push({
        id: provider.id,
        isCustom: true,
        label: provider.name || t('options.service.unnamedProvider'),
        hint: provider.url || t('options.service.customProviderHint'),
        isConfigured: !!provider.url,
        provider: provider
      })
    }
  }

  // 如果当前选中的服务不在列表里，把它也拉进来（容错）
  if (config.value.service && !config.value.service.startsWith('custom_')) {
    if (!result.find(r => r.id === config.value.service)) {
       const preset = allPresets.find(p => p.value === config.value.service);
       if (preset) {
          result.push({
            id: preset.value,
            isCustom: false,
            label: preset.label,
            hint: t(preset.hintKey),
            isConfigured: isConfigured(preset.value)
          });
       }
    }
  }

  return result
})

const availablePresets = computed(() => {
  return allPresets.map(preset => {
    return {
      ...preset,
      hint: t(preset.hintKey),
      isActive: !!myServices.value.find(s => s.id === preset.value)
    }
  })
})

const builtinServiceNotice = computed(() => {
  if (config.value.service === services.microsoft) {
    return { title: 'Microsoft Translator', description: t('options.service.microsoftNotice') }
  }
  if (config.value.service === services.google) {
    return { title: 'Google Translate', description: t('options.service.googleNotice') }
  }
  if (config.value.service === services.chromeTranslator) {
    return { title: 'Chrome Built-in AI Translator', description: t('options.service.chromeNotice') }
  }
  return null
})

const currentServiceDisplay = computed(() => {
  const configured = isServiceConfigured(config.value.service, config.value)
  if (builtinServiceNotice.value) {
    return {
      title: builtinServiceNotice.value.title,
      description: builtinServiceNotice.value.description,
      configured: true,
      category: t('options.service.builtInService')
    }
  }
  
  const foundInMyServices = myServices.value.find(s => s.id === config.value.service)
  if (foundInMyServices) {
    return {
      title: foundInMyServices.label,
      description: foundInMyServices.hint,
      configured: foundInMyServices.isConfigured,
      category: foundInMyServices.isCustom ? t('options.service.customService') : t('options.service.aiService')
    }
  }

  return { title: config.value.service, description: t('options.service.currentService'), configured, category: '' }
})

const getLanguageLabel = (value: string) => {
  return options.to.find(item => item.value === value)?.label || value
}

const bidirectionalHelpText = computed(() => {
  const defaultTarget = getLanguageLabel(config.value.to)
  const bidirectionalTarget = getLanguageLabel(config.value.bidirectionalTarget)

  if (config.value.to === config.value.bidirectionalTarget) {
    return t('options.service.fixedTargetHelp')
  }

  return t('options.service.bidirectionalHelp', { from: defaultTarget, to: bidirectionalTarget })
})

const apiKeyLinks: Record<string, string> = {
  [services.openai]: 'https://platform.openai.com/api-keys',
  [services.gemini]: 'https://aistudio.google.com/apikey',
  [services.claude]: 'https://console.anthropic.com/settings/keys',
  [services.deepseek]: 'https://platform.deepseek.com/api_keys',
  [services.siliconCloud]: 'https://cloud.siliconflow.cn/account/ak',
  [services.zhipu]: 'https://bigmodel.cn/usercenter/proj-mgmt/apikey',
  [services.moonshot]: 'https://platform.moonshot.cn/console/api-keys',
  [services.deepL]: 'https://www.deepl.com/your-account/keys',
  [services.minimax]: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  [services.jieyue]: 'https://platform.stepfun.com/interface-key',
  [services.grok]: 'https://console.x.ai/',
  [services.openrouter]: 'https://openrouter.ai/keys',
}

const toggleExpanded = (serviceId: string) => {
  expandedServices[serviceId] = !expandedServices[serviceId]
}

const setAsCurrent = (service: any) => {
  if (!service.isConfigured) {
    ElMessage.warning(t('options.service.switchNeedsConfig'))
    expandedServices[service.id] = true
    return
  }
  config.value.service = service.id
  expandedServices[service.id] = true
  ElMessage.success(t('options.service.switched', { service: service.label }))
}

const removeService = (service: any) => {
  if (config.value.service === service.id) {
    ElMessage.warning(t('options.service.removeCurrentBlocked'))
    return
  }
  if (service.isCustom) {
    const index = config.value.customProviders.findIndex((p: any) => p.id === service.id)
    if (index > -1) config.value.customProviders.splice(index, 1)
  } else {
    const index = config.value.activeBuiltinProviders.indexOf(service.id)
    if (index > -1) config.value.activeBuiltinProviders.splice(index, 1)
    // 可选：清理掉它的 token 等以彻底重置
    config.value.token[service.id] = ''
  }
  delete expandedServices[service.id]
  ElMessage.success(t('options.service.removed'))
}

const addPresetProvider = (presetId: string) => {
  if (!config.value.activeBuiltinProviders) config.value.activeBuiltinProviders = []
  if (!config.value.activeBuiltinProviders.includes(presetId)) {
    config.value.activeBuiltinProviders.push(presetId)
  }
  showAddServiceDialog.value = false
  expandedServices[presetId] = true
  ElMessage.success(t('options.service.addedNeedsConfig'))
}

const addCustomProvider = () => {
  if (!config.value.customProviders) config.value.customProviders = []
  const newId = `custom_${Date.now()}`
  config.value.customProviders.push({
    id: newId,
    name: t('options.service.newCustomProvider'),
    url: '',
    token: '',
    model: customModelString,
    customModel: ''
  })
  showAddServiceDialog.value = false
  expandedServices[newId] = true
  ElMessage.success(t('options.service.addedCustomNeedsConfig'))
}

const isConfigured = (service: string) => isServiceConfigured(service, config.value)
const usesToken = (service: string) => servicesType.isUseToken(service)
const usesModel = (service: string) => servicesType.isUseModel(service)
const usesProxy = (service: string) => servicesType.isUseProxy(service)
const canFetchModels = (service: string) => canFetchProviderModels(service)
const getModelOptions = (service: string) => state.modelOptions[service] || getStaticModelOptions(service)

const getProxyValue = (service: string) => {
  const defaultUrl = urls[service]
  return config.value.proxy[service] || (typeof defaultUrl === 'string' ? defaultUrl : '')
}

const setProxyValue = (service: string, value: string) => {
  config.value.proxy[service] = value
}

const isProxyCustomized = (service: string) => {
  const defaultUrl = urls[service]
  return !!config.value.proxy[service] && config.value.proxy[service] !== defaultUrl
}

const resetProxy = (service: string) => {
  config.value.proxy[service] = ''
}

const handleFetchModels = async (service: string) => {
  if (!canFetchModels(service)) return

  loadingModels[service] = true
  modelFetchHints[service] = ''

  try {
    const items = await fetchProviderModels(service, {
      token: config.value.token[service],
      url: getProxyValue(service)
    })

    state.modelOptions[service] = items
    const currentModel = config.value.model[service]
    if (!currentModel || (currentModel !== customModelString && !items.includes(currentModel))) {
      config.value.model[service] = items.find((item) => item !== customModelString) || customModelString
    }

    const remoteModelCount = items.filter((item) => item !== customModelString).length
    modelFetchHints[service] = t('options.service.fetchedModels', { count: remoteModelCount })
    ElMessage.success(t('options.service.modelListUpdated'))
  } catch (error: any) {
    const message = error?.message || t('options.service.unknownError')
    modelFetchHints[service] = message
    ElMessage.error(message)
  } finally {
    loadingModels[service] = false
  }
}

const handleTestConnection = async (service: string) => {
  testingService.value = service
  try {
    const result = await testConnection(service, {
      token: config.value.token,
      model: config.value.model,
      customModel: config.value.customModel,
      customProviders: config.value.customProviders,
      proxy: {
        ...config.value.proxy,
        [services.newapi]: config.value.newApiUrl,
      }
    })
    if (result.success) ElMessage.success(result.message)
    else ElMessage.error(result.message)
  } catch (error: any) {
    ElMessage.error(t('options.service.testFailed', { message: error.message || t('options.service.unknownError') }))
  } finally {
    testingService.value = ''
  }
}
</script>

<style scoped>
.service-group {
  width: 100%;
}
.service-group :deep(.setting-row) { padding: 20px 0; }
.service-group :deep(.setting-row--col) { align-items: flex-start; }
.service-group :deep(.setting-control) { width: 100%; }
.service-group :deep(.setting-control .el-select),
.service-group :deep(.setting-control .el-input) { width: 100%; }

.service-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 32px;
  align-items: center;
}
.service-intro-copy { display: flex; flex-direction: column; gap: 8px; }
.service-intro-title { font-size: 22px; font-weight: 700; color: var(--el-text-color-primary); }
.service-intro-desc { max-width: 480px; font-size: 13px; line-height: 1.6; color: var(--el-text-color-secondary); }
.language-settings {
  margin-top: 16px;
  max-width: 460px;
}
.dashboard-setting-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.dashboard-setting-row .setting-control { width: 220px; }
.bidirectional-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toggle-status {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.bidirectional-panel {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 100%);
}
.bidirectional-panel .dashboard-setting-row {
  margin-top: 0;
}
.bidirectional-help {
  margin: 10px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.current-service-panel {
  min-height: 124px;
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 100%);
  border: 1px solid var(--el-color-primary-light-7);
}
.current-service-panel-title { font-size: 12px; font-weight: 600; color: var(--el-text-color-secondary); }
.current-service-panel-name { margin-top: 8px; font-size: 22px; font-weight: 700; line-height: 1.25; color: var(--el-text-color-primary); }
.current-service-panel-desc { margin-top: 8px; max-width: 760px; font-size: 13px; line-height: 1.8; color: var(--el-text-color-secondary); }
.current-service-panel-meta { display: flex; gap: 8px; margin-top: 12px; }

.provider-section {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  padding: 28px 0;
  border-top: 1px solid var(--fr-section-border);
}
.provider-section-meta { display: flex; flex-direction: column; gap: 8px; padding-top: 6px; }
.provider-section-title { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); }
.provider-section-desc { max-width: 240px; font-size: 13px; line-height: 1.7; color: var(--el-text-color-secondary); }
.provider-section-body { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }

.provider-panel {
  border: 1px solid var(--fr-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.provider-panel:hover:not(.provider-panel--active) {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.provider-panel--active {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-8);
}
.provider-panel--expanded { grid-column: 1 / -1; }

.provider-panel-head {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 20px;
  text-align: left;
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid transparent;
  cursor: pointer;
}
.provider-panel--expanded .provider-panel-head { border-bottom-color: var(--el-border-color-lighter); }
.provider-panel-title-wrap { min-width: 0; }
.provider-panel-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.provider-panel-title { font-size: 16px; font-weight: 700; color: var(--el-text-color-primary); }
.provider-panel-hint { margin-top: 6px; font-size: 13px; line-height: 1.7; color: var(--el-text-color-secondary); }
.provider-panel-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.provider-panel-toggle { font-size: 12px; color: var(--el-text-color-secondary); }

.provider-badge { padding: 2px 8px; border-radius: 999px; background: var(--el-fill-color); color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.provider-badge--active { color: white; background: var(--el-color-primary); }
.provider-badge--error { color: white; background: var(--el-color-danger); }
.provider-badge--configured { color: var(--el-color-success); background: var(--el-color-success-light-9); }

.provider-panel-body { padding: 8px 20px 20px; border-top: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color); }
.provider-form-row { display: grid; grid-template-columns: 140px minmax(320px, 1fr); gap: 24px; align-items: start; padding: 16px 0; }
.provider-form-row + .provider-form-row { border-top: 1px solid var(--el-border-color-lighter); }
.provider-form-label { display: flex; align-items: center; gap: 8px; min-height: 40px; font-size: 13px; color: var(--el-text-color-primary); }
.provider-form-control { min-width: 0; }
.provider-form-control--inline { display: flex; align-items: center; }
.provider-form-control :deep(.el-select), .provider-form-control :deep(.el-input) { width: 100%; }
.model-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}
.model-picker :deep(.el-button) {
  flex-shrink: 0;
}
.model-fetch-hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.provider-inline-action { margin-top: 6px; display: flex; justify-content: flex-end; }
.apikey-link { font-size: 12px; color: var(--fr-accent-color); text-decoration: none; }
.apikey-link:hover { text-decoration: underline; }
.empty-services-hint { text-align: center; color: var(--el-text-color-placeholder); padding: 40px 0; font-size: 14px; background: var(--el-fill-color-extra-light); border-radius: 12px; border: 1px dashed var(--el-border-color); }

/* Service Gallery Dialog */
.service-gallery { display: flex; flex-direction: column; gap: 16px; }
.gallery-category { font-size: 14px; font-weight: 700; color: var(--el-text-color-secondary); }
.gallery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.gallery-item {
  display: flex; gap: 12px; align-items: center; padding: 12px 16px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
}
.gallery-item:hover { border-color: var(--el-color-primary-light-5); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05); transform: translateY(-1px); }
.gallery-item--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.gallery-item-icon { width: 36px; height: 36px; border-radius: 8px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 300; flex-shrink: 0; }
.gallery-item-info { min-width: 0; flex: 1; }
.gallery-item-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); display: flex; align-items: center; gap: 8px; }
.gallery-item-desc { margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gallery-item-tag { font-size: 10px; font-weight: normal; background: var(--el-fill-color); padding: 2px 6px; border-radius: 4px; color: var(--el-text-color-secondary); }
.gallery-item--custom { background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 100%); border-color: var(--el-color-primary-light-7); }
</style>
