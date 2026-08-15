<template>
  <div class="interaction-group">
    <!-- 卡片1：网页划词协作 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.interaction.selectionTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.interaction.selectionDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.interaction.selectionTranslator') }}
            <el-tooltip effect="dark" :content="t('options.interaction.selectionTranslatorTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.selectionTranslatorMode" :placeholder="t('options.interaction.selectMode')">
              <el-option :label="t('options.interaction.disabled')" value="disabled" />
              <el-option :label="t('options.interaction.bilingual')" value="bilingual" />
              <el-option :label="t('options.interaction.translationOnly')" value="translation-only" />
            </el-select>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.interaction.animations') }}
            <el-tooltip effect="dark" :content="t('options.interaction.animationsTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--switch">
            <el-switch v-model="config.animations" />
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片2：语音设置 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.interaction.voiceTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.interaction.voiceDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row voice-setting-row">
          <span class="setting-label">{{ t('options.interaction.voiceEngine') }}</span>
          <div class="setting-control voice-setting-control voice-engine-control">
            <el-select v-model="config.ttsEngine">
              <el-option :label="t('options.interaction.systemVoiceRecommended')" value="system" />
              <el-option :label="t('options.interaction.edgeOnlineVoice')" value="edge" />
            </el-select>
          </div>
        </div>

        <div class="setting-row voice-setting-row">
          <span class="setting-label">{{ t('options.interaction.voiceTone') }}</span>
          <div class="setting-control voice-setting-control voice-control">
            <el-select v-if="config.ttsEngine === 'edge'" v-model="config.ttsVoiceGender">
              <el-option :label="t('options.interaction.autoVoice')" value="auto" />
              <el-option :label="t('options.interaction.femaleVoice')" value="female" />
              <el-option :label="t('options.interaction.maleVoice')" value="male" />
            </el-select>
            <span v-else class="auto-voice-label" :title="t('options.interaction.autoVoice')">
              {{ t('options.interaction.autoVoice') }}
            </span>
            <el-button :loading="isPreviewingVoice" @click="previewVoice">
              {{ t('options.interaction.previewVoice') }}
            </el-button>
          </div>
        </div>

        <p v-if="config.ttsEngine === 'edge'" class="edge-voice-privacy-notice">
          {{ t('options.interaction.edgeVoicePrivacyNotice') }}
        </p>
      </div>
    </div>

    <!-- 卡片3：输入框增强 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.interaction.inputTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.interaction.inputDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">
            {{ t('options.interaction.inputTranslation') }}
            <el-tooltip effect="dark" :content="t('options.interaction.inputTranslationTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control">
            <el-select v-model="config.inputBoxTranslationTrigger" :placeholder="t('options.interaction.inputTriggerPlaceholder')">
              <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value" :label="optionLabel(item)" :value="item.value" />
            </el-select>
          </div>
        </div>

        <div v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="setting-row">
          <span class="setting-label">{{ t('options.interaction.targetLanguage') }}</span>
          <div class="setting-control">
            <el-select v-model="config.inputBoxTranslationTarget" :placeholder="t('options.interaction.targetLanguagePlaceholder')">
              <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>

        <p v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="input-candidate-hint">
          {{ t('options.interaction.inputCandidateHint') }}
        </p>
      </div>
    </div>

    <!-- 卡片4：快捷键与指令 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.interaction.hotkeyTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.interaction.hotkeyDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row" :class="{ 'setting-row--expanded': config.hotkey === 'custom' }">
          <span class="setting-label">
            {{ t('options.interaction.hoverTranslate') }}
            <el-tooltip effect="dark" :content="t('options.interaction.hoverTranslateTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control" :class="{ 'setting-control--full': config.hotkey === 'custom' }">
            <div class="hotkey-config">
              <el-select v-model="config.hotkey" :placeholder="t('options.interaction.hotkeyPlaceholder')" size="small" style="width: 100%" @change="handleMouseHotkeyChange">
                <el-option v-for="item in options.keys" :key="item.value" :label="optionLabel(item)" :value="item.value"
                  :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
              </el-select>
              <div v-if="config.hotkey === 'custom'" class="custom-hotkey-display">
                <span class="hotkey-text" v-if="config.customHotkey">{{ getCustomMouseHotkeyDisplayName() }}</span>
                <span class="hotkey-text placeholder-text" v-else>{{ t('options.interaction.setCustomHotkey') }}</span>
                <el-button size="small" type="text" @click="showCustomMouseHotkeyDialog = true" class="edit-button">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="config.on" class="setting-row" :class="{ 'setting-row--expanded': config.floatingBallHotkey === 'custom' }">
          <span class="setting-label">
            {{ t('options.interaction.scopeToggle') }}
            <el-tooltip effect="dark" :content="t('options.interaction.scopeToggleTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control" :class="{ 'setting-control--full': config.floatingBallHotkey === 'custom' }">
            <div class="hotkey-config">
              <el-select v-model="config.floatingBallHotkey" :placeholder="t('options.interaction.hotkeyPlaceholder')" size="small" style="width: 100%" @change="handleHotkeyChange">
                <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="optionLabel(item)" :value="item.value" />
              </el-select>
              <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display">
                <span class="hotkey-text" v-if="config.customFloatingBallHotkey">{{ getCustomHotkeyDisplayName() }}</span>
                <span class="hotkey-text placeholder-text" v-else>{{ t('options.interaction.setCustomHotkey') }}</span>
                <el-button size="small" type="text" @click="showCustomHotkeyDialog = true" class="edit-button">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片5：全文面板组件 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">{{ t('options.interaction.fullPageTitle') }}</h3>
        <p class="setting-card-desc">{{ t('options.interaction.fullPageDesc') }}</p>
      </div>
      <div class="setting-card-body">
        <div v-if="config.on" class="setting-row">
          <span class="setting-label">
            {{ t('options.interaction.floatingBall') }}
            <el-tooltip effect="dark" :content="t('options.interaction.floatingBallTip')" placement="top-start" :show-after="500">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <div class="setting-control setting-control--switch">
            <el-switch v-model="floatingBallEnabled" />
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义快捷键对话框 -->
    <CustomHotkeyInput
      v-model="showCustomMouseHotkeyDialog"
      :current-value="config.customHotkey || ''"
      @confirm="handleCustomMouseHotkeyConfirm"
      @cancel="handleCustomMouseHotkeyCancel"
    />
    <CustomHotkeyInput
      v-model="showCustomHotkeyDialog"
      :current-value="config.customFloatingBallHotkey || ''"
      @confirm="handleCustomHotkeyConfirm"
      @cancel="handleCustomHotkeyCancel"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { options } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { parseHotkey } from '@/entrypoints/utils/hotkey'
