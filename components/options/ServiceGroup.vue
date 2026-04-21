<template>
  <div class="service-group">
    <!-- 顶部控制台卡片 -->
    <div class="setting-card service-dashboard-card">
      <div class="setting-card-body" style="padding: 24px;">
        <div class="service-intro">
          <div class="service-intro-copy">
            <div class="service-intro-title">配置翻译引擎</div>
            <div class="service-intro-desc">
              请下方选定某一引擎作为主力翻译核心。配置后可一键切换体验效果。
            </div>
            
            <div class="dashboard-setting-row" style="margin-top: 16px;">
              <span class="setting-label">默认目标语言</span>
              <div class="setting-control" style="width: 200px;">
                <el-select v-model="config.to" placeholder="选择目标语言">
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
          </div>
          
          <div class="current-service-panel">
            <div class="current-service-panel-title">主引擎状态</div>
            <div class="current-service-panel-name">{{ currentServiceDisplay.title }}</div>
            <div class="current-service-panel-desc">{{ currentServiceDisplay.description }}</div>
            <div class="current-service-panel-meta">
              <span class="provider-badge" :class="currentServiceDisplay.configured ? 'provider-badge--configured' : ''">
                {{ currentServiceDisplay.configured ? '系统已就绪' : '接口未配置' }}
              </span>
              <span v-if="currentServiceDisplay.category" class="provider-badge">{{ currentServiceDisplay.category }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section v-for="section in serviceSections" :key="section.key" class="provider-section">
      <div class="provider-section-meta">
        <div class="provider-section-title">{{ section.title }}</div>
        <div class="provider-section-desc">{{ section.description }}</div>
      </div>

      <div class="provider-section-body">
        <article
          v-for="service in section.items"
          :key="service.value"
          class="provider-panel"
          :class="{ 'provider-panel--active': config.service === service.value, 'provider-panel--expanded': expandedServices[service.value] }"
        >
          <button type="button" class="provider-panel-head" @click="toggleExpanded(service.value)">
            <div class="provider-panel-title-wrap">
              <div class="provider-panel-title-row">
                <span class="provider-panel-title">{{ service.label }}</span>
                <span v-if="config.service === service.value" 
                      class="provider-badge provider-badge--active"
                      :class="{ 'provider-badge--error': !isConfigured(service.value) }">
                  {{ isConfigured(service.value) ? '当前服务' : '当前服务 (缺少配置)' }}
                </span>
                <span v-else-if="isConfigured(service.value)" class="provider-badge provider-badge--configured">已配置</span>
                <span v-else class="provider-badge">未配置</span>
              </div>
              <div class="provider-panel-hint">{{ service.hint }}</div>
            </div>
            <div class="provider-panel-actions">
              <el-button
                v-if="config.service !== service.value"
                size="small"
                plain
                @click.stop="setAsCurrent(service.value)"
              >
                设为当前服务
              </el-button>
              <span class="provider-panel-toggle">{{ expandedServices[service.value] ? '收起' : '展开' }}</span>
            </div>
          </button>

          <div v-show="expandedServices[service.value]" class="provider-panel-body">
            <div v-if="usesToken(service.value)" class="provider-form-row">
              <div class="provider-form-label">
                API Key
                <a
                  v-if="apiKeyLinks[service.value]"
                  :href="apiKeyLinks[service.value]"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="apikey-link"
                >
                  获取
                </a>
              </div>
              <div class="provider-form-control">
                <el-input
                  v-model="config.token[service.value]"
                  type="password"
                  show-password
                  placeholder="输入 API Key"
                />
              </div>
            </div>

            <div v-if="usesModel(service.value)" class="provider-form-row">
              <div class="provider-form-label">模型</div>
              <div class="provider-form-control">
                <el-select v-model="config.model[service.value]" placeholder="选择模型">
                  <el-option
                    v-for="item in models.get(service.value) || []"
                    :key="item"
                    class="select-left"
                    :label="item"
                    :value="item"
                  />
                </el-select>
              </div>
            </div>

            <div
              v-if="usesModel(service.value) && config.model[service.value] === customModelString"
              class="provider-form-row"
            >
              <div class="provider-form-label">自定义模型</div>
              <div class="provider-form-control">
                <el-input v-model="config.customModel[service.value]" placeholder="输入模型名称" />
              </div>
            </div>

            <div v-if="service.value === services.custom" class="provider-form-row">
              <div class="provider-form-label">接口地址</div>
              <div class="provider-form-control">
                <el-input v-model="config.custom" placeholder="例如: https://api.xxx.com 结尾自带智能补正" />
              </div>
            </div>

            <div v-if="usesProxy(service.value)" class="provider-form-row">
              <div class="provider-form-label">{{ usesModel(service.value) ? '接口 URL' : '代理 URL' }}</div>
              <div class="provider-form-control">
                <el-input
                  :model-value="getProxyValue(service.value)"
                  :placeholder="usesModel(service.value) ? '输入接口 URL' : '输入代理 URL'"
                  @update:model-value="setProxyValue(service.value, $event)"
                />
                <div v-if="isProxyCustomized(service.value)" class="provider-inline-action">
                  <el-button type="primary" link size="small" @click="resetProxy(service.value)">恢复默认</el-button>
                </div>
              </div>
            </div>

            <div class="provider-form-row">
              <div class="provider-form-label">连接测试</div>
              <div class="provider-form-control provider-form-control--inline">
                <el-button
                  type="primary"
                  size="small"
                  plain
                  :loading="testingService === service.value"
                  @click="handleTestConnection(service.value)"
                >
                  {{ testingService === service.value ? '测试中...' : '测试连接' }}
                </el-button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { customModelString, models, options, services, servicesType, isServiceConfigured } from '@/entrypoints/utils/option'
import { urls } from '@/entrypoints/utils/constant'
import { useConfig } from '@/composables/useConfig'
import { testConnection } from '@/entrypoints/utils/testConnection'

type ConfigurableService = {
  value: string
  label: string
  hint: string
}

type ServiceSection = {
  key: string
  title: string
  description: string
  items: ConfigurableService[]
}

const { config } = useConfig()

const testingService = computed({
  get: () => state.testingService,
  set: (value: string) => { state.testingService = value }
})

const state = reactive({
  testingService: '',
  expandedServices: {
    [services.openai]: true,
    [services.deepL]: false,
    [services.deepseek]: false,
    [services.gemini]: false,
    [services.claude]: false,
    [services.moonshot]: false,
    [services.zhipu]: false,
    [services.minimax]: false,
    [services.jieyue]: false,
    [services.siliconCloud]: false,
    [services.grok]: false,
    [services.custom]: false,
  } as Record<string, boolean>
})

const expandedServices = state.expandedServices

const serviceSections = computed<ServiceSection[]>(() => [
  {
    key: 'translation-api',
    title: '翻译 API',
    description: '偏传统翻译接口，配置项通常更少，适合稳定翻译场景。',
    items: [
      { value: services.deepL, label: 'DeepL', hint: '翻译质量稳定，需 API Key' },
    ],
  },
  {
    key: 'llm-services',
    title: 'AI 服务',
    description: '适合自然表达、复杂句式和更灵活的翻译结果。',
    items: [
      { value: services.openai, label: 'OpenAI', hint: '通用性强，需 API Key' },
      { value: services.deepseek, label: 'DeepSeek', hint: '性价比高，需 API Key' },
      { value: services.gemini, label: 'Gemini', hint: 'Google 模型，需 API Key' },
      { value: services.claude, label: 'Claude', hint: '写作风格好，需 API Key' },
      { value: services.moonshot, label: 'Kimi', hint: 'Moonshot，需 API Key' },
      { value: services.zhipu, label: '智谱', hint: 'GLM 系列，需 API Key' },
      { value: services.minimax, label: 'MiniMax', hint: '需 API Key' },
      { value: services.jieyue, label: '阶跃星辰', hint: 'Step 系列，需 API Key' },
      { value: services.siliconCloud, label: 'SiliconCloud', hint: '模型聚合平台，需 API Key' },
      { value: services.grok, label: 'Grok', hint: 'xAI，需 API Key' },
    ],
  },
  {
    key: 'advanced',
    title: '高级接入',
    description: '适合已经有自建网关、聚合路由或兼容接口的用户。',
    items: [
      { value: services.custom, label: '自定义接口 (兼容各种中转网关)', hint: '支持标准 OpenAI 格式接口池、Ollama 本地大模型。' },
    ],
  },
])

const builtinServiceNotice = computed(() => {
  if (config.value.service === services.microsoft) {
    return {
      title: '微软翻译',
      description: '这是免配置服务，不需要在此页填写参数。可直接在弹窗或通用区域切换使用。'
    }
  }
  if (config.value.service === services.google) {
    return {
      title: 'Google 翻译',
      description: '这是免配置服务，不需要在此页填写参数。仅在双语对照模式下可用。'
    }
  }
  if (config.value.service === services.chromeTranslator) {
    return {
      title: 'Chrome 内置 AI 翻译',
      description: '这是本地模型服务，不需要 API Key。模型下载和可用性建议放在独立的内置 AI 设置里。'
    }
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
      category: '内置服务'
    }
  }

  for (const section of serviceSections.value) {
    const found = section.items.find(item => item.value === config.value.service)
    if (found) {
      return {
        title: found.label,
        description: found.hint,
        configured,
        category: section.title
      }
    }
  }

  return {
    title: config.value.service,
    description: '当前服务',
    configured,
    category: ''
  }
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

const toggleExpanded = (service: string) => {
  expandedServices[service] = !expandedServices[service]
}

const setAsCurrent = (service: string) => {
  if (!isConfigured(service)) {
    ElMessage.warning('未能切换：请先在下方填写该引擎所需的 API Key 或接口地址')
    expandedServices[service] = true
    return
  }
  config.value.service = service
  expandedServices[service] = true
  ElMessage.success(`已切换翻译主力引擎为 ${serviceSections.value.flatMap(s => s.items).find(i => i.value === service)?.label || service}`)
}

const isConfigured = (service: string) => isServiceConfigured(service, config.value)
const usesToken = (service: string) => servicesType.isUseToken(service)
const usesModel = (service: string) => servicesType.isUseModel(service)
const usesProxy = (service: string) => servicesType.isUseProxy(service)

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

const handleTestConnection = async (service: string) => {
  testingService.value = service
  try {
    const result = await testConnection(service, {
      token: config.value.token,
      proxy: {
        ...config.value.proxy,
        [services.custom]: config.value.custom,
        [services.newapi]: config.value.newApiUrl,
      }
    })

    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (error: any) {
    ElMessage.error(`连接测试失败: ${error.message || '未知错误'}`)
  } finally {
    testingService.value = ''
  }
}
</script>

<style scoped>
.service-group {
  width: 100%;
}

.service-group :deep(.setting-row) {
  padding: 20px 0;
}

.service-group :deep(.setting-row--col) {
  align-items: flex-start;
}

.service-group :deep(.setting-control) {
  width: 100%;
}

.service-group :deep(.setting-control .el-select),
.service-group :deep(.setting-control .el-input) {
  width: 100%;
}

.select-left {
  text-align: left;
}

.service-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 32px;
  align-items: center;
}

.service-intro-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.service-intro-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.service-intro-desc {
  max-width: 480px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.dashboard-setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.builtin-service-notice {
  min-height: 96px;
  padding: 16px 18px;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--el-fill-color-light) 0%, var(--el-bg-color) 100%);
  border: 1px solid var(--fr-section-border);
}

.builtin-service-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.builtin-service-desc {
  margin-top: 6px;
  max-width: 760px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.current-service-panel {
  min-height: 124px;
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 100%);
  border: 1px solid var(--el-color-primary-light-7);
}

.current-service-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.current-service-panel-name {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--el-text-color-primary);
}

