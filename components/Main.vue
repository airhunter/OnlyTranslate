<template>

  <!-- ===== Header ===== -->
  <div class="popup-header">
    <div class="header-brand">
      <div class="header-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </svg>
      </div>
      <span class="header-name">只译</span>
      <span class="header-version">v{{ appVersion }}</span>
    </div>
    <div class="header-right">
      <span class="status-text" :class="config.on ? 'status-on' : 'status-off'">
        {{ config.on ? '已启用' : '已禁用' }}
      </span>
      <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
    </div>
  </div>

  <!-- ===== Body ===== -->
  <div class="popup-body">

    <!-- 插件禁用占位 -->
    <div v-if="!config.on" class="disabled-state">
      <el-empty description="插件处于禁用状态" :image-size="60" />
    </div>

    <div v-show="config.on" class="sections-wrapper">

      <!-- Section: 翻译设置 -->
      <div class="section">
        <div class="section-title">翻译设置</div>

        <!-- 翻译模式 -->
        <div class="setting-row">
          <span class="setting-label">翻译模式</span>
          <div class="setting-control">
            <el-select v-model="config.display" placeholder="请选择翻译模式">
              <el-option class="select-left" v-for="item in options.display" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>

        <!-- 译文样式 -->
        <div v-show="config.display === 1" class="setting-row">
          <span class="setting-label">
            译文样式
            <el-tooltip effect="dark" content="选择双语模式下译文的显示样式，提供多种美观的效果" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.style" placeholder="请选择译文显示样式">
              <el-option-group v-for="group in styleGroups" :key="group.value" :label="group.label">
                <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value" :class="item.class" />
              </el-option-group>
            </el-select>
          </div>
        </div>

        <!-- 翻译服务 -->
        <div class="setting-row">
          <span class="setting-label">
            翻译服务
            <el-tooltip effect="dark" content="机器翻译：快速稳定，适合日常使用；AI翻译：更自然流畅，需要配置令牌" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.service" placeholder="请选择翻译服务">
              <el-option class="select-left" v-for="item in compute.filteredServices" :key="item.value"
                :label="item.label" :value="item.value" :disabled="item.disabled"
                :class="{ 'select-divider': item.disabled }" />
            </el-select>
          </div>
        </div>

        <!-- 目标语言 -->
        <div class="setting-row">
          <span class="setting-label">目标语言</span>
          <div class="setting-control">
            <el-select v-model="config.to" placeholder="请选择目标语言">
              <el-option class="select-left" v-for="item in options.to" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- Section: 服务配置（按需显示） -->
      <div class="section" v-show="showServiceConfig">
        <div class="section-title">服务配置</div>

        <!-- 访问令牌 -->
        <div v-show="compute.showToken" class="setting-row">
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

        <!-- Azure OpenAI 端点 -->
        <div v-show="compute.showAzureOpenaiEndpoint" class="setting-row setting-row--col">
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
        <div v-show="compute.showDeepLX" class="setting-row">
          <span class="setting-label">服务地址</span>
          <div class="setting-control">
            <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
          </div>
        </div>

        <!-- AkSk -->
        <div v-show="compute.showAkSk" class="setting-row">
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
        <div v-show="compute.showAkSk" class="setting-row">
          <span class="setting-label">Secret Key</span>
          <div class="setting-control">
            <el-input v-model="config.sk" type="password" placeholder="请输入Secret Key" />
          </div>
        </div>

        <!-- 有道翻译 -->
        <div v-show="compute.showYoudao" class="setting-row">
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
        <div v-show="compute.showYoudao" class="setting-row">
          <span class="setting-label">App Secret</span>
          <div class="setting-control">
            <el-input v-model="config.youdaoAppSecret" type="password" show-password placeholder="有道 AppSecret" />
          </div>
        </div>

        <!-- 腾讯云 -->
        <div v-show="compute.showTencent" class="setting-row">
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
        <div v-show="compute.showTencent" class="setting-row">
          <span class="setting-label">Secret Key</span>
          <div class="setting-control">
            <el-input v-model="config.tencentSecretKey" type="password" show-password placeholder="腾讯云 SecretKey" />
          </div>
        </div>

        <!-- Coze 机器人ID -->
        <div v-show="compute.showRobotId" class="setting-row">
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

        <!-- 自定义接口 -->
        <div v-show="compute.showCustom" class="setting-row">
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

        <!-- NewAPI 接口 -->
        <div v-show="compute.showNewAPI" class="setting-row">
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

        <!-- 模型 -->
        <div v-show="compute.showModel" class="setting-row">
          <span class="setting-label">模型</span>
          <div class="setting-control">
            <el-select v-model="config.model[config.service]" placeholder="请选择模型">
              <el-option class="select-left" v-for="item in compute.model" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
        </div>

        <!-- 自定义模型 / 接入点 -->
        <div v-show="compute.showCustomModel" class="setting-row">
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
      </div>

      <!-- Section: 快捷操作 -->
      <div class="section">
        <div class="section-title">快捷操作</div>

        <!-- 鼠标悬浮快捷键 -->
        <div class="setting-row" :class="{ 'setting-row--expanded': config.hotkey === 'custom' }">
          <span class="setting-label">
            鼠标悬浮
            <el-tooltip effect="dark" content="按住指定快捷键并悬停在文本上进行翻译" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control" :class="{ 'setting-control--full': config.hotkey === 'custom' }">
            <div class="hotkey-config">
              <el-select v-model="config.hotkey" placeholder="请选择快捷键" size="small" style="width: 100%" @change="handleMouseHotkeyChange">
                <el-option v-for="item in options.keys" :key="item.value" :label="item.label" :value="item.value"
                  :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
              </el-select>
              <div v-if="config.hotkey === 'custom'" class="custom-hotkey-display">
                <span class="hotkey-text" v-if="config.customHotkey">{{ getCustomMouseHotkeyDisplayName() }}</span>
                <span class="hotkey-text placeholder-text" v-else>点击设置自定义快捷键</span>
                <el-button size="small" type="text" @click="openCustomMouseHotkeyDialog" class="edit-button">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 全文翻译快捷键 -->
        <div v-if="config.on" class="setting-row" :class="{ 'setting-row--expanded': config.floatingBallHotkey === 'custom' }">
          <span class="setting-label">
            全文快捷键
            <el-tooltip effect="dark" content="（测试版）设置快捷键以便快速切换全文翻译状态，无需鼠标点击悬浮球" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control" :class="{ 'setting-control--full': config.floatingBallHotkey === 'custom' }">
            <div class="hotkey-config">
              <el-select v-model="config.floatingBallHotkey" placeholder="选择快捷键" size="small" style="width: 100%" @change="handleHotkeyChange">
                <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display">
                <span class="hotkey-text" v-if="config.customFloatingBallHotkey">{{ getCustomHotkeyDisplayName() }}</span>
                <span class="hotkey-text placeholder-text" v-else>点击设置自定义快捷键</span>
                <el-button size="small" type="text" @click="openCustomHotkeyDialog" class="edit-button">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 划词翻译 -->
        <div v-if="config.on" class="setting-row">
          <span class="setting-label">
            划词翻译
            <el-tooltip effect="dark" content="选中文本后显示蓝点，鼠标移到蓝点上查看翻译结果。可选择关闭、双语显示或只显示译文" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.selectionTranslatorMode" placeholder="选择模式">
              <el-option label="关闭" value="disabled" />
              <el-option label="双语显示" value="bilingual" />
              <el-option label="只显示译文" value="translation-only" />
            </el-select>
          </div>
        </div>

        <!-- 视频字幕翻译 -->
        <div v-if="config.on" class="setting-row">
          <span class="setting-label">
            视频字幕
            <el-tooltip effect="dark" content="在 YouTube 等平台上，开启原生字幕后自动翻译并以双语形式叠加显示（需先在视频播放器中开启字幕）" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><ChatDotRound /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--switch">
            <el-switch v-model="config.enableVideoSubtitle" inline-prompt active-text="开" inactive-text="关" />
          </div>
        </div>
      </div>

      <!-- 高级选项 collapse -->
      <el-collapse class="advanced-collapse">
        <el-collapse-item title="高级选项">

          <!-- 主题设置 -->
          <div class="setting-row">
            <span class="setting-label">主题设置</span>
            <div class="setting-control">
              <el-select v-model="config.theme" placeholder="请选择主题模式">
                <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>

          <!-- 缓存翻译结果 -->
          <div class="setting-row">
            <span class="setting-label">
              缓存翻译
              <el-tooltip effect="dark" content="开启缓存可以提高翻译速度，减少重复请求，但可能导致翻译结果不是最新的" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--switch">
              <el-switch v-model="config.useCache" inline-prompt active-text="启用" inactive-text="禁用" />
            </div>
          </div>

          <!-- 全文翻译悬浮球 -->
          <div v-if="config.on" class="setting-row">
            <span class="setting-label">
              全文悬浮球
              <el-tooltip effect="dark" content="（测试版）控制是否显示屏幕边缘的即时翻译悬浮球，用于对整个网页进行翻译" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--switch">
              <el-switch v-model="floatingBallEnabled" inline-prompt active-text="启用" inactive-text="禁用" />
            </div>
          </div>

          <!-- 翻译进度面板 -->
          <div class="setting-row">
            <span class="setting-label">
              进度面板
              <el-tooltip effect="dark" content="翻译进度面板（默认关）：关闭后将不再显示右下角的全文翻译进度面板，适合移动端或希望更少打扰的用户。" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--switch">
              <el-switch v-model="config.translationStatus" inline-prompt active-text="启动" inactive-text="禁用" />
            </div>
          </div>

          <!-- 动画效果 -->
          <div class="setting-row">
            <span class="setting-label">
              动画效果
              <el-tooltip effect="dark" content="动画效果（默认开）：禁用后将关闭加载/悬浮等动画，以节省GPU资源和电量。适合低配置设备或希望节省资源的用户。" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--switch">
              <el-switch v-model="config.animations" inline-prompt active-text="启动" inactive-text="禁用" />
            </div>
          </div>

          <!-- 输入框翻译 -->
          <div class="setting-row">
            <span class="setting-label">
              输入框翻译
              <el-tooltip effect="dark" content="输入框翻译：在任何文本输入框中使用指定方式触发翻译当前输入的内容。" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control">
              <el-select v-model="config.inputBoxTranslationTrigger" placeholder="请选择触发方式">
                <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value"
                  :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>

          <!-- 输入框翻译目标语言 -->
          <div v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="setting-row">
            <span class="setting-label">翻译目标语言</span>
            <div class="setting-control">
              <el-select v-model="config.inputBoxTranslationTarget" placeholder="请选择目标语言">
                <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value"
                  :label="item.label" :value="item.value" />
              </el-select>
            </div>
          </div>

          <!-- 翻译并发数 -->
          <div class="setting-row">
            <span class="setting-label">
              翻译并发数
              <el-tooltip effect="dark" content="控制同时进行的最大翻译任务数，数值越高翻译速度越快，但可能占用更多系统资源" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control">
              <el-input-number v-model="config.maxConcurrentTranslations" :min="1" :max="100" :step="1"
                style="width: 100%" @change="handleConcurrentChange" controls-position="right" />
            </div>
          </div>

          <!-- 代理地址 -->
          <div v-show="compute.showProxy" class="setting-row">
            <span class="setting-label">
              代理地址
              <el-tooltip effect="dark" content="使用代理可以解决网络无法访问的问题，如不熟悉代理设置请留空！" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control">
              <el-input v-model="config.proxy[config.service]" placeholder="默认不使用代理" />
            </div>
          </div>

          <!-- AI system 提示词 -->
          <div v-show="compute.showAI" class="setting-row setting-row--col">
            <span class="setting-label">
              system 提示词
              <el-tooltip effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--full">
              <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" placeholder="system message" />
            </div>
          </div>

          <!-- AI user 模板 -->
          <div v-show="compute.showAI" class="setting-row setting-row--col">
            <span class="setting-label">
              user 模板
              <el-tooltip effect="dark" content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。" placement="top-start" :show-after="500">
                <el-icon class="info-icon"><ChatDotRound /></el-icon>
              </el-tooltip>
            </span>
            <div class="setting-control setting-control--full">
              <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" placeholder="user message template" />
            </div>
          </div>

          <!-- 恢复默认模板 -->
          <div v-show="compute.showAI" class="setting-row" style="justify-content: flex-end;">
            <el-button type="primary" link @click="resetTemplate">
              <el-icon><Refresh /></el-icon>
              恢复默认模板
            </el-button>
          </div>

          <!-- 配置管理 -->
          <div class="config-mgmt">
            <div class="config-mgmt-title">配置管理</div>
            <div class="config-mgmt-btns">
              <el-button type="primary" @click="handleExport">
                <el-icon><Download /></el-icon>导出配置
              </el-button>
              <el-button type="success" @click="handleImport">
                <el-icon><Upload /></el-icon>导入配置
              </el-button>
            </div>
          </div>

          <div v-if="showExportBox" class="setting-row setting-row--col">
            <el-input v-model="exportData" type="textarea" :rows="6" readonly />
          </div>
          <div v-if="showImportBox" class="setting-row setting-row--col">
            <el-input v-model="importData" type="textarea" :rows="6" placeholder="请在此处粘贴您的JSON配置" />
            <div style="margin-top: 8px; text-align: right;">
              <el-button @click="saveImport">保存</el-button>
            </div>
          </div>

        </el-collapse-item>
      </el-collapse>

    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div class="popup-footer">
    <el-button class="footer-btn cache-btn" :type="cacheBtnType" :loading="cacheLoading"
      :disabled="cacheBtnDisabled" size="small" @click="clearCache">
      {{ cacheBtnText }}
    </el-button>
    <button class="footer-btn settings-link" @click="openSettingsPage">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
      </svg>
      更多设置
    </button>
  </div>

  <!-- 自定义快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomHotkeyDialog"
    :current-value="config.customFloatingBallHotkey"
    @confirm="handleCustomHotkeyConfirm"
    @cancel="handleCustomHotkeyCancel"
  />

  <!-- 自定义鼠标悬浮快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomMouseHotkeyDialog"
    :current-value="config.customHotkey"
    @confirm="handleCustomMouseHotkeyConfirm"
    @cancel="handleCustomMouseHotkeyCancel"
  />

</template>

<script lang="ts" setup>

// Main 处理配置信息
import { computed, ref, watch, onUnmounted } from 'vue'
import { models, options, servicesType, defaultOption } from "../entrypoints/utils/option";
import { Config } from "@/entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import { ChatDotRound, Refresh, Edit, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElInputNumber } from 'element-plus'
import browser from 'webextension-polyfill';
import { defineAsyncComponent } from 'vue';
const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'));
import { parseHotkey } from '@/entrypoints/utils/hotkey';

// 应用版本号
const appVersion = browser.runtime.getManifest().version;

// 初始化深色模式媒体查询
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 更新主题函数
function updateTheme(theme: string) {
  if (theme === 'auto') {
    // 自动模式下，直接使用系统主题
    const isDark = darkModeMediaQuery.matches;
    console.log('isDark', isDark);

    document.documentElement.classList.toggle('dark', isDark);
  } else {
    // 手动模式下，使用选择的主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// 配置信息
let config = ref(new Config());

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config.value, parsedConfig);
  }
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
});

// 监听 storage 中 'local:config' 的变化
// 当其他页面修改了配置时,会触发这个监听器
// newValue 是新的配置值,oldValue 是旧的配置值
storage.watch('local:config', (newValue: any, oldValue: any) => {
  // 检查 newValue 是否为非空字符串
  if (typeof newValue === 'string' && newValue) {
    // 将新的配置值解析为对象,并合并到当前的 config.value 中
    // 这样可以保持所有页面的配置同步
    Object.assign(config.value, JSON.parse(newValue));
  }
});

