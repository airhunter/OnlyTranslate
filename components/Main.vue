<template>

  <div class="popup-header">
    <div class="header-brand">
      <el-tooltip effect="dark" :content="'v' + appVersion" placement="bottom">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
          </svg>
        </div>
      </el-tooltip>
      <span class="header-name">{{ t('common.appName') }}</span>
      <div class="release-notes-wrap">
        <button
          type="button"
          class="release-notes-trigger"
          :aria-label="t('common.releaseNotes')"
          @click="toggleReleaseNotes"
        >
          <el-icon><Bell /></el-icon>
          <span v-if="hasUnreadReleaseNotes" class="release-notes-badge" />
        </button>

        <div v-if="releaseNotesVisible" class="release-notes-card">
          <div>
            <div class="release-notes-kicker">v{{ appVersion }}</div>
            <div class="release-notes-title">{{ releaseNotesHeading }}</div>
          </div>

          <div class="release-notes-content">
            <ul v-if="currentReleaseNote" class="release-notes-list">
              <li v-for="item in currentReleaseNote.items" :key="item">{{ item }}</li>
            </ul>
            <p v-else class="release-notes-empty">{{ t('common.noReleaseNotes') }}</p>
          </div>

          <button type="button" class="release-notes-confirm" @click="handleReleaseNotesConfirm">
            {{ t('common.gotIt') }}
          </button>
        </div>
      </div>
    </div>
    <div class="header-right">
      <span class="status-text">{{ config.on ? t('common.enabled') : t('common.disabled') }}</span>
      <el-switch v-model="config.on" @change="handlePluginStateChange" />
      <div class="utility-menu-wrap">
        <button
          type="button"
          class="utility-menu-trigger"
          :aria-label="t('popup.moreActions')"
          :aria-expanded="utilityMenuVisible"
          @click="utilityMenuVisible = !utilityMenuVisible"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
        <div v-if="utilityMenuVisible" class="utility-menu">
          <button
            type="button"
            :class="{ 'is-success': cacheStatus === 'success', 'is-failed': cacheStatus === 'failed' }"
            :disabled="cacheBtnDisabled"
            @click="clearCache"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
            </svg>
            <span>{{ cacheBtnText }}</span>
          </button>
          <button type="button" @click="openHelpPage">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.2-2.5 4" />
              <path d="M12 18h.01" />
            </svg>
            <span>{{ t('help.navLabel') }}</span>
          </button>
          <button type="button" class="official-website-menu-item" @click="openOfficialWebsite">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
            <span>{{ t('popup.officialWebsite') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Body ===== -->
  <div
    class="popup-body"
    :class="{ 'popup-body--shelf': activePopupView === 'ebooks' }"
  >
    <template v-if="activePopupView === 'translate'">

    <!-- 插件禁用占位 -->
    <div v-if="!config.on" class="disabled-state">
      <el-empty :description="t('popup.disabledDescription')" :image-size="60" />
    </div>

    <div v-show="config.on">

      <!-- 翻译当前页面按钮 -->
      <button class="translate-page-btn" :class="{ 'restore-btn': isTranslated }" :disabled="translating" @click="handleTranslateClick">
        <svg class="translate-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </svg>
        <span>{{ translateButtonLabel }}</span>
      </button>

      <!-- 翻译模式 -->
      <div class="setting-row">
        <span class="setting-label">{{ t('popup.displayMode') }}</span>
        <div class="setting-control">
          <el-select v-model="config.display" :placeholder="t('popup.displayModePlaceholder')">
            <el-option
              class="select-left"
              v-for="item in options.display"
              :key="item.value"
              :label="optionLabel(item)"
              :value="item.value"
              :disabled="item.value === 0 && !supportsTranslationOnlyMode(config.service)"
            />
          </el-select>
        </div>
      </div>

      <!-- 翻译服务 -->
      <div class="setting-row">
        <span class="setting-label">
          {{ t('popup.service') }}
          <el-tooltip effect="dark" :content="t('popup.serviceTip')" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control">
          <el-select
            v-model="config.service"
            :placeholder="t('popup.servicePlaceholder')"
            class="service-select"
            popper-class="popup-service-select-popper"
            @change="handleServiceChange"
          >
            <el-option class="select-left" v-for="item in availableServices" :key="item.value"
              :label="item.label" :value="item.value" :disabled="item.disabled"
              :class="{ 'select-divider': item.disabled, 'select-action': item.isAction }" />
          </el-select>
        </div>
      </div>

      <!-- 视频字幕翻译 -->
      <div class="setting-row">
        <span class="setting-label">
          {{ t('popup.videoSubtitle') }}
          <el-tooltip effect="dark" :content="t('popup.videoSubtitleTip')" placement="top-start" :show-after="500">
            <el-icon class="info-icon"><ChatDotRound /></el-icon>
          </el-tooltip>
        </span>
        <div class="setting-control setting-control--switch">
          <el-switch v-model="config.enableVideoSubtitle" />
        </div>
      </div>

      <!-- 划词翻译 -->
      <div class="setting-row">
        <span class="setting-label">{{ t('popup.selectionTranslator') }}</span>
        <div class="setting-control setting-control--switch">
          <el-switch
            :model-value="config.selectionTranslatorMode !== 'disabled'"
            @update:model-value="toggleSelectionTranslator"
          />
        </div>
      </div>

      <!-- 翻译范围 -->
      <div class="setting-row">
        <span class="setting-label">{{ t('popup.translationScope') }}</span>
        <div class="setting-control">
          <div class="scope-toggle">
            <el-tooltip effect="dark" :content="t('popup.smartScopeTip')" placement="top" :show-after="600">
              <button
                class="scope-btn"
                :class="{ 'scope-btn--active': config.translationScope !== 'full' }"
                :aria-pressed="config.translationScope !== 'full'"
                @click="config.translationScope = 'smart'"
              >
                {{ t('popup.smartScope') }}
              </button>
            </el-tooltip>
            <el-tooltip effect="dark" :content="t('popup.fullScopeTip')" placement="top" :show-after="600">
              <button
                class="scope-btn"
                :class="{ 'scope-btn--active': config.translationScope === 'full' }"
                :aria-pressed="config.translationScope === 'full'"
                @click="config.translationScope = 'full'"
              >
                {{ t('popup.fullScope') }}
              </button>
            </el-tooltip>
          </div>
        </div>
      </div>

    </div>
    </template>

    <section v-else class="popup-bookshelf" :aria-label="t('popup.ebookShelfTitle')">
      <div class="bookshelf-heading">
        <div>
          <h2>{{ t('popup.ebookShelfTitle') }}</h2>
          <p>{{ t('popup.ebookShelfDescription') }}</p>
        </div>
        <button type="button" class="bookshelf-text-button" @click="openEbookReader()">
          {{ t('popup.viewAllBooks') }} ↗
        </button>
      </div>

      <div v-if="ebookShelfLoading" class="bookshelf-status">{{ t('common.processing') }}</div>
      <div v-else-if="ebookShelfError" class="bookshelf-status bookshelf-status--error">{{ ebookShelfError }}</div>
      <div v-else-if="popupEbooks.length" class="popup-book-list">
        <button
          v-for="item in popupEbooks"
          :key="item.record.bookId"
          type="button"
          class="popup-book"
          @click="openLibraryBook(item.record)"
        >
          <span class="popup-book-cover">
            <img v-if="ebookCoverUrls[item.record.bookId]" :src="ebookCoverUrls[item.record.bookId]" alt="" />
            <span v-else>{{ item.record.title.slice(0, 1).toLocaleUpperCase() }}</span>
          </span>
          <span class="popup-book-copy">
            <strong>{{ item.record.title }}</strong>
            <span>{{ item.record.author || t('ebook.unknownAuthor') }}</span>
            <span class="popup-book-progress"><i :style="{ width: `${Math.round(item.progress * 100)}%` }" /></span>
            <small>{{ t('ebook.readingProgress', { percent: Math.round(item.progress * 100) }) }}</small>
          </span>
          <span class="popup-book-arrow" aria-hidden="true">›</span>
        </button>
      </div>
      <div v-else class="bookshelf-empty">
        <span class="bookshelf-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 4.5h5a3 3 0 0 1 3 3V20a3 3 0 0 0-3-3H4z" />
            <path d="M20 4.5h-5a3 3 0 0 0-3 3V20a3 3 0 0 1 3-3h5z" />
          </svg>
        </span>
        <strong>{{ t('popup.emptyEbookShelf') }}</strong>
        <p>{{ t('popup.emptyEbookShelfDescription') }}</p>
      </div>

      <input
        ref="popupFileInput"
        class="popup-file-input"
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        @change="handlePopupFileChange"
      />
      <button type="button" class="bookshelf-import" :disabled="popupImporting" @click="choosePopupEbook">
        {{ popupImporting ? t('common.processing') : t('ebook.importBook') }}
      </button>
    </section>
  </div>

  <!-- ===== Footer ===== -->
  <div class="popup-footer">
    <nav class="popup-nav" :aria-label="t('popup.navigation')">
      <button
        type="button"
        class="popup-nav-button"
        :class="{ 'popup-nav-button--active': activePopupView === 'translate' }"
        :aria-current="activePopupView === 'translate' ? 'page' : undefined"
        @click="activePopupView = 'translate'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5h11M8 2v3M5 8c1.4 2.5 3.4 4.5 6 6M11 8c-1.2 2.7-3.5 5-7 7M13 21l4-10 4 10M14.5 17.5h5" />
        </svg>
        <span>{{ t('popup.translateTab') }}</span>
      </button>
      <button
        type="button"
        class="popup-nav-button"
        :class="{ 'popup-nav-button--active': activePopupView === 'ebooks' }"
        :aria-current="activePopupView === 'ebooks' ? 'page' : undefined"
        @click="showEbookShelf"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 4.5h5a4 4 0 0 1 4 4V21a3.5 3.5 0 0 0-3.5-3.5H3z" />
          <path d="M21 4.5h-5a4 4 0 0 0-4 4V21a3.5 3.5 0 0 1 3.5-3.5H21z" />
        </svg>
        <span>{{ t('popup.ebooksTab') }}</span>
        <span class="popup-nav-beta">BETA</span>
      </button>
      <button type="button" class="popup-nav-button" @click="openSettingsPage">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.09A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.09A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06A1.7 1.7 0 0 0 19.43 9 1.7 1.7 0 0 0 21 10h.09v4H21a1.7 1.7 0 0 0-1.6 1z" />
        </svg>
        <span>{{ t('common.settings') }}</span>
      </button>
    </nav>
  </div>

</template>

<script lang="ts" setup>

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { defaultOption, options, isServiceConfigured, supportsTranslationOnlyMode } from "../entrypoints/utils/option";
import { useConfig } from '@/composables/useConfig'
import { useReleaseNotes } from '@/composables/useReleaseNotes'
import { Bell, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import browser from 'webextension-polyfill';
import { useTheme } from '@/composables/useTheme';
import { resolveLocale } from '@/entrypoints/utils/i18n';
import { openOptionsPanel } from '@/entrypoints/utils/help';
import { clearTranslationCache } from '@/entrypoints/utils/clearTranslationCache';
import { EbookImportError, EbookRepository } from '@/entrypoints/ebook/repository';
import { getEbookPageUrl } from '@/entrypoints/ebook/url';
import type { EbookRecord } from '@/entrypoints/ebook/types';
import { getEbookFormat } from '@/entrypoints/ebook/types';
import { extractLibraryBookMetadata } from '@/entrypoints/ebook/importMetadata';
import { consumeClaudeModelMigrationNotice } from '@/entrypoints/utils/modelMigration';
import { consumeDisplayModeMigrationNotice } from '@/entrypoints/utils/displayModeMigration';
import { getLibraryPdfReaderUrl, getPdfReaderUrl, isLikelyPdfUrl, isPdfContentType } from '@/entrypoints/pdf/url';

interface PopupEbook {
  record: EbookRecord;
  progress: number;
}


// Config management
const { config, loadConfig } = useConfig()
const { updateTheme } = useTheme(config)
const { t, locale } = useI18n()
const {
  currentReleaseNote,
  hasUnreadReleaseNotes,
  loadReleaseNotesState,
  markCurrentReleaseNotesAsSeen
} = useReleaseNotes(locale)

// 应用版本号
const appVersion = browser.runtime.getManifest().version;
const releaseNotesVisible = ref(false);
const utilityMenuVisible = ref(false);
const activePopupView = ref<'translate' | 'ebooks'>('translate');
const ebookRepository = new EbookRepository();
const popupEbooks = ref<PopupEbook[]>([]);
const ebookShelfLoading = ref(false);
const ebookShelfError = ref('');
const ebookCoverUrls = reactive<Record<string, string>>({});
const popupFileInput = ref<HTMLInputElement>();
const popupImporting = ref(false);

type OptionLike = { label: string; labelKey?: string }
const optionLabel = (item: OptionLike) => item.labelKey ? t(item.labelKey) : item.label

// 翻译状态相关变量
const previousService = ref<string>('');
const translating = ref(false);
const isTranslated = ref(false);
const activePdfSource = ref('');

const translateButtonLabel = computed(() => {
  if (translating.value) return t('common.processing')
  if (activePdfSource.value) return t('pdf.openCurrent')
  return isTranslated.value ? t('common.restoreOriginal') : t('common.translatePage')
})

const releaseNotesHeading = computed(() => {
  return currentReleaseNote.value?.title || t('common.currentVersion')
})

async function handleReleaseNotesConfirm() {
  if (currentReleaseNote.value) {
    await markCurrentReleaseNotesAsSeen();
  }
  releaseNotesVisible.value = false;
}

async function toggleReleaseNotes() {
  await loadReleaseNotesState();
  releaseNotesVisible.value = !releaseNotesVisible.value;
}

// 查询当前页面的翻译状态
async function checkTranslationStatus() {
  if (activePdfSource.value) return;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;
    const response = await browser.tabs.sendMessage(tabs[0].id, {
      type: 'contextMenuTranslate',
      action: 'getStatus'
    }) as { status?: string; isTranslated?: boolean };
    if (response?.status === 'success') {
      isTranslated.value = response.isTranslated || false;
    }
  } catch (error) {
    console.error('查询翻译状态失败:', error);
  }
}

// 处理翻译按钮点击（切换逻辑）
async function handleTranslateClick() {
  if (activePdfSource.value) {
    await browser.tabs.create({ url: getPdfReaderUrl(activePdfSource.value) });
    window.close();
    return;
  }
  if (isTranslated.value) {
    // 已翻译，还原原文
    await restoreCurrentPage();
  } else {
    // 未翻译，执行翻译
    await translateCurrentPage();
  }
}

async function translateCurrentPage() {
  try {
    translating.value = true;
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      ElMessage.error(t('popup.noActiveTab'));
      return;
    }
    const response = await browser.tabs.sendMessage(tabs[0].id, {
      type: 'contextMenuTranslate',
      action: 'fullPage',
      scope: config.value.translationScope ?? 'smart'
    }) as { status?: string; error?: string };
    if (response?.status !== 'success') {
      throw new Error(response?.error || t('popup.translateFailed'));
    }
    isTranslated.value = true;
  } catch (error) {
    console.error('翻译失败:', error);
    ElMessage.error(error instanceof Error ? error.message : t('popup.translateFailed'));
  } finally {
    translating.value = false;
  }
}

async function restoreCurrentPage() {
  try {
    translating.value = true;
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      ElMessage.error(t('popup.noActiveTab'));
      return;
    }
    await browser.tabs.sendMessage(tabs[0].id, {
      type: 'contextMenuTranslate',
      action: 'restore'
    });
    isTranslated.value = false;
    ElMessage.success(t('popup.restored'));
  } catch (error) {
    console.error('还原失败:', error);
    ElMessage.error(t('popup.restoreFailed'));
  } finally {
    translating.value = false;
  }
}

async function detectActivePdfSource() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url || !/^https?:/i.test(url)) {
    activePdfSource.value = isLikelyPdfUrl(url) ? url! : '';
    return;
  }
  if (isLikelyPdfUrl(url)) {
    activePdfSource.value = url;
    return;
  }
  try {
    const response = await fetch(url, { method: 'HEAD', credentials: 'include' });
    activePdfSource.value = response.ok && isPdfContentType(response.headers.get('content-type')) ? url : '';
  } catch {
    activePdfSource.value = '';
  }
}

loadConfig().then(async () => {
  updateTheme(config.value.theme || 'auto')
  locale.value = resolveLocale(config.value.uiLocale || 'auto')
  // 初始化 previousService
  previousService.value = config.value.service || ''
  // 检查当前服务是否已配置，未配置则回退到默认服务
  if (!isServiceConfigured(config.value.service, config.value)) {
    config.value.service = defaultOption.service
    previousService.value = defaultOption.service
  }
  await detectActivePdfSource()
  // 查询当前页面翻译状态
  checkTranslationStatus()
  void consumeClaudeModelMigrationNotice().then((notice) => {
    if (!notice) return
    ElMessage.info(t('common.modelMigrated', { from: notice.from, to: notice.to }))
  })
  void consumeDisplayModeMigrationNotice().then((notice) => {
    if (!notice) return
    ElMessage.info(t('common.displayModeMigrated'))
  })
})

watch(() => config.value.uiLocale, (value) => {
  locale.value = resolveLocale(value || 'auto')
})

loadReleaseNotesState().catch((error) => {
  console.error('读取更新说明状态失败:', error);
})

const availableServices = computed(() => {
  type ServiceOption = { value: string; label: string; disabled?: boolean; isAction?: boolean };
  const result: ServiceOption[] = [];
  let currentGroupHeader: ServiceOption | null = null;
  let currentGroupItems: ServiceOption[] = [];

  for (const item of options.services) {
    if (item.disabled) {
      // This is a group header - save it and reset the group items
      if (currentGroupHeader && currentGroupItems.length > 0) {
        result.push(currentGroupHeader);
        result.push(...currentGroupItems);
      }
      currentGroupHeader = item;
      currentGroupItems = [];
    } else {
      // This is a regular service - check if it's configured and compatible with the display mode
      const isDisplayModeIncompatible = config.value.display === 0
        && !supportsTranslationOnlyMode(item.value);
      if (!isDisplayModeIncompatible && isServiceConfigured(item.value, config.value)) {
        currentGroupItems.push(item);
      }
    }
  }

  // Add the last group if it has items
  if (currentGroupHeader && currentGroupItems.length > 0) {
    result.push(currentGroupHeader);
    result.push(...currentGroupItems);
  }

  // Add custom providers
  if (config.value.customProviders && config.value.customProviders.length > 0) {
    result.push({ value: '__custom_header__', label: t('popup.customProviderGroup'), disabled: true });
    for (const provider of config.value.customProviders) {
      result.push({
        value: provider.id,
        label: provider.name || provider.id
      });
    }
  }

  // Add "添加更多服务..." option at the end
  result.push({ value: '__add_more__', label: t('popup.manageCustomServices'), isAction: true });

  return result;
});

// 处理翻译服务选择变化
const handleServiceChange = (value: string) => {
  if (value === '__add_more__') {
    // 恢复原来的服务选择
    config.value.service = previousService.value;
    // 跳转设置页
    openSettingsPage();
  } else {
    // 记录当前选择的服务
    previousService.value = value;
  }
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被开启，恢复悬浮球为启用状态
  if (val) {
    config.value.disableFloatingBall = false;
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, {
            type: 'toggleFloatingBall',
            isEnabled: true
          }).catch(() => {});
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
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {});
          }
        });
      });
    }

    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {});
          }
        });
      });
    }
  }
};

// 划词翻译开关
const toggleSelectionTranslator = (val: boolean) => {
  config.value.selectionTranslatorMode = val ? 'bilingual' : 'disabled'
}

// ===== Footer: 清除缓存 =====
const cacheBtnDisabled = ref(false);
const cacheBtnText = computed(() => {
  if (cacheStatus.value === 'success') return t('common.cleared');
  if (cacheStatus.value === 'failed') return t('common.failed');
  if (cacheLoading.value) return t('common.clearing');
  return t('common.clearCache');
});
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
    cacheStatus.value = 'idle';
    await clearTranslationCache();

    cacheStatus.value = 'success';
  } catch (error) {
    console.error('清除缓存失败:', error);
    cacheStatus.value = 'failed';
  } finally {
    cacheLoading.value = false;
    setTimeout(() => {
      cacheBtnDisabled.value = false;
      cacheStatus.value = 'idle';
    }, 1500);
  }
}

// ===== Footer: 打开设置页 =====
function openSettingsPage() {
  utilityMenuVisible.value = false;
  browser.runtime.openOptionsPage()
}

async function showEbookShelf() {
  activePopupView.value = 'ebooks';
  await refreshEbookShelf();
}

async function refreshEbookShelf() {
  ebookShelfLoading.value = true;
  ebookShelfError.value = '';
  clearEbookCoverUrls();
  try {
    const books = (await ebookRepository.listRecentBooks()).slice(0, 3);
    popupEbooks.value = await Promise.all(books.map(async record => ({
      record,
      progress: (await ebookRepository.getProgress(record.bookId))?.percentage ?? 0,
    })));
    books.forEach(record => {
      if (record.coverBlob) ebookCoverUrls[record.bookId] = URL.createObjectURL(record.coverBlob);
    });
  } catch (error) {
    console.error('Failed to load the ebook shelf:', error);
    popupEbooks.value = [];
    ebookShelfError.value = t('popup.ebookShelfLoadFailed');
  } finally {
    ebookShelfLoading.value = false;
  }
}

function clearEbookCoverUrls() {
  Object.values(ebookCoverUrls).forEach(url => URL.revokeObjectURL(url));
  Object.keys(ebookCoverUrls).forEach(bookId => delete ebookCoverUrls[bookId]);
}

function openEbookReader(bookId?: string) {
  void browser.tabs.create({ url: getEbookPageUrl(bookId) })
}

function openLibraryBook(book: EbookRecord): void {
  const url = getEbookFormat(book) === 'pdf'
    ? getLibraryPdfReaderUrl(book.bookId)
    : getEbookPageUrl(book.bookId);
  void browser.tabs.create({ url });
}

function choosePopupEbook() {
  if (!popupImporting.value) popupFileInput.value?.click();
}

async function handlePopupFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await importPopupEbook(file);
}

async function importPopupEbook(file: File) {
  popupImporting.value = true;
  try {
    const result = await ebookRepository.importBook(file, extractLibraryBookMetadata);
    await refreshEbookShelf();
    openLibraryBook(result.book);
  } catch (error) {
    console.error('Failed to import an ebook from the popup:', error);
    ElMessage.error(popupImportErrorText(error));
  } finally {
    popupImporting.value = false;
  }
}

function popupImportErrorText(error: unknown): string {
  if (!(error instanceof EbookImportError)) return t('ebook.importFailed');
  const keyByCode: Record<EbookImportError['code'], string> = {
    INVALID_FILE: 'ebook.invalidFile',
    EMPTY_FILE: 'ebook.emptyFile',
    INSUFFICIENT_STORAGE: 'ebook.insufficientStorage',
    QUOTA_EXCEEDED: 'ebook.insufficientStorage',
    PARSE_FAILED: 'ebook.parseFailed',
  };
  return t(keyByCode[error.code]);
}

function openHelpPage() {
  utilityMenuVisible.value = false;
  void openOptionsPanel('help')
}

function openOfficialWebsite() {
  utilityMenuVisible.value = false;
  void browser.tabs.create({ url: 'https://onlytranslate.top/' })
}

function handlePopupFocus() {
  if (activePopupView.value === 'ebooks') void refreshEbookShelf();
}

onMounted(() => window.addEventListener('focus', handlePopupFocus));

onBeforeUnmount(() => {
  window.removeEventListener('focus', handlePopupFocus);
  clearEbookCoverUrls();
  ebookRepository.close();
});

</script>

<style scoped>

/* ===== Header - Minimalist Enterprise Style ===== */
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--fr-bg-color);
  border-bottom: 1px solid var(--fr-border-color-lighter);
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
  width: 28px;
  height: 28px;
  background: var(--fr-hover-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.header-icon svg {
  width: 16px;
  height: 16px;
  color: var(--fr-text-color-primary);
}

.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-text-color-primary);
  letter-spacing: 0.5px;
}

.release-notes-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.release-notes-trigger {
  position: relative;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--fr-text-color-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.release-notes-trigger:hover {
  color: var(--fr-text-color-primary);
  background: var(--fr-hover-color);
}

.release-notes-trigger :deep(.el-icon) {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.release-notes-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #dc2626;
  box-shadow: 0 0 0 2px var(--fr-bg-color);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.utility-menu-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.utility-menu-trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--fr-text-color-regular);
  cursor: pointer;
}

.utility-menu-trigger:hover,
.utility-menu-trigger[aria-expanded="true"] {
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
}

.utility-menu-trigger svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.utility-menu {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 30;
  display: flex;
  width: 132px;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--fr-border-color-lighter);
  border-radius: 8px;
  background: var(--fr-bg-color);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
}

.utility-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fr-text-color-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.utility-menu button:hover {
  background: var(--fr-hover-color);
}

.utility-menu button:disabled {
  opacity: .55;
  cursor: wait;
}

.utility-menu button.is-success {
  color: var(--el-color-success);
}

.utility-menu button.is-failed {
  color: var(--el-color-danger);
}

.utility-menu button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--fr-text-color-regular);
}

.release-notes-card {
  position: fixed;
  top: 58px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  width: min(260px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(320px, calc(100vh - 72px));
  overflow: hidden;
  padding: 12px;
  border: 1px solid var(--fr-border-color-lighter);
  border-radius: 8px;
  background: var(--fr-bg-color);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
}

.release-notes-kicker {
  font-size: 11px;
  font-weight: 600;
  color: var(--fr-text-color-regular);
}

.release-notes-title {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fr-text-color-primary);
}

.release-notes-content {
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.release-notes-content::-webkit-scrollbar {
  width: 4px;
}

.release-notes-content::-webkit-scrollbar-thumb {
  background: var(--fr-border-color);
  border-radius: 2px;
}

.release-notes-list {
  margin: 0;
  padding-left: 16px;
  color: var(--fr-text-color-primary);
}

.release-notes-list li {
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.55;
}

.release-notes-list li:last-child {
  margin-bottom: 0;
}

.release-notes-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--fr-text-color-regular);
}

.release-notes-confirm {
  align-self: flex-end;
  flex-shrink: 0;
  min-width: 64px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--fr-accent-color);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.release-notes-confirm:hover {
  opacity: 0.92;
}

/* ===== Body ===== */
.popup-body {
  padding: 12px 16px;
  overflow: visible;
  background: var(--fr-bg-color);
}

.disabled-state {
  padding: 20px 0;
}

.popup-body--shelf {
  padding-top: 12px;
  padding-bottom: 12px;
}

.popup-bookshelf {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bookshelf-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bookshelf-heading h2 {
  margin: 0;
  color: var(--fr-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.bookshelf-heading p {
  margin: 3px 0 0;
  color: var(--fr-text-color-regular);
  font-size: 12px;
}

.bookshelf-text-button {
  flex-shrink: 0;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--fr-accent-color);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.popup-book-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.popup-book {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--fr-border-color-lighter);
  border-radius: 8px;
  background: var(--fr-bg-color);
  color: var(--fr-text-color-primary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;
}

.popup-book:hover {
  border-color: var(--fr-border-color);
  background: var(--fr-hover-color);
  transform: translateY(-1px);
}

.popup-book-cover {
  display: grid;
  place-items: center;
  width: 42px;
  height: 56px;
  overflow: hidden;
  border-radius: 5px 8px 8px 5px;
  background: var(--fr-hover-color);
  color: var(--fr-accent-color);
  font-size: 16px;
  font-weight: 600;
}

.popup-book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.popup-book-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.popup-book-copy strong,
.popup-book-copy > span:not(.popup-book-progress) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-book-copy strong {
  font-size: 13px;
  font-weight: 600;
}

.popup-book-copy > span:not(.popup-book-progress),
.popup-book-copy small {
  color: var(--fr-text-color-regular);
  font-size: 11px;
}

.popup-book-progress {
  height: 3px;
  margin: 8px 0 5px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--fr-border-color-lighter);
}

.popup-book-progress i {
  display: block;
  height: 100%;
  background: var(--fr-accent-color);
}

.popup-book-arrow {
  color: var(--fr-text-color-regular);
  font-size: 22px;
}

.bookshelf-status,
.bookshelf-empty {
  display: flex;
  min-height: 168px;
  align-items: center;
  justify-content: center;
  color: var(--fr-text-color-regular);
  font-size: 12px;
  text-align: center;
}

.bookshelf-status--error {
  color: var(--el-color-danger);
}

.bookshelf-empty {
  flex-direction: column;
  gap: 8px;
}

.bookshelf-empty strong {
  color: var(--fr-text-color-primary);
  font-size: 14px;
}

.bookshelf-empty p {
  margin: 0;
}

.bookshelf-empty-icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 5px 10px 10px 5px;
  background: var(--fr-hover-color);
  color: var(--fr-accent-color);
  font-size: 11px;
  font-weight: 600;
}

.bookshelf-empty-icon svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bookshelf-import {
  width: 100%;
  height: 36px;
  border: 1px solid var(--fr-border-color);
  border-radius: 7px;
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.bookshelf-import:disabled {
  opacity: .6;
  cursor: wait;
}

.bookshelf-import:hover {
  border-color: var(--fr-accent-color);
  color: var(--fr-accent-color);
}

.popup-file-input {
  display: none;
}

/* ===== Translate Page Button - Solid Minimal Style ===== */
.translate-page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  width: 100%;
  padding: 0 20px;
  margin: 0 0 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  background: var(--fr-accent-color);
  border: 1px solid transparent;
  color: #ffffff;
  transition: all 0.2s ease;
}

.translate-page-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.dark .translate-page-btn:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.translate-page-btn:active {
  transform: translateY(0);
}

.translate-page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 还原按钮样式 */
.translate-page-btn.restore-btn {
  background: var(--el-color-warning);
}

.translate-page-btn.restore-btn:hover {
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.25);
}

.dark .translate-page-btn.restore-btn:hover {
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.25);
}

.translate-icon {
  width: 16px;
  height: 16px;
}

/* ===== Setting Row Overrides ===== */
:deep(.setting-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  min-height: 30px;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

:deep(.setting-label) {
  font-size: 13px;
  color: var(--fr-text-color-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.setting-row:last-child) {
  border-bottom: none;
}

:deep(.setting-control) {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

:deep(.setting-control--switch) {
  display: flex;
  justify-content: flex-end;
  flex: 0 0 auto;
}

/* Smaller el-switch */
:deep(.el-switch) {
  --el-switch-height: 20px;
  --el-switch-core-width: 36px;
}

/* ===== Select Styling - Unified Width ===== */
:deep(.setting-control .el-select) {
  width: 176px !important;
}

.service-select {
  flex: 1;
}

/* ===== Footer ===== */
.popup-footer {
  display: flex;
  flex-direction: column;
  padding: 7px 16px 9px;
  border-top: 1px solid var(--fr-border-color-lighter);
  background: var(--fr-bg-color);
  gap: 6px;
}

.popup-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.popup-nav-button {
  position: relative;
  display: flex;
  height: 50px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fr-text-color-regular);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all .18s ease;
}

.popup-nav-button:hover {
  background: var(--fr-hover-color);
  color: var(--fr-text-color-primary);
}

.popup-nav-button--active {
  background: transparent;
  color: var(--fr-accent-color);
}

.popup-nav-button svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.popup-nav-beta {
  position: absolute;
  top: 3px;
  right: 14px;
  color: #e53935;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: .3px;
}

/* ===== Select & Input ===== */
.select-left {
  text-align: left;
}

/* ===== Select Divider ===== */
.select-divider {
  font-size: 11px;
  color: var(--fr-text-color-regular);
  padding: 6px 12px 4px;
  cursor: default;
  font-weight: 500;
  pointer-events: none;
  opacity: 0.7;
  background: transparent;
  border-bottom: none;
  margin: 0;
}

/* ===== Select Action Item ===== */
.select-action {
  font-size: 12px;
  color: var(--fr-accent-color);
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  border-top: 1px solid var(--fr-border-color-lighter);
  margin-top: 4px;
}

.select-action:hover {
  background: var(--fr-hover-color);
  color: var(--fr-accent-color);
}

.dark .select-action {
  color: var(--fr-accent-color);
}

/* ===== Scope Toggle ===== */
.scope-toggle {
  display: flex;
  align-items: center;
  background: var(--fr-hover-color);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.scope-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  color: var(--fr-text-color-regular);
  background: transparent;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.scope-btn:hover {
  color: var(--fr-text-color-primary);
}

.scope-btn--active {
  background: var(--fr-accent-color);
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(37, 99, 235, 0.22);
}

.dark .scope-btn--active {
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.28);
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--fr-border-color);
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

</style>
