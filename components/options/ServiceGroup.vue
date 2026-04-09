<template>
  <div class="service-group">
    <!-- Service selector -->
    <div class="setting-row">
      <span class="setting-label">
        翻译服务
        <ServiceStatusBadge :service="config.service" />
        <el-tooltip effect="dark" content="机器翻译：快速稳定，适合日常使用；AI翻译：更自然流畅，需要配置令牌" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </span>
      <div class="setting-control">
        <el-select v-model="config.service" placeholder="请选择翻译服务">
          <el-option class="select-left" v-for="item in filteredServices" :key="item.value"
            :label="item.label" :value="item.value" :disabled="item.disabled">
            <span :class="{ 'unconfigured-service': item.unconfigured }">{{ item.label }}</span>
            <span v-if="item.unconfigured" class="unconfigured-hint">（未配置）</span>
          </el-option>
        </el-select>
      </div>
    </div>

    <!-- Service configuration section (shown based on selected service) -->
    <div class="service-config" v-show="showServiceConfig">
      <!-- Token input -->
      <div v-show="showToken" class="setting-row">
        <span class="setting-label">
          访问令牌
          <el-tooltip effect="dark" content="API访问令牌仅保存在本地，用于访问翻译服务。获取方式请参考对应服务的官方文档；翻译服务为 ollama 时，token 可为任意值" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.token[config.service]" type="password" show-password placeholder="请输入API访问令牌" />
        </div>
      </div>

      <!-- Azure OpenAI endpoint -->
      <div v-show="showAzureOpenaiEndpoint" class="setting-row setting-row--col">
        <span class="setting-label">
          Azure 端点
          <el-tooltip effect="dark" content="Azure OpenAI 服务端点地址，必须包含完整的部署信息。格式：https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions?api-version=2024-02-15-preview" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control setting-control--full">
          <el-input v-model="config.azureOpenaiEndpoint"
            placeholder="https://your-resource.openai.azure.com/..."
            :class="{ 'input-error': config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint) }" />
          <div v-if="config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint)" class="error-text">
            端点地址格式不正确，请确保包含 openai.azure.com 域名和 /chat/completions 路径
          </div>
        </div>
      </div>

      <!-- DeepLX URL -->
      <div v-show="showDeepLX" class="setting-row">
        <span class="setting-label">服务地址</span>
        <div class="setting-control">
          <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
        </div>
      </div>

      <!-- AkSk (Baidu) -->
      <div v-show="showAkSk" class="setting-row">
        <span class="setting-label">
          API Key
          <el-tooltip effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.ak" placeholder="请输入Access Key" />
        </div>
      </div>
      <div v-show="showAkSk" class="setting-row">
        <span class="setting-label">Secret Key</span>
        <div class="setting-control">
          <el-input v-model="config.sk" type="password" placeholder="请输入Secret Key" />
        </div>
      </div>

      <!-- Youdao -->
      <div v-show="showYoudao" class="setting-row">
        <span class="setting-label">
          App Key
          <el-tooltip effect="dark" content="有道智云翻译API应用ID，用于访问有道翻译服务。可在有道智云控制台获取" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.youdaoAppKey" placeholder="有道 AppKey" />
        </div>
      </div>
      <div v-show="showYoudao" class="setting-row">
        <span class="setting-label">App Secret</span>
        <div class="setting-control">
          <el-input v-model="config.youdaoAppSecret" type="password" show-password placeholder="有道 AppSecret" />
        </div>
      </div>

      <!-- Tencent -->
      <div v-show="showTencent" class="setting-row">
        <span class="setting-label">
          Secret ID
          <el-tooltip effect="dark" content="腾讯云API访问密钥ID，用于访问腾讯云机器翻译服务。可在腾讯云控制台的访问管理中获取" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.tencentSecretId" placeholder="腾讯云 SecretId" />
        </div>
      </div>
      <div v-show="showTencent" class="setting-row">
        <span class="setting-label">Secret Key</span>
        <div class="setting-control">
          <el-input v-model="config.tencentSecretKey" type="password" show-password placeholder="腾讯云 SecretKey" />
        </div>
      </div>

      <!-- Coze robot ID -->
      <div v-show="showRobotId" class="setting-row">
        <span class="setting-label">
          机器人ID
          <el-tooltip effect="dark" content="Coze机器人ID，可在Coze开发者文档中查看获取方式" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.robot_id[config.service]" placeholder="请输入Coze机器人ID" />
        </div>
      </div>

      <!-- Custom URL -->
      <div v-show="showCustom" class="setting-row">
        <span class="setting-label">
          自定义接口
          <el-tooltip effect="dark" content="目前仅支持OpenAI格式的请求接口，如http://localhost:3000/v1/chat/completions" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.custom" placeholder="请输入自定义接口地址" />
        </div>
      </div>

      <!-- NewAPI URL -->
      <div v-show="showNewAPI" class="setting-row">
        <span class="setting-label">
          NewAPI接口
          <el-tooltip effect="dark" content="填写 New API 的访问地址，如：http://localhost:3000" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.newApiUrl" placeholder="请输入您的New API接口地址" />
        </div>
      </div>

      <!-- Model selector -->
      <div v-show="showModel" class="setting-row">
        <span class="setting-label">模型</span>
        <div class="setting-control">
          <el-select v-model="config.model[config.service]" placeholder="请选择模型">
            <el-option class="select-left" v-for="item in modelList" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
      </div>

      <!-- Custom model input -->
      <div v-show="showCustomModel" class="setting-row">
        <span class="setting-label">
          {{ config.service === 'doubao' ? '接入点' : '自定义模型' }}
          <el-tooltip effect="dark"
            :content="config.service === 'doubao' ? '豆包的model为接入点，获取方式见官方文档：https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint' : '注意：自定义模型名称需要与服务商提供的模型名称一致，否则无法使用！'"
            placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-input v-model="config.customModel[config.service]" placeholder="例如：gemma:7b" />
        </div>
      </div>

      <!-- Test connection button -->
      <div v-show="showTestButton" class="setting-row">
        <span class="setting-label">连接测试</span>
        <div class="setting-control">
          <el-button 
            @click="handleTestConnection" 
            :loading="testLoading"
            type="primary"
            size="small"
            plain>
            {{ testLoading ? '测试中...' : '测试连接' }}
          </el-button>
        </div>
      </div>

      <!-- Chrome AI 翻译特殊配置 -->
      <div v-show="showChromeAiConfig" class="chrome-ai-config">
        <!-- 状态显示 -->
        <div class="setting-row">
          <span class="setting-label">
            模型状态
            <el-tooltip effect="dark" content="Chrome 内置 AI 翻译需要下载语言模型。首次使用请点击下方按钮预下载。" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control chrome-ai-status">
            <span v-if="chromeAiAvailability" class="status-text" :class="chromeAiAvailability.status">
              {{ chromeAiAvailability.message }}
            </span>
            <span v-else class="status-text checking">检查中...</span>
          </div>
        </div>

        <!-- 预下载按钮 -->
        <div class="setting-row">
          <span class="setting-label">预下载模型</span>
          <div class="setting-control">
            <el-button
              @click="handleChromeAiPreload"
              :loading="chromeAiPreloading"
              :disabled="chromeAiAvailability?.status === 'available'"
              type="primary"
              size="small"
              plain>
              <template v-if="chromeAiPreloading">
                下载中 {{ chromeAiPreloadProgress }}%
              </template>
              <template v-else-if="chromeAiAvailability?.status === 'available'">
                已就绪 ✓
              </template>
              <template v-else>
                预下载语言模型
              </template>
            </el-button>
          </div>
        </div>

        <!-- 进度条 -->
        <div v-if="chromeAiPreloading" class="setting-row">
          <div class="setting-control setting-control--full">
            <el-progress 
              :percentage="chromeAiPreloadProgress" 
              :stroke-width="8"
              :show-text="false" />
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="chrome-ai-tip">
          <el-icon><ChatDotRound /></el-icon>
          <span>Chrome 内置 AI 翻译需要 Chrome v138+ 浏览器。首次使用需下载语言模型（约几十MB）。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { models, options, services, servicesType, isServiceConfigured } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { testConnection } from '@/entrypoints/utils/testConnection'