// 监听菜单栏配置变化
// 当配置发生改变时,将新的配置序列化为 JSON 字符串并保存到 storage 中
// deep: true 表示深度监听对象内部属性的变化
watch(config, (newValue: any, oldValue: any) => {
  // TODO 监听配置变化，显示刷新提示
  storage.setItem('local:config', JSON.stringify(newValue));
}, { deep: true });

// 计算属性
let compute = ref({
  // 1、是否是AI服务
  showAI: computed(() => servicesType.isAI(config.value.service)),
  // 2、是否是机器翻译
  showMachine: computed(() => servicesType.isMachine(config.value.service)),
  // 3、是否显示代理
  showProxy: computed(() => servicesType.isUseProxy(config.value.service)),
  // 4、是否显示模型
  showModel: computed(() => servicesType.isUseModel(config.value.service)),
  // 5、是否显示token
  showToken: computed(() => servicesType.isUseToken(config.value.service)),
  // 6、是否显示 AkSk
  showAkSk: computed(() => servicesType.isUseAkSk(config.value.service)),
  // 6.5、是否显示有道翻译配置
  showYoudao: computed(() => servicesType.isYoudao(config.value.service)),
  // 6.6、是否显示腾讯云机器翻译配置
  showTencent: computed(() => servicesType.isTencent(config.value.service)),
  // 7、获取模型列表
  model: computed(() => models.get(config.value.service) || []),
  // 8、是否需要自定义接口
  showCustom: computed(() => servicesType.isCustom(config.value.service)),
  // 9、是否显示 DeepLX URL 配置
  showDeepLX: computed(() => config.value.service === 'deeplx'),
  // 10、是否自定义模型
  showCustomModel: computed(() => servicesType.isAI(config.value.service) && config.value.model[config.value.service] === "自定义模型"),
  // 11、判断是否为"双语模式"，控制一些翻译服务的显示
  filteredServices: computed(() => options.services.filter((service: any) =>
    !([service.google].includes(service.value) && config.value.display !== 1))
  ),
  // 12、判断是否为 coze
  showRobotId: computed(() => servicesType.isCoze(config.value.service)),
  // 13、是否显示New API配置
  showNewAPI: computed(() => servicesType.isNewApi(config.value.service)),
  // 14、是否显示Azure OpenAI端点配置
  showAzureOpenaiEndpoint: computed(() => servicesType.isAzureOpenai(config.value.service)),
})

