<template>
  <div class="appearance-group">
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

    <!-- 样式预览 -->
    <div v-if="config.display === 1" class="style-preview">
      <span class="preview-label">预览效果</span>
      <div class="preview-box">
        <span :class="currentStyleClass">这是译文预览效果</span>
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
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { options } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { ChatDotRound } from '@element-plus/icons-vue'

const { config } = useConfig()

// Style groups for grouped selector
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled)
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }))
})

// Current style class for preview
const currentStyleClass = computed(() => {
  const selected = options.styles.find(s => s.value === config.value.style)
  return selected?.class || 'fluent-display-default'
})
</script>

<style scoped>
/* ===== Style preview ===== */
.style-preview {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
  background: var(--fr-bg-color);
  border-bottom: 1px solid var(--fr-row-border);
}

.preview-label {
  font-size: 12px;
  color: var(--fr-text-color-regular);
  white-space: nowrap;
  flex-shrink: 0;
}

.preview-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  min-height: 32px;
  max-width: 165px;
}

.preview-box span {
  font-size: 13px;
}

/* ===== Select ===== */
.select-left {
  text-align: left;
}
</style>