.current-service-panel-desc {
  margin-top: 8px;
  max-width: 760px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.current-service-panel-meta {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.provider-section {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  padding: 28px 0;
  border-top: 1px solid var(--fr-section-border);
}

.provider-section-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
}

.provider-section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.provider-section-desc {
  max-width: 240px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.provider-section-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

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

.provider-panel--expanded {
  grid-column: 1 / -1;
}

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
}

.provider-panel--expanded .provider-panel-head {
  border-bottom-color: var(--el-border-color-lighter);
}

.provider-panel-title-wrap {
  min-width: 0;
}

.provider-panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.provider-panel-hint {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.provider-panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.provider-panel-toggle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.provider-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.provider-badge--active {
  color: white;
  background: var(--el-color-primary);
}

.provider-badge--error {
  color: white;
  background: var(--el-color-danger);
}

.provider-badge--configured {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.provider-panel-body {
  padding: 8px 20px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.provider-form-row {
  display: grid;
  grid-template-columns: 140px minmax(320px, 1fr);
  gap: 24px;
  align-items: start;
  padding: 16px 0;
}

.provider-form-row + .provider-form-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.provider-form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.provider-form-control {
  min-width: 0;
}

.provider-form-control--inline {
  display: flex;
  align-items: center;
}

.provider-form-control :deep(.el-select),
.provider-form-control :deep(.el-input) {
  width: 100%;
}

.provider-inline-action {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}

.apikey-link {
  font-size: 12px;
  color: var(--fr-accent-color);
  text-decoration: none;
}

.apikey-link:hover {
  text-decoration: underline;
}
</style>
