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

    <!-- 译文样式 — 可视化网格选择器 -->
    <div v-if="config.display === 1" class="style-picker">
      <div class="style-picker-label">
        译文样式
        <el-tooltip effect="dark" content="选择双语模式下译文的显示样式" placement="top-start" :show-after="500">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
      <div v-for="group in styleGroups" :key="group.value" class="style-group">
        <div class="style-group-title">{{ group.label }}</div>
        <div class="style-grid">
          <div
            v-for="item in group.options"
            :key="item.value"
            class="style-card"
            :class="{ 'style-card--active': config.style === item.value }"
            @click="config.style = item.value"
          >
            <div class="style-card-preview">
              <span class="style-card-original">The quick brown fox</span>
              <span :class="item.class" class="style-card-translation">敏捷的棕色狐狸</span>
            </div>
            <div class="style-card-name">{{ item.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { options } from '@/entrypoints/utils/option'
import { useConfig } from '@/composables/useConfig'
import { InfoFilled } from '@element-plus/icons-vue'

const { config } = useConfig()

const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled)
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }))
})
</script>

<style>
@import '@/entrypoints/style.css';
</style>

<style scoped>
/* ===== Style picker ===== */
.style-picker {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--fr-row-border);
}

.style-picker-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fr-text-color-primary);
  margin-bottom: 12px;
}

.info-icon {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  cursor: default;
}

/* ===== Style group ===== */
.style-group {
  margin-bottom: 14px;
}

.style-group:last-child {
  margin-bottom: 0;
}

.style-group-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

/* ===== Style grid ===== */
.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

/* ===== Style card ===== */
.style-card {
  border: 1.5px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 8px 10px 6px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: var(--el-bg-color-page);
  overflow: hidden;
}

.style-card:hover {
  border-color: var(--fr-accent-color);
}

.style-card--active {
  border-color: var(--fr-accent-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--fr-accent-color) 20%, transparent);
  background: color-mix(in srgb, var(--fr-accent-color) 5%, var(--el-bg-color-page));
}

/* ===== Card content ===== */
.style-card-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 40px;
  justify-content: center;
  margin-bottom: 6px;
}

.style-card-original {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.style-card-translation {
  font-size: 12px;
  color: var(--fr-text-color-primary);
  line-height: 1.5;
  display: inline-block;
  max-width: 100%;
  word-break: break-all;
}

.style-card-name {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: center;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style-card--active .style-card-name {
  color: var(--fr-accent-color);
}

/* ===== Select ===== */
.select-left {
  text-align: left;
}
</style>