import browser from 'webextension-polyfill'
import { InfoFilled, Edit } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { speakText, stopTts } from '@/entrypoints/utils/ttsClient'

const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'))
const { config } = useConfig()
const { t } = useI18n()

const isPreviewingVoice = ref(false)

watch(() => config.value.ttsEngine, () => {
  stopTts()
})

const previewVoice = async () => {
  if (isPreviewingVoice.value) return
  isPreviewingVoice.value = true
  try {
    await speakText(t('options.interaction.voicePreviewText'), {
      engine: config.value.ttsEngine,
      gender: config.value.ttsVoiceGender,
    })
  } catch {
    ElMessage.error(t('options.interaction.voicePreviewFailed'))
  } finally {
    isPreviewingVoice.value = false
  }
}

onBeforeUnmount(stopTts)

type OptionLike = { label: string; labelKey?: string }
const optionLabel = (item: OptionLike) => item.labelKey ? t(item.labelKey) : item.label

// Floating ball computed
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall,
  set: (value) => {
    config.value.disableFloatingBall = !value
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'toggleFloatingBall',
            isEnabled: value
          }).catch(() => {})
        }
      })
    })
  }
})

// Custom hotkey dialogs
const showCustomHotkeyDialog = ref(false)
const showCustomMouseHotkeyDialog = ref(false)

// Mouse hotkey handlers
const handleMouseHotkeyChange = (value: string) => {
  if (value === 'custom' && !config.value.customHotkey) {
    setTimeout(() => { showCustomMouseHotkeyDialog.value = true }, 100)
  }
}

const handleCustomMouseHotkeyConfirm = (hotkey: string) => {
  config.value.customHotkey = hotkey
  config.value.hotkey = 'custom'
  ElMessage({ message: hotkey === 'none' ? t('options.interaction.hotkeyDisabled') : t('options.interaction.hotkeySet', { hotkey: getCustomMouseHotkeyDisplayName() }), type: 'success', duration: 2000 })
}

const handleCustomMouseHotkeyCancel = () => {
  if (!config.value.customHotkey) { config.value.hotkey = 'Control' }
}

const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return ''
  if (config.value.customHotkey === 'none') return t('options.interaction.disabledText')
  const parsed = parseHotkey(config.value.customHotkey)
  return parsed.isValid ? parsed.displayName : config.value.customHotkey
}

// Full page hotkey handlers
const handleHotkeyChange = (value: string) => {
  if (value === 'custom' && !config.value.customFloatingBallHotkey) {
    setTimeout(() => { showCustomHotkeyDialog.value = true }, 100)
  }
}

const handleCustomHotkeyConfirm = (hotkey: string) => {
  config.value.customFloatingBallHotkey = hotkey
  config.value.floatingBallHotkey = 'custom'
  ElMessage({ message: hotkey === 'none' ? t('options.interaction.hotkeyDisabled') : t('options.interaction.hotkeySet', { hotkey: getCustomHotkeyDisplayName() }), type: 'success', duration: 2000 })
}

const handleCustomHotkeyCancel = () => {
  if (!config.value.customFloatingBallHotkey) { config.value.floatingBallHotkey = 'Alt+T' }
}

const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return ''
  if (config.value.customFloatingBallHotkey === 'none') return t('options.interaction.disabledText')
  const parsed = parseHotkey(config.value.customFloatingBallHotkey)
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey
}
</script>

<style scoped>
/* ===== Card Dashboard Layout ===== */
.interaction-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  align-items: start;
  padding-top: 8px;
}

.setting-card {
  background: var(--el-bg-color);
  border: 1px solid var(--fr-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.setting-card-header {
  padding: 16px 20px 14px;
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.setting-card-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-card-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.setting-card-body {
  padding: 8px 20px 12px;
}

.input-candidate-hint {
  margin: 8px 0 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.edge-voice-privacy-notice {
  margin: 8px 0 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.voice-setting-row {
  display: grid !important;
  grid-template-columns: minmax(72px, 1fr) minmax(0, 300px);
  align-items: center;
  column-gap: 16px;
}

.voice-setting-control {
  width: 100%;
  max-width: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px;
  align-items: center;
  gap: 8px;
}

.voice-setting-control.voice-engine-control :deep(.el-select),
.voice-setting-control.voice-control :deep(.el-select),
.auto-voice-label {
  grid-column: 1;
  width: 100% !important;
  min-width: 0;
}

.voice-control :deep(.el-button) {
  grid-column: 2;
  width: 100%;
  margin: 0;
}

.auto-voice-label {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 11px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 420px) {
  .voice-setting-row {
    grid-template-columns: 1fr;
    row-gap: 8px;
  }

  .voice-setting-control {
    grid-column: 1;
  }
}

/* Card inner rows customization */
.interaction-group :deep(.setting-row) {
  padding: 14px 0;
  background: transparent !important;
}

.interaction-group :deep(.setting-row:not(:last-child)) {
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

/* ===== Hotkey config ===== */
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

/* ===== Select divider ===== */
:deep(.select-divider) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}
</style>
