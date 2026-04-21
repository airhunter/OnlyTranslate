<template>
  <div class="appearance-group">
    <!-- 卡片1：基础模式 -->
    <div class="setting-card">
      <div class="setting-card-header">
        <h3 class="setting-card-title">🎨 基础排版模式</h3>
        <p class="setting-card-desc">配置网页上翻译结果和原文的交互呈现关系</p>
      </div>
      <div class="setting-card-body">
        <div class="setting-row">
          <span class="setting-label">翻译模式</span>
          <div class="setting-control">
            <el-select v-model="config.display" placeholder="请选择翻译模式">
              <el-option class="select-left" v-for="item in options.display" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- 卡片2：样式库 -->
    <div v-if="config.display === 1" class="setting-card setting-card--full">
      <div class="setting-card-header">
        <h3 class="setting-card-title">✨ 双语排版视觉样式库</h3>
        <p class="setting-card-desc">选择最契合您个人阅读习惯的双语对照呈现版式</p>
      </div>
      <div class="setting-card-body">
        <div class="style-picker">
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
/* ===== Card Dashboard Layout ===== */
.appearance-group {
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

.setting-card--full {
  grid-column: 1 / -1;
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
  padding: 8px 16px 16px;
}

/* Card inner rows customization */
.appearance-group :deep(.setting-row) {
  padding: 14px 4px;
  background: transparent !important;
}

.appearance-group :deep(.setting-row:not(:last-child)) {
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

/* ===== Style picker ===== */
.style-picker {
  padding: 6px 4px 4px;
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

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
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
