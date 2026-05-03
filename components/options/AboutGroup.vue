<template>
  <div class="about-group">
    <div class="setting-card about-card about-card--overview">
      <div class="setting-card-header">
        <h3 class="setting-card-title">关于只译</h3>
      </div>
      <div class="setting-card-body">
        <div class="product-summary">
          <img class="product-logo" :src="logoUrl" alt="只译" />
          <div>
            <div class="product-name">只译</div>
            <p class="product-desc">一款专注翻译的浏览器插件，强大而克制，只做一件事。</p>
          </div>
        </div>

        <div class="product-meta">
          <div class="version-meta">
            <span class="meta-label">当前版本</span>
            <strong>v{{ appVersion }}</strong>
          </div>
          <button type="button" class="project-link" @click="openExternal(GITHUB_URL)">
            <span>项目主页</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <div class="setting-card about-card about-card--release">
      <div class="setting-card-header">
        <h3 class="setting-card-title">更新说明</h3>
      </div>
      <div class="setting-card-body">
        <ul v-if="currentReleaseNote" class="release-list">
          <li v-for="item in currentReleaseNote.items" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="release-empty">当前版本暂未补充更新说明。</p>
      </div>
    </div>

    <div class="setting-card about-card about-card--privacy">
      <div class="setting-card-header">
        <h3 class="setting-card-title">隐私政策</h3>
      </div>
      <div class="setting-card-body">
        <div class="privacy-doc">
          <template v-for="block in privacyBlocks" :key="block.id">
            <h4 v-if="block.type === 'title'" class="privacy-title" v-html="block.html" />
            <p v-else-if="block.type === 'meta'" class="privacy-meta" v-html="block.html" />
            <h5 v-else-if="block.type === 'section'" class="privacy-section" v-html="block.html" />
            <p v-else class="privacy-paragraph" v-html="block.html" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import browser from 'webextension-polyfill'
import { findReleaseNoteByVersion } from '@/entrypoints/utils/releaseNotes'
import privacyMarkdown from '../../PRIVACY.md?raw'

const GITHUB_URL = 'https://github.com/airhunter/OnlyTranslate'

const appVersion = browser.runtime.getManifest().version
const currentReleaseNote = findReleaseNoteByVersion(appVersion)
const logoUrl = browser.runtime.getURL('/icon/128.png')

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderInlineMarkdown = (value: string) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>')

const privacyBlocks = computed(() => privacyMarkdown
  .split('\n')
  .map((line: string) => line.trim())
  .filter(Boolean)
  .map((line: string, index: number) => {
    const content = line.replace(/^#\s+/, '').replace(/^\*\*(.+)\*\*$/, '$1')
    const type = line.startsWith('# ')
      ? 'title'
      : line.startsWith('最后更新日期')
        ? 'meta'
        : /^\*\*\d+\./.test(line)
          ? 'section'
          : 'paragraph'

    return {
      id: `${index}-${content}`,
      type,
      html: renderInlineMarkdown(content)
    }
  }))
</script>

<style scoped>
.about-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  padding: 16px 20px;
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.setting-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-card-body {
  padding: 16px 20px 18px;
}

.product-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.product-logo {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  object-fit: cover;
}

.product-name {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}

.product-desc {
  margin: 2px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.product-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
}

.version-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.meta-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.version-meta strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.project-link {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--fr-accent-color);
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.release-list {
  margin: 0;
  padding-left: 18px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.8;
}

.release-empty {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.project-link .el-icon {
  flex-shrink: 0;
}

.project-link:hover {
  color: var(--el-color-primary);
}

.privacy-doc {
  color: var(--el-text-color-regular);
}

.privacy-title {
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.6;
}

.privacy-meta {
  margin: 0 0 14px;
  color: var(--el-text-color-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.privacy-section {
  margin: 18px 0 6px;
  color: var(--el-text-color-primary);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.6;
}

.privacy-paragraph {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.8;
}

.privacy-paragraph + .privacy-paragraph {
  margin-top: 10px;
}

.privacy-doc :deep(strong) {
  color: var(--el-text-color-primary);
  font-weight: 700;
}

.privacy-doc :deep(code) {
  color: var(--fr-accent-color);
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 1px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

@media (max-width: 900px) {
  .product-meta {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
