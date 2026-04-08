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
            :label="item.label" :value="item.value" :disabled="item.disabled"
            :class="{ 'select-divider': item.disabled }" />
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
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { models, options, services, servicesType } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { testConnection } from '@/entrypoints/utils/testConnection'
import ServiceStatusBadge from './ServiceStatusBadge.vue'

const { config } = useConfig()

const testLoading = ref(false)

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

// Model list for the selected service
const modelList = computed(() => models.get(config.value.service) || [])

// Filtered services for the dropdown (hide Google in non-bilingual mode)
const filteredServices = computed(() =>
  options.services.filter((service: any) =>
    !([service.google].includes(service.value) && config.value.display !== 1))
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
/* ===== Setting row ===== */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 10px;
  background: var(--fr-bg-color);
  transition: background 0.15s;
  min-height: 40px;
}

.setting-row:not(:last-child) {
  border-bottom: 1px solid var(--fr-row-border);
}

.setting-row:hover {
  background: var(--fr-row-hover-bg);
}

.setting-row--col {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.setting-label {
  font-size: 13.5px;
  color: var(--fr-label-color);
  font-weight: 450;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.info-icon {
  color: var(--fr-info-icon-color);
  font-size: 13px;
  cursor: help;
  flex-shrink: 0;
}

.setting-control {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  min-width: 0;
  max-width: 165px;
}

.setting-control--full {
  width: 100%;
  max-width: 100%;
  align-items: flex-start;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

/* ===== Select styles ===== */
.select-left {
  text-align: left;
}

.select-divider {
  background: #f2f6fc;
  color: #409eff;
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
</style>