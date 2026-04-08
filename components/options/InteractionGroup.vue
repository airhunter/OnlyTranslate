<template>
  <div class="interaction-group">
    <!-- 划词翻译 -->
    <div class="setting-row">
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
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
    </div>

    <!-- 输入框翻译目标语言 -->
    <div v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="setting-row">
      <span class="setting-label">翻译目标语言</span>
      <div class="setting-control">
        <el-select v-model="config.inputBoxTranslationTarget" placeholder="请选择目标语言">
          <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
    </div>

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
            <el-button size="small" type="text" @click="showCustomMouseHotkeyDialog = true" class="edit-button">
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
            <el-button size="small" type="text" @click="showCustomHotkeyDialog = true" class="edit-button">
              <el-icon><Edit /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 全文悬浮球 -->
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

    <!-- 自定义快捷键对话框 - 鼠标悬浮 -->
    <CustomHotkeyInput
      v-model="showCustomMouseHotkeyDialog"
      :current-value="config.customHotkey || ''"
      @confirm="handleCustomMouseHotkeyConfirm"
      @cancel="handleCustomMouseHotkeyCancel"
    />

    <!-- 自定义快捷键对话框 - 全文翻译 -->
    <CustomHotkeyInput
      v-model="showCustomHotkeyDialog"
      :current-value="config.customFloatingBallHotkey || ''"
      @confirm="handleCustomHotkeyConfirm"
      @cancel="handleCustomHotkeyCancel"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { options } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { parseHotkey } from '@/entrypoints/utils/hotkey'
import browser from 'webextension-polyfill'
import { ChatDotRound, Edit } from '@element-plus/icons-vue'

const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'))
const { config } = useConfig()

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
  ElMessage({ message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomMouseHotkeyDisplayName()}`, type: 'success', duration: 2000 })
}

const handleCustomMouseHotkeyCancel = () => {
  if (!config.value.customHotkey) { config.value.hotkey = 'Control' }
}

const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return ''
  if (config.value.customHotkey === 'none') return '已禁用'
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
  ElMessage({ message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomHotkeyDisplayName()}`, type: 'success', duration: 2000 })
}

const handleCustomHotkeyCancel = () => {
  if (!config.value.customFloatingBallHotkey) { config.value.floatingBallHotkey = 'Alt+T' }
}

const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return ''
  if (config.value.customFloatingBallHotkey === 'none') return '已禁用'
  const parsed = parseHotkey(config.value.customFloatingBallHotkey)
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey
}
</script>

<style scoped>
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