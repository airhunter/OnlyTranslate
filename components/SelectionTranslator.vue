<template>
  <div ref="selection-ref" class="fr-selection-translator-wrapper">
      <!-- 小红点指示器 -->
      <div v-if="showIndicator" 
          class="fr-selection-indicator" 
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave">
      </div>
    
      <!-- 翻译结果弹窗 -->
      <div v-if="showTooltip" 
          class="fr-translation-tooltip" 
          :class="{ 'fr-dark-theme': isDarkTheme }"
          @mouseenter="handleMouseEnterTooltip"
          @mouseleave="handleMouseLeaveTooltip">
        <div class="fr-tooltip-header">
          <span>{{ t('selection.title') }}<small>（{{ t('selection.via') }}）</small></span>
          <div class="fr-tooltip-actions">
            <button class="fr-action-btn" @click="copyTranslation" :title="t('selection.copyTranslation')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="fr-close-btn" @click="closeTooltip">×</button>
          </div>
        </div>
        <div class="fr-tooltip-content">
          <div v-if="isLoading" :class="['fr-loading-spinner', { 'fr-static': !config.animations }]"></div>
          <div v-else-if="error" class="fr-error-message">{{ error }}</div>
          <div v-else class="fr-translation-container">
            <!-- 原文显示（双语模式才显示） -->
            <div v-if="config.selectionTranslatorMode === 'bilingual'" class="fr-original-text fr-no-select">
              <pre>{{ selectedText }}</pre>
              <button class="fr-text-audio-btn" @click="(e) => toggleAudio(selectedText, e)" :title="t('selection.playOriginal')">
                <svg v-if="isPlaying && currentPlayingText === selectedText" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
              </button>
            </div>
            <!-- 译文显示（双语模式和只显示译文模式都显示） -->
            <div v-if="config.selectionTranslatorMode === 'bilingual' || config.selectionTranslatorMode === 'translation-only'" class="fr-translation-result fr-no-select">
              <pre>{{ translationResult }}</pre>
              <button class="fr-text-audio-btn" @click="(e) => toggleAudio(translationResult, e)" :title="t('selection.playTranslation')">
                <svg v-if="isPlaying && currentPlayingText === translationResult" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            </div>
            
            <!-- 播放状态提示 - 显示在弹窗内部 -->
            <div v-if="isPlaying" class="fr-playing-status">
              <div class="fr-playing-status-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
              </div>
              <span>{{ t('selection.playing', { type: currentPlayingText === selectedText ? t('selection.original') : t('selection.translation') }) }}</span>
              <button class="fr-stop-audio-btn" @click="(e) => stopAudio(e)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
  </div>

  <!-- 复制成功提示 -->
  <div v-if="copySuccess" class="fr-copy-success-toast" :class="{ 'fr-dark-theme': isDarkTheme }">
    <div class="fr-copy-success-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <span>{{ t('selection.copied') }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, useTemplateRef, watchEffect } from 'vue';
import { isTranslationCancelledError, translateText } from '@/entrypoints/utils/translateApi';
import { config } from '@/entrypoints/utils/config';
import { autoPlacement, autoUpdate, computePosition, flip, hide, inline, offset, shift } from '@floating-ui/dom';
import { t } from '@/entrypoints/utils/i18n';

// 状态变量
const selectedText = ref('');
const translationResult = ref('');
const selectRange = ref<Range | null>(null);
const showIndicator = ref(false);
const showTooltip = ref(false);
const isLoading = ref(false);
const error = ref('');
const hideTooltipTimer = ref<number | null>(null);
const isHoveringTooltip = ref(false);
const copySuccess = ref(false);
const isPlaying = ref(false);
const audioElement = ref<HTMLAudioElement | null>(null);
const isSelecting = ref(false); // 标记用户是否正在选择文本中
const debounceTimer = ref<number | null>(null); // 防抖定时器
const currentPlayingText = ref(''); // 当前正在播放的文本
const isFirefox = ref(false); // 是否为Firefox浏览器
const isDarkTheme = ref(false); // 主题状态

interface SelectionSession {
  id: number;
  text: string;
  range: Range;
  context: string;
}

const activeSelectionSession = ref<SelectionSession | null>(null);
const isInteractingWithSelectionUi = ref(false);
let nextSelectionSessionId = 0;
let activeTranslationController: AbortController | null = null;
let activeTranslationRequestId = 0;

const containerRef = useTemplateRef('selection-ref');

const getEventPath = (event: Event) => (
  typeof event.composedPath === 'function' ? event.composedPath() : [event.target]
);

const isEventInsideSelectionUi = (event: Event) => {
  const container = containerRef.value;
  if (!container) return false;

  return getEventPath(event).some(node => (
    node === container || (node instanceof Node && container.contains(node))
  ));
};

const eventPathMatches = (event: Event, selector: string) => (
  getEventPath(event).some(node => node instanceof Element && node.matches(selector))
);

const isSelectionUiFocused = () => {
  const root = containerRef.value?.getRootNode();
  return root instanceof ShadowRoot && root.activeElement !== null;
};

// 自动更新小红点位置
watchEffect((onClean) => {
  const isPositioningActive = showIndicator.value || showTooltip.value;
  const range = selectRange.value;
  const container = containerRef.value;
  if (!isPositioningActive || !range || !container) return;

  const updatePosition = () => {
    computePosition(range, container, {
      placement: 'right',
      strategy: 'fixed',
      middleware: [offset(2), flip({fallbackPlacements: ['left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end'], padding: {top: 100, bottom: 100} }), shift(), hide(), inline()],
    }).then(({ x, y, placement, middlewareData }) => {
      Object.assign(container.style, {
        left: `${x}px`,
        top: `${y}px`,
        visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible',
      });
      container.setAttribute('data-placement', placement);
    })
  }

  const cb = autoUpdate(range, container, updatePosition, {
    animationFrame: true,
  });

  onClean(cb);
});

watch([showIndicator, showTooltip], ([isIndicatorVisible, isTooltipVisible]) => {
  if (isIndicatorVisible || isTooltipVisible) return;

  selectRange.value = null;
  activeSelectionSession.value = null;
});

const cancelActiveTranslation = () => {
  activeTranslationRequestId += 1;
  activeTranslationController?.abort();
  activeTranslationController = null;
  isLoading.value = false;
};

const commitSelectionSession = (text: string, range: Range) => {
  cancelActiveTranslation();
  const session: SelectionSession = {
    id: ++nextSelectionSessionId,
    text,
    range,
    context: document.title,
  };
  activeSelectionSession.value = session;
  selectedText.value = session.text;
  selectRange.value = session.range;
  showIndicator.value = true;
};

// 防抖函数
const debounce = (fn: Function, delay: number) => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
  }
  debounceTimer.value = window.setTimeout(() => {
    fn();
    debounceTimer.value = null;
  }, delay);
};

// 处理文本选择事件 (使用防抖优化)
const handleTextSelection = () => {
  // 如果用户正在选择中，不立即处理
  if (isSelecting.value) return;
  
  debounce(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideIndicator();
      return;
    }
    
    const selectedTextContent = selection.toString().trim();
    
    // 如果选中的文本为空，则不处理
    if (!selectedTextContent) {
      return;
    }
    
    // 忽略过短的选择（避免意外触发）
    if (selectedTextContent.length < 2) {
      hideIndicator();
      return;
    }
    
    // 忽略过长的选择（避免处理大段文本导致性能问题）
    const maxTextLength = 4096; // 设置最大字符数限制
    if (selectedTextContent.length > maxTextLength) {
      hideIndicator();
      return;
    }
    
    // 获取选中文本位置信息
    const range = selection.getRangeAt(0);
    
    // 每次选区都创建独立会话；即使文本相同，也不能复用旧请求状态。
    commitSelectionSession(selectedTextContent, range);
  }, 200); // 200ms防抖延迟，减少延迟提高响应性
};

// 鼠标进入指示器
const handleMouseEnter = () => {
  clearHideTooltipTimer();
  showTooltip.value = true;
};

// 鼠标离开指示器
const handleMouseLeave = () => {
  // 如果鼠标不在tooltip上，则设置定时器隐藏tooltip
  if (!isHoveringTooltip.value) {
    setHideTooltipTimer();
  }
};

// 鼠标进入弹窗
const handleMouseEnterTooltip = () => {
  isHoveringTooltip.value = true;
  clearHideTooltipTimer();
};

// 鼠标离开弹窗
const handleMouseLeaveTooltip = () => {
  isHoveringTooltip.value = false;
  
  // 如果当前正在播放音频，不自动隐藏弹窗
  if (isPlaying.value) return;
  
  setHideTooltipTimer();
};

// 设置隐藏弹窗的定时器
const setHideTooltipTimer = () => {
  clearHideTooltipTimer();
  hideTooltipTimer.value = window.setTimeout(() => {
    // 如果当前正在播放音频，不隐藏弹窗
    if (isPlaying.value) return;
    
    showTooltip.value = false;
  }, 250); // 250毫秒后隐藏
};

// 清除隐藏弹窗的定时器
const clearHideTooltipTimer = () => {
  if (hideTooltipTimer.value !== null) {
    clearTimeout(hideTooltipTimer.value);
    hideTooltipTimer.value = null;
  }
};

// 隐藏指示器
const hideIndicator = () => {
  showIndicator.value = false;
  setHideTooltipTimer();
};

// 关闭翻译弹窗
const closeTooltip = () => {
  cancelActiveTranslation();
  showTooltip.value = false;
  // 当关闭弹窗时停止音频播放
  stopAudio();
};

// 获取翻译结果
const getTranslation = async () => {
  const session = activeSelectionSession.value;
  if (!session) return;

  cancelActiveTranslation();
  const requestId = ++activeTranslationRequestId;
  const controller = new AbortController();
  activeTranslationController = controller;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    // 使用当前配置的翻译服务进行翻译
    const result = await translateText(session.text, session.context, {
      signal: controller.signal,
      diagnostics: {
        scene: 'selection',
        pageUrl: document.location.href,
      },
    });

    if (
      controller.signal.aborted
      || requestId !== activeTranslationRequestId
      || activeSelectionSession.value?.id !== session.id
    ) {
      return;
    }
    translationResult.value = result;
  } catch (err) {
    if (
      controller.signal.aborted
      || requestId !== activeTranslationRequestId
      || isTranslationCancelledError(err)
    ) {
      return;
    }
    error.value = t('selection.failed');
    console.error('Translation error:', err);
  } finally {
    if (requestId === activeTranslationRequestId) {
      activeTranslationController = null;
      isLoading.value = false;
    }
  }
};

// 复制翻译文本
const copyTranslation = () => {
  if (!translationResult.value) return;
  
  // 使用navigator.clipboard API复制文本
  navigator.clipboard.writeText(translationResult.value)
    .then(() => {
      // 显示复制成功消息
      copySuccess.value = true;
      // 1.5秒后隐藏消息
      setTimeout(() => {
        copySuccess.value = false;
      }, 1500);
    })
    .catch(err => {
      console.error('复制失败:', err);
    });
};

// 播放或停止文本语音
const toggleAudio = (text: string, e?: Event) => {
  if (!text) return;

  // 用户点击音频按钮时阻止冒泡；程序化调用没有事件对象，无需处理。
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  
  // 确保弹窗不会消失
  clearHideTooltipTimer();
  isHoveringTooltip.value = true;

  // 如果当前正在播放同一文本，则停止播放
  if (isPlaying.value && currentPlayingText.value === text) {
    stopAudio(e);
    return;
  }
  
  // 如果正在播放其他文本，先停止
  if (isPlaying.value) {
    stopAudio(e);
  }
  
  // 检测语言
  const language = detectLanguage(text);
  
  // 创建语音合成URL
  const speechUrl = createSpeechUrl(text, language);
  
  // 创建音频元素前先设置状态，解决Firefox中状态更新不及时的问题
  isPlaying.value = true;
  currentPlayingText.value = text;
  
  // 创建音频元素
  const audio = new Audio(speechUrl);
  audioElement.value = audio;
  
  // 监听播放开始事件
  audio.onplay = () => {
    // 确保状态已更新
    isPlaying.value = true;
    currentPlayingText.value = text;
  };
  
  // 监听播放结束事件
  audio.onended = () => {
    isPlaying.value = false;
    audioElement.value = null;
    currentPlayingText.value = '';
  };
  
  // 监听错误事件
  audio.onerror = (e) => {
    console.error('音频播放失败:', e);
    isPlaying.value = false;
    audioElement.value = null;
    currentPlayingText.value = '';
    
    // 不要尝试使用Web Speech API作为备选，避免重复播放
    // tryWebSpeechAPI(text, language);
  };
  
  // 开始播放
  const playPromise = audio.play();
  
  // 处理播放Promise
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.error('音频播放出错:', err);
      isPlaying.value = false;
      audioElement.value = null;
      currentPlayingText.value = '';
      
      // 尝试使用Web Speech API作为备选，只在Google TTS失败时使用
      tryWebSpeechAPI(text, language);
    });
  }
};

// 停止音频播放
const stopAudio = (e?: Event) => {
  // 阻止事件冒泡
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value = null;
  }
  
  // 停止Web Speech API
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  isPlaying.value = false;
  currentPlayingText.value = '';
};

// 检测语言
const detectLanguage = (text: string): string => {
  // 简单的语言检测，可根据实际需求完善
  // 检测是否包含中文字符
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  if (hasChinese) return 'zh-CN';
  
  // 检测是否包含日文字符
  const hasJapanese = /[\u3040-\u30ff]/.test(text);
  if (hasJapanese) return 'ja-JP';
  
  // 检测是否包含韩文字符
  const hasKorean = /[\uAC00-\uD7A3]/.test(text);
  if (hasKorean) return 'ko-KR';
  
  // 检测是否包含俄文字符
  const hasRussian = /[\u0400-\u04FF]/.test(text);
  if (hasRussian) return 'ru-RU';
  
  // 检测是否包含德文特殊字符
  const hasGerman = /[äöüßÄÖÜ]/.test(text);
  if (hasGerman) return 'de-DE';
  
  // 检测是否包含法文特殊字符
  const hasFrench = /[àâçéèêëîïôùûüÿæœÀÂÇÉÈÊËÎÏÔÙÛÜŸÆŒ]/.test(text);
  if (hasFrench) return 'fr-FR';
  
  // 检测是否包含西班牙文特殊字符
  const hasSpanish = /[áéíóúüñÁÉÍÓÚÜÑ]/.test(text);
  if (hasSpanish) return 'es-ES';
  
  // 默认返回英语
  return 'en-US';
};

// 创建语音合成URL
const createSpeechUrl = (text: string, language: string): string => {
  // 使用Google Text-to-Speech API
  const encodedText = encodeURIComponent(text);
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${language}&client=tw-ob&q=${encodedText}`;
};

// 使用Web Speech API作为备选方案
const tryWebSpeechAPI = (text: string, language: string) => {
  // 如果已经在播放，不要重复播放
  if (isPlaying.value) return;
  
  // 检查浏览器是否支持Web Speech API
  if ('speechSynthesis' in window) {
    // 停止任何可能正在播放的内容
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    
    // 设置状态
    isPlaying.value = true;
    currentPlayingText.value = text;
    
    utterance.onstart = () => {
      // 确保状态已更新
      isPlaying.value = true;
      currentPlayingText.value = text;
    };
    
    utterance.onend = () => {
      isPlaying.value = false;
      currentPlayingText.value = '';
    };
    
    utterance.onerror = () => {
      isPlaying.value = false;
      currentPlayingText.value = '';
    };
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.error('此浏览器不支持语音合成');
  }
};

// 检测是否为Firefox浏览器
const detectFirefox = () => {
  return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
};

// 获取当前主题状态
const getCurrentTheme = () => {
  const currentTheme = config.theme || 'auto';
  if (currentTheme === 'auto') {
    // 自动模式下检测系统主题
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return currentTheme === 'dark';
};

// 更新主题状态
const updateTheme = () => {
  isDarkTheme.value = getCurrentTheme();
};

watch(
  [showTooltip, () => activeSelectionSession.value?.id ?? 0],
  ([isTooltipVisible]) => {
    if (isTooltipVisible) {
      void getTranslation();
      return;
    }

    cancelActiveTranslation();
    if (isPlaying.value) {
      stopAudio();
    }
  }
);

// 监听事件
onMounted(() => {
  // 检测浏览器类型
  isFirefox.value = detectFirefox();
  
  // 初始化主题状态
  updateTheme();
  
  // 监听主题变化
  watch(() => config.theme, updateTheme, { immediate: true });
  
  // 监听系统主题变化（用于自动模式）
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (config.theme === 'auto') {
      updateTheme();
    }
  };
  darkModeMediaQuery.addEventListener('change', handleSystemThemeChange);
  
  // 保存系统主题监听器引用供清理使用
  systemThemeHandler = handleSystemThemeChange;
  
  // 定义事件监听器函数
  mouseDownHandler = (event: MouseEvent) => {
    if (isEventInsideSelectionUi(event)) {
      isInteractingWithSelectionUi.value = true;
      isSelecting.value = false;
      return;
    }

    isInteractingWithSelectionUi.value = false;
    isSelecting.value = true;
  };
  
  mouseUpHandler = (event: MouseEvent) => {
    if (isEventInsideSelectionUi(event)) {
      isSelecting.value = false;
      window.setTimeout(() => {
        isInteractingWithSelectionUi.value = false;
      }, 0);
      return;
    }

    isInteractingWithSelectionUi.value = false;
    isSelecting.value = false;
    handleTextSelection();
  };
  
  // 鼠标按下时，标记开始选择
  document.addEventListener('mousedown', mouseDownHandler);
  
  // 鼠标抬起时，标记选择结束，并处理选中文本
  document.addEventListener('mouseup', mouseUpHandler);
  
  // 添加selectionchange事件作为备用机制（使用节流限制频率）
  let lastSelectionChangeTime = 0;
  selectionChangeHandler = () => {
    if (isInteractingWithSelectionUi.value || isSelectionUiFocused()) return;

    const now = Date.now();
    // 节流：只有在500ms内没有处理过selectionchange且不在选择过程中时才处理
    if (now - lastSelectionChangeTime > 500 && !isSelecting.value) {
      lastSelectionChangeTime = now;
      // 延迟处理，确保选择操作完成
      setTimeout(() => {
        if (!isSelecting.value) {
          handleTextSelection();
        }
      }, 100);
    }
  };
  
  document.addEventListener('selectionchange', selectionChangeHandler);
  
  // 定义点击事件处理函数
  clickHandler = (e: Event) => {
    // 检查点击事件是否发生在音频按钮上
    const isAudioButton = eventPathMatches(e, '.fr-text-audio-btn, .fr-stop-audio-btn');
    
    // 如果点击在音频按钮上，不要隐藏弹窗
    if (isAudioButton) {
      return;
    }
    
    if (!isEventInsideSelectionUi(e) && showIndicator.value) {
      hideIndicator();
      closeTooltip();
    }
  };
  
  // 添加点击页面其他区域时隐藏指示器和弹窗
  document.addEventListener('click', clickHandler);
});

// 存储事件监听器函数的引用，用于正确移除
let mouseDownHandler: (event: MouseEvent) => void;
let mouseUpHandler: (event: MouseEvent) => void;
let clickHandler: (e: Event) => void;
let selectionChangeHandler: () => void;
let systemThemeHandler: () => void;

// 清理事件监听 (修复清理逻辑)
onBeforeUnmount(() => {
  cancelActiveTranslation();

  // 正确移除事件监听器
  if (mouseDownHandler) {
    document.removeEventListener('mousedown', mouseDownHandler);
  }
  if (mouseUpHandler) {
    document.removeEventListener('mouseup', mouseUpHandler);
  }
  if (clickHandler) {
    document.removeEventListener('click', clickHandler);
  }
  if (selectionChangeHandler) {
    document.removeEventListener('selectionchange', selectionChangeHandler);
  }
  
  // 移除系统主题监听器
  if (systemThemeHandler) {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.removeEventListener('change', systemThemeHandler);
  }
  
  // 清理所有定时器
  clearHideTooltipTimer();
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
    debounceTimer.value = null;
  }
  
  // 停止所有音频播放
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value = null;
  }
  
  // 停止Web Speech API
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
});
</script>