// 服务配置 section 整体显示控制
const showServiceConfig = computed(() =>
  compute.value.showToken ||
  compute.value.showAzureOpenaiEndpoint ||
  compute.value.showDeepLX ||
  compute.value.showAkSk ||
  compute.value.showYoudao ||
  compute.value.showTencent ||
  compute.value.showRobotId ||
  compute.value.showCustom ||
  compute.value.showNewAPI ||
  compute.value.showModel
)

// 监听主题变化
watch(() => config.value.theme, (newTheme) => {
  updateTheme(newTheme || 'auto');
});

// 使用 onchange 监听系统主题变化
darkModeMediaQuery.onchange = (e) => {
  if (config.value.theme === 'auto') {
    updateTheme('auto');
  }
};

// 组件卸载时清理
onUnmounted(() => {
  darkModeMediaQuery.onchange = null;
});

// 计算样式分组
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled);
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }));
});

// 恢复默认模板
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role;
    config.value.user_role[config.value.service] = defaultOption.user_role;
    ElMessage({
      message: '已成功恢复默认翻译模板',
      type: 'success',
      duration: 2000
    });
  }).catch(() => {
    // 用户取消操作，不做任何处理
  });
};

// 悬浮球开关的计算属性
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall && config.value.on,
  set: (value) => {
    config.value.disableFloatingBall = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'toggleFloatingBall',
            isEnabled: value
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// 监听划词翻译模式变化
watch(() => config.value.selectionTranslatorMode, (newMode) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, {
          type: 'updateSelectionTranslatorMode',
          mode: newMode
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
});

// 监听开关变化
const handleSwitchChange = () => {
  showRefreshTip.value = true;
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被开启，恢复悬浮球为启用状态
  if (val) {
    config.value.disableFloatingBall = false;
    // 向所有激活的标签页发送消息，开启悬浮球
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'toggleFloatingBall',
            isEnabled: true
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
    return;
  }

  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
      // 向所有激活的标签页发送消息，关闭悬浮球
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }

    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      // 向所有激活的标签页发送消息，关闭划词翻译
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
  }
};

// 处理悬浮球开关变化
const toggleFloatingBall = (val: boolean) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, {
          type: 'toggleFloatingBall',
          isEnabled: val
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
};

// 自定义快捷键相关
const showCustomHotkeyDialog = ref(false);
const showCustomMouseHotkeyDialog = ref(false);

// 配置导入导出相关
const showExportConfig = ref(false);
const showImportConfig = ref(false);
const exportedConfig = ref('');
const importConfigText = ref('');
const importLoading = ref(false);

// 处理快捷键选择变化
const handleHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customFloatingBallHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义快捷键对话框
const openCustomHotkeyDialog = () => {
  showCustomHotkeyDialog.value = true;
};

// 确认自定义快捷键
const handleCustomHotkeyConfirm = (hotkey: string) => {
  config.value.customFloatingBallHotkey = hotkey;
  config.value.floatingBallHotkey = 'custom';

  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义快捷键
const handleCustomHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customFloatingBallHotkey) {
    config.value.floatingBallHotkey = 'Alt+T';
  }
};

// 获取自定义快捷键显示名称
const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return '';

  if (config.value.customFloatingBallHotkey === 'none') {
    return '已禁用';
  }

  const parsed = parseHotkey(config.value.customFloatingBallHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey;
};

// 处理鼠标悬浮快捷键选择变化
const handleMouseHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomMouseHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义鼠标悬浮快捷键对话框
const openCustomMouseHotkeyDialog = () => {
  showCustomMouseHotkeyDialog.value = true;
};

// 确认自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyConfirm = (hotkey: string) => {
  config.value.customHotkey = hotkey;
  config.value.hotkey = 'custom';

  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomMouseHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customHotkey) {
    config.value.hotkey = 'Control';
  }
};

// 获取自定义鼠标悬浮快捷键显示名称
const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return '';

  if (config.value.customHotkey === 'none') {
    return '已禁用';
  }

  const parsed = parseHotkey(config.value.customHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customHotkey;
};

// 处理并发数量变化
const handleConcurrentChange = (currentValue: number | undefined, oldValue: number | undefined) => {
  // 验证并发数量的有效性
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({
      message: '并发数量必须在 1-100 之间',
      type: 'warning',
      duration: 2000
    });
    // 恢复默认值
    config.value.maxConcurrentTranslations = 6;
    return;
  }

  // 显示设置已更新的提示
  showRefreshTip.value = true;

  ElMessage({
    message: `并发数量已更新为 ${currentValue}`,
    type: 'success',
    duration: 2000
  });
};

// 显示刷新提示
const showRefreshTip = ref(false);

// 刷新页面
const refreshPage = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browser.tabs.reload(tabs[0].id);
    showRefreshTip.value = false; // 刷新后隐藏提示
  }
};

const showExportBox = ref(false);
const exportData = ref('');
const showImportBox = ref(false);
const importData = ref('');

// Azure OpenAI 端点地址验证函数
const isValidAzureEndpoint = (endpoint: string) => {
  if (!endpoint || endpoint.trim() === '') {
    return false;
  }

  // 检查是否包含必要的组件
  const hasAzureDomain = endpoint.includes('openai.azure.com');
  const hasChatCompletions = endpoint.includes('/chat/completions');
  const hasHttps = endpoint.startsWith('https://');

  return hasHttps && hasAzureDomain && hasChatCompletions;
};

const handleExport = async () => {
  const configStr = await storage.getItem('local:config');
  if (!configStr) {
    ElMessage({
      message: '没有找到配置信息',
      type: 'warning',
    });
    return;
  }

  const configToExport = JSON.parse(configStr as string);

  // Create a deep copy to avoid modifying the actual config
  const cleanedConfig = JSON.parse(JSON.stringify(configToExport));

  // Clean system_role and user_role if they are default
  if (cleanedConfig.system_role) {
    for (const service in cleanedConfig.system_role) {
      if (cleanedConfig.system_role[service] === defaultOption.system_role) {
        delete cleanedConfig.system_role[service];
      }
    }
    if (Object.keys(cleanedConfig.system_role).length === 0) {
      delete cleanedConfig.system_role;
    }
  }

  if (cleanedConfig.user_role) {
    for (const service in cleanedConfig.user_role) {
      if (cleanedConfig.user_role[service] === defaultOption.user_role) {
        delete cleanedConfig.user_role[service];
      }
    }
    if (Object.keys(cleanedConfig.user_role).length === 0) {
      delete cleanedConfig.user_role;
    }
  }

  exportData.value = JSON.stringify(cleanedConfig, null, 2);
  showExportBox.value = !showExportBox.value;
  showImportBox.value = false;
};

const handleImport = () => {
  showImportBox.value = !showImportBox.value;
  showExportBox.value = false;
};

const saveImport = async () => {
  try {
    const parsedConfig = JSON.parse(importData.value);
    // Add validation here
    if (!validateConfig(parsedConfig)) {
      ElMessage({
        message: '配置无效或格式不正确, 请检查!',
        type: 'error',
      });
      return;
    }
    await storage.setItem('local:config', JSON.stringify(parsedConfig));
    ElMessage({
      message: '配置导入成功!',
      type: 'success',
    });
    showImportBox.value = false;
    importData.value = '';
    // Optionally, reload the extension or relevant parts
  } catch (e) {
    ElMessage({
      message: '配置格式错误, 请检查!',
      type: 'error',
    });
  }
};


// 切换导出配置显示
const toggleExportConfig = async () => {
  if (showExportConfig.value) {
    // 如果已经显示，则隐藏
    showExportConfig.value = false;
    exportedConfig.value = '';
  } else {
    // 如果未显示，则显示并生成配置
    try {
      // 确保从storage获取最新的配置
      const latestConfig = await storage.getItem('local:config');
      let configToExport;

      if (latestConfig && typeof latestConfig === 'string') {
        // 使用storage中的最新配置
        configToExport = JSON.parse(latestConfig);
      } else {
        // 如果storage中没有，使用当前config.value
        configToExport = JSON.parse(JSON.stringify(config.value));
      }

      exportedConfig.value = JSON.stringify(configToExport, null, 2);
      showExportConfig.value = true;

      ElMessage({
        message: '配置已生成，请复制保存',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      ElMessage({
         message: '导出配置失败：' + ((error as Error)?.message || '未知错误'),
         type: 'error',
         duration: 3000
       });
    }
  }
};

// 复制导出的配置到剪贴板
const copyExportedConfig = async () => {
  try {
    await navigator.clipboard.writeText(exportedConfig.value);
    ElMessage({
      message: '配置已复制到剪贴板',
      type: 'success',
      duration: 2000
    });
  } catch (error) {
    ElMessage({
      message: '复制失败，请手动复制',
      type: 'warning',
      duration: 2000
    });
  }
};

// 切换导入配置显示
const toggleImportConfig = () => {
  if (showImportConfig.value) {
    // 如果已经显示，则隐藏并清空内容
    showImportConfig.value = false;
    importConfigText.value = '';
  } else {
    // 如果未显示，则显示
    showImportConfig.value = true;
    importConfigText.value = '';
  }
};

// 取消导入
const cancelImport = () => {
  // 清空输入框并隐藏导入区域
  importConfigText.value = '';
  showImportConfig.value = false;
  importLoading.value = false;
};

// 导入配置
const importConfig = async () => {
  if (!importConfigText.value.trim()) {
    ElMessage({
      message: '请输入配置内容',
      type: 'warning',
      duration: 2000
    });
    return;
  }

  importLoading.value = true;

  try {
    // 解析JSON配置
    const importedConfig = JSON.parse(importConfigText.value);

    // 验证配置格式
    if (!validateConfig(importedConfig)) {
      throw new Error('配置格式不正确');
    }

    // 确认导入
    await ElMessageBox.confirm(
      '导入配置将覆盖当前所有设置，确定要继续吗？',
      '确认导入',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 应用新配置
    Object.assign(config.value, importedConfig);

    // 保存到storage
    await storage.setItem('local:config', JSON.stringify(config.value));

    // 隐藏导入区域并清空输入
    showImportConfig.value = false;
    importConfigText.value = '';

    ElMessage({
      message: '配置导入成功',
      type: 'success',
      duration: 2000
    });

  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage({
        message: '导入失败：' + ((error as Error).message || '配置格式错误'),
        type: 'error',
        duration: 3000
      });
    }
  } finally {
    importLoading.value = false;
  }
};

// 验证配置格式
const validateConfig = (configData: any): boolean => {
  try {
    // 检查是否是对象
    if (typeof configData !== 'object' || configData === null) {
      return false;
    }

    // 检查必要的配置字段
    const requiredFields = ['on', 'service', 'display', 'from', 'to'];
    for (const field of requiredFields) {
      if (!(field in configData)) {
        return false;
      }
    }

    // 检查服务配置
    if (typeof configData.service !== 'string') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

// ===== Footer: 清除缓存 =====
const cacheBtnDisabled = ref(false);
const cacheBtnText = ref('清除翻译缓存');
const cacheLoading = ref(false);
const cacheStatus = ref<'idle' | 'success' | 'failed'>('idle');

const cacheBtnType = computed(() => {
  if (cacheStatus.value === 'success') return 'success';
  if (cacheStatus.value === 'failed') return 'danger';
  return 'default';
});

async function clearCache() {
  try {
    cacheBtnDisabled.value = true;
    cacheLoading.value = true;
    cacheBtnText.value = '正在清除...';
    cacheStatus.value = 'idle';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) throw new Error('No active tab found');
    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    cacheStatus.value = 'success';
    cacheBtnText.value = '清除成功';
  } catch (error) {
    console.error('清除缓存失败:', error);
    cacheStatus.value = 'failed';
    cacheBtnText.value = '清除失败';
  } finally {
    cacheLoading.value = false;
    setTimeout(() => {
      cacheBtnDisabled.value = false;
      cacheBtnText.value = '清除翻译缓存';
      cacheStatus.value = 'idle';
    }, 1500);
  }
}

// ===== Footer: 打开设置页 =====
function openSettingsPage() {
  browser.runtime.sendMessage({ type: 'openOptionsPage' });
}

</script>

<style scoped>

/* ===== Header ===== */
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 11px;
  border-bottom: 1px solid var(--fr-header-border);
  background: var(--fr-bg-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 26px;
  height: 26px;
  background: #5BB5F5;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-icon svg {
  width: 15px;
  height: 15px;
}

.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  letter-spacing: 0.3px;
}

.header-version {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  opacity: 0.7;
  margin-top: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
}

.status-on {
  color: #67c23a;
}

.status-off {
  color: #909399;
}

/* ===== Body ===== */
.popup-body {
  padding: 10px 10px 6px;
  overflow-y: auto;
  max-height: 480px;
}

.popup-body::-webkit-scrollbar {
  width: 4px;
}

.popup-body::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 2px;
}

.dark .popup-body::-webkit-scrollbar-thumb {
  background: #333;
}

.disabled-state {
  padding: 20px 0;
}

.sections-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== Section card ===== */
.section {
  border: 1px solid var(--fr-section-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--fr-bg-color);
}

.section-title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--fr-text-color-regular);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 6px 12px 5px;
  background: var(--fr-section-title-bg);
  border-bottom: 1px solid var(--fr-section-title-border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 10px;
  background: #5BB5F5;
  border-radius: 2px;
  flex-shrink: 0;
}

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

.setting-row--expanded {
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

.setting-control--switch {
  max-width: none;
  flex-direction: row;
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

/* ===== Advanced collapse ===== */
.advanced-collapse {
  border: 1px solid var(--fr-section-border);
  border-radius: 10px;
  overflow: hidden;
}

:deep(.advanced-collapse .el-collapse-item__header) {
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  height: 40px;
  background: var(--fr-section-title-bg);
  color: var(--fr-text-color-regular);
  border-bottom: none;
}

:deep(.advanced-collapse .el-collapse-item__content) {
  padding: 0;
  background: var(--fr-bg-color);
}

:deep(.advanced-collapse .el-collapse-item__wrap) {
  border-bottom: none;
}

:deep(.advanced-collapse .el-collapse) {
  border: none;
}

/* ===== Config management ===== */
.config-mgmt {
  padding: 10px 12px 8px;
  border-top: 1px solid var(--fr-section-title-border);
  margin-top: 4px;
}

.config-mgmt-title {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-mgmt-btns {
  display: flex;
  gap: 8px;
}

.config-mgmt-btns .el-button {
  flex: 1;
}

/* ===== Footer ===== */
.popup-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--fr-footer-border);
  background: var(--fr-bg-color);
}

.footer-btn {
  flex: 1;
}

.settings-link {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 12.5px;
  color: #5BB5F5;
  cursor: pointer;
  background: none;
  border: 1px solid #d9ecff;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.settings-link:hover {
  background: #f0f8ff;
  border-color: #b3d8ff;
}

.dark .settings-link {
  border-color: #1a3a55;
}

.dark .settings-link:hover {
  background: #1e2a38;
  border-color: #2a4a6a;
}

/* ===== Select & Input ===== */
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

/* ===== Hotkey custom display ===== */
.hotkey-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.custom-hotkey-display {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  font-size: 12px;
  height: 32px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.hotkey-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  color: var(--el-color-primary);
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: calc(100% - 32px);
}

.edit-button {
  padding: 2px 4px;
  margin-left: 4px;
  color: var(--el-color-primary);
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background: var(--el-color-primary-light-8);
}

.edit-button .el-icon {
  font-size: 12px;
}

.placeholder-text {
  color: var(--el-text-color-placeholder) !important;
  font-style: italic;
  font-family: inherit !important;
  font-weight: normal !important;
}

/* ===== Error ===== */
.input-error {
  border-color: var(--el-color-danger) !important;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

</style>