import ServiceStatusBadge from './ServiceStatusBadge.vue'

const { config } = useConfig()

const testLoading = ref(false)

// Chrome AI 翻译相关状态
const chromeAiAvailability = ref<{
  available: boolean;
  status: string;
  message: string;
} | null>(null)

const chromeAiPreloading = ref(false)
const chromeAiPreloadProgress = ref(0)

// 检查 Chrome AI 可用性
const checkChromeAiAvailability = async () => {
  try {
    const result = await browser.runtime.sendMessage({
      type: 'CHROME_AI_CHECK_AVAILABILITY',
      sourceLang: 'en',
      targetLang: config.value.to || 'zh-Hans'
    })
    chromeAiAvailability.value = result
  } catch (error) {
    console.error('检查 Chrome AI 可用性失败:', error)
    chromeAiAvailability.value = {
      available: false,
      status: 'unavailable',
      message: '检查失败'
    }
  }
}

// 预下载 Chrome AI 语言模型
const handleChromeAiPreload = async () => {
  if (chromeAiPreloading.value) return
  
  chromeAiPreloading.value = true
  chromeAiPreloadProgress.value = 0

  // 监听进度更新
  const progressHandler = (message: any) => {
    if (message.type === 'CHROME_AI_PRELOAD_PROGRESS') {
      chromeAiPreloadProgress.value = message.progress
    }
  }
  browser.runtime.onMessage.addListener(progressHandler)

  try {
    const result = await browser.runtime.sendMessage({
      type: 'CHROME_AI_PRELOAD_MODEL',
      sourceLang: 'en',
      targetLang: config.value.to || 'zh-Hans'
    })

    if (result.success) {
      ElMessage.success(result.message)
      // 重新检查可用性
      await checkChromeAiAvailability()
    } else {
      ElMessage.error(result.message)
    }
  } catch (error: any) {
    ElMessage.error(`预下载失败: ${error.message || '未知错误'}`)
  } finally {
    browser.runtime.onMessage.removeListener(progressHandler)
    chromeAiPreloading.value = false
  }
}

// 监听服务切换，当选择 Chrome AI 时检查可用性
watch(() => config.value.service, (newService) => {
  if (newService === 'chromeTranslator') {
    checkChromeAiAvailability()
  }
}, { immediate: true })

// Computed properties for conditional display
const showToken = computed(() => servicesType.isUseToken(config.value.service))
const showModel = computed(() => servicesType.isUseModel(config.value.service))
const showProxy = computed(() => servicesType.isUseProxy(config.value.service))
const showAkSk = computed(() => servicesType.isUseAkSk(config.value.service))
const showYoudao = computed(() => servicesType.isYoudao(config.value.service))
const showTencent = computed(() => servicesType.isTencent(config.value.service))
const showRobotId = computed(() => servicesType.isCoze(config.value.service))
const showCustom = computed(() => servicesType.isCustom(config.value.service))
const showDeepLX = computed(() => config.value.service === 'deeplx')
const showCustomModel = computed(() => servicesType.isAI(config.value.service) && config.value.model[config.value.service] === "自定义模型")
const showNewAPI = computed(() => servicesType.isNewApi(config.value.service))
const showAzureOpenaiEndpoint = computed(() => servicesType.isAzureOpenai(config.value.service))

const showTestButton = computed(() => {
  const currentService = config.value.service
  return currentService === services.microsoft || 
         servicesType.isAI(currentService) || 
         currentService === services.deepL
})

// Chrome AI 翻译配置显示
const showChromeAiConfig = computed(() => config.value.service === services.chromeTranslator)

// Model list for the selected service
const modelList = computed(() => models.get(config.value.service) || [])

// Filtered services for the dropdown (hide Google in non-bilingual mode)
const filteredServices = computed(() =>
  options.services.map((service: any) => {
    // Google 只在双语模式下显示
    if (service.value === services.google && config.value.display !== 1) {
      return { ...service, hidden: true }
    }
    // 标记未配置的服务（用于显示提示，但不阻止选择）
    if (!service.disabled && !isServiceConfigured(service.value, config.value)) {
      return { ...service, unconfigured: true }
    }
    return service
  }).filter((service: any) => !service.hidden)
)

// Show service config section when any config field is needed
const showServiceConfig = computed(() =>
  showToken.value ||
  showAzureOpenaiEndpoint.value ||
  showDeepLX.value ||
  showAkSk.value ||
  showYoudao.value ||
  showTencent.value ||
  showRobotId.value ||
  showCustom.value ||
  showNewAPI.value ||
  showModel.value
)

// Azure endpoint validation
const isValidAzureEndpoint = (endpoint: string) => {
  if (!endpoint || endpoint.trim() === '') {
    return false
  }
  const hasHttps = endpoint.startsWith('https://')
  const hasAzureDomain = endpoint.includes('openai.azure.com')
  const hasChatCompletions = endpoint.includes('/chat/completions')
  return hasHttps && hasAzureDomain && hasChatCompletions
}

const handleTestConnection = async () => {
  testLoading.value = true
  try {
    const result = await testConnection(config.value.service, {
      token: config.value.token,
      proxy: config.value.proxy
    })
    
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (error: any) {
    ElMessage.error(`测试失败: ${error.message || '未知错误'}`)
  } finally {
    testLoading.value = false
  }
}
</script>

<style scoped>
/* ===== Select styles ===== */
.select-left {
  text-align: left;
}

.select-divider {
  background: #f2f6fc;
  color: var(--el-color-primary);
  font-size: 12px;
  padding: 4px 12px;
  cursor: default;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid #e4e7ed;
  margin: 4px 0;
  pointer-events: none;
  opacity: 0.9;
}

/* ===== Error styles ===== */
.input-error {
  border-color: var(--el-color-danger) !important;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

/* ===== Service config container ===== */
.service-config {
  margin-top: 8px;
  border-top: 1px solid var(--fr-section-border);
}

/* ===== Unconfigured service styles ===== */
.unconfigured-service {
  color: var(--el-text-color-placeholder);
}

.unconfigured-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: 4px;
}

/* ===== Chrome AI 配置 ===== */
.chrome-ai-config {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fr-section-border);
}

.chrome-ai-status {
  display: flex;
  align-items: center;
}

.status-text {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 4px;
}

.status-text.available {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.status-text.downloadable,
.status-text.downloading {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.status-text.unavailable,
.status-text.not-supported {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.status-text.checking {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.chrome-ai-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.chrome-ai-tip .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>