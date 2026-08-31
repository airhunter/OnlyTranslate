<template>
  <div
    ref="floatingBall"
    class="fr-floating-ball"
    :class="{
      'dragging': isDragging,
      'is-translating': isTranslating,
      'is-pdf': Boolean(pdfSource),
      'animating': isAnimating && config.animations,
      'static-mode': !config.animations
    }"
    :data-position="currentDisplayPosition"
    :style="positionStyle"
  >
    <div
      class="floating-toolbar floating-toolbar--detached"
      :class="{ 'floating-toolbar--open': isToolbarOpen }"
      data-testid="floating-toolbar"
      @click.stop
      @mousedown.stop
    >
      <template v-if="!pdfSource">
        <button
          type="button"
          class="scope-toggle"
          :data-scope="activeScope"
          data-testid="floating-toolbar-scope"
          @click="toggleScope"
        >
          <span class="scope-toggle-option scope-toggle-option--smart">{{ t('popup.smartScope') }}</span>
          <span class="scope-toggle-option scope-toggle-option--full">{{ t('popup.fullScope') }}</span>
        </button>

        <span class="service-menu-wrap" :class="{ 'service-menu-wrap--open': isServiceMenuOpen }">
          <button
            type="button"
            class="service-pill service-pill--button"
            data-testid="floating-toolbar-service"
            :title="t('popup.service')"
            @click.stop="toggleServiceMenu"
          >
            {{ activeServiceLabel }}
          </button>
          <span
            class="service-menu"
            :class="{ 'service-menu--open': isServiceMenuOpen }"
            data-testid="floating-toolbar-service-menu"
          >
            <button
              v-for="service in availableServiceOptions"
              :key="service.value"
              type="button"
              class="service-menu-item"
              :class="{ 'service-menu-item--active': service.value === activeService }"
              :data-testid="`floating-toolbar-service-${service.value}`"
              @click.stop="selectService(service.value)"
            >
              {{ service.label }}
            </button>
          </span>
        </span>
      </template>
      <button
        v-else
        type="button"
        class="toolbar-button toolbar-button--primary"
        data-testid="floating-toolbar-open-pdf"
        @click="openPdfReader"
      >
        {{ t('pdf.openCurrent') }}
      </button>

      <button
        v-if="!pdfSource"
        type="button"
        class="toolbar-button toolbar-button--secondary"
        data-testid="floating-toolbar-reading"
        @click="openReading"
      >
        {{ t('popup.ebooksTab') }}
      </button>

      <button
        type="button"
        class="toolbar-button toolbar-button--secondary"
        data-testid="floating-toolbar-more"
        @click="openMore"
      >
        {{ t('runtime.floatingToolbar.more') }}
      </button>
    </div>

    <button
      type="button"
      class="floating-ball-more-trigger"
      data-testid="floating-ball-more-trigger"
      :aria-expanded="isToolbarOpen"
      :aria-label="t('runtime.floatingToolbar.open')"
      @mousedown.stop
      @click.stop="toggleToolbar"
    >
      <svg
        class="floating-ball-more-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="5" cy="12" r="1.9" fill="currentColor"></circle>
        <circle cx="12" cy="12" r="1.9" fill="currentColor"></circle>
        <circle cx="19" cy="12" r="1.9" fill="currentColor"></circle>
      </svg>
    </button>

    <button
      type="button"
      class="floating-ball-trigger"
      data-testid="floating-ball-trigger"
      :aria-label="primaryActionLabel"
      @mousedown="startDrag"
      @click.stop="togglePrimaryTranslation"
    >
      <span v-if="pdfSource" class="floating-ball-pdf-mark" aria-hidden="true">PDF</span>
      <svg v-else class="floating-ball-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="none" d="M0 0h24v24H0z"></path>
        <path
          d="M5 15v2a2 2 0 0 0 1.85 1.995L7 19h3v2H7a4 4 0 0 1-4-4v-2h2zm13-5l4.4 11h-2.155l-1.201-3h-4.09l-1.199 3h-2.154L16 10h2zm-1 2.885L15.753 16h2.492L17 12.885zM8 2v2h4v7H8v3H6v-3H2V4h4V2h2zm9 1a4 4 0 0 1 4 4v2h-2V7a2 2 0 0 0-2-2h-3V3h3zM6 6H4v3h2V6zm4 0H8v3h2V6z"
          fill="currentColor"
        ></path>
      </svg>
      <span v-if="isTranslating" class="check-mark" aria-hidden="true"></span>
      <span v-if="showShortcutTooltip" class="shortcut-tooltip">
        {{ shortcutTip }}
      </span>
      <span ref="rippleContainer" class="ripple-container" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { PropType, CSSProperties } from 'vue';
import { config } from '@/entrypoints/utils/config';
import { isServiceConfigured, options, supportsTranslationOnlyMode } from '@/entrypoints/utils/option';
import { t } from '@/entrypoints/utils/i18n';

type FloatingBallPosition = 'left' | 'right';
type TranslationScope = 'smart' | 'full';
type ServiceOption = { value: string; label: string };

const props = defineProps({
  position: {
    type: String as PropType<FloatingBallPosition>,
    default: 'right',
    validator: (value: string) => ['left', 'right'].includes(value)
  },
  offsetY: {
    type: Number as PropType<number | null>,
    default: null
  },
  showMenu: {
    type: Boolean,
    default: true
  },
  onDocClick: {
    type: Function as PropType<(event: MouseEvent) => void>,
    default: () => { }
  },
  onSettingsClick: {
    type: Function as PropType<(event: MouseEvent) => void>,
    default: () => { }
  },
  onPositionChanged: {
    type: Function as PropType<(newPosition: FloatingBallPosition, offsetY: number | null) => void>,
    default: () => { }
  },
  onTranslationToggle: {
    type: Function as PropType<(isTranslating: boolean) => void>,
    default: () => { }
  },
  onScopeChanged: {
    type: Function as PropType<(scope: TranslationScope) => void>,
    default: () => { }
  },
  onServiceChanged: {
    type: Function as PropType<(service: string) => void>,
    default: () => { }
  },
  pdfSource: {
    type: String,
    default: ''
  },
  onOpenPdf: {
    type: Function as PropType<(source: string) => void>,
    default: () => { }
  },
  onOpenReading: {
    type: Function as PropType<() => void>,
    default: () => { }
  }
});

const floatingBall = ref<HTMLElement | null>(null);
const rippleContainer = ref<HTMLElement | null>(null);
const positionStyle = ref<CSSProperties>({});
const internalPosition = ref<FloatingBallPosition>(props.position);
const draggedY = ref<number | null>(props.offsetY ?? null);
const isToolbarOpen = ref(false);
const isServiceMenuOpen = ref(false);
const isDragging = ref(false);
const isTranslating = ref(false);
const isAnimating = ref(false);
const showShortcutTooltip = ref(false);
const shortcutTip = ref(t('runtime.shortcutTip', { shortcut: 'Alt+T' }));
const pointerStartX = ref(0);
const pointerStartY = ref(0);
const pointerLastX = ref(0);
const pointerLastY = ref(0);
const suppressNextClick = ref(false);
const activeScope = ref<TranslationScope>(config.translationScope === 'full' ? 'full' : 'smart');
const activeService = ref(config.service);
const availableServiceOptions = ref<ServiceOption[]>([]);

const currentDisplayPosition = computed(() => internalPosition.value);
const primaryActionLabel = computed(() => props.pdfSource
  ? t('pdf.openCurrent')
  : isTranslating.value
    ? t('runtime.floatingToolbar.restore')
    : t('runtime.floatingToolbar.translate'));
const getServiceLabel = (serviceValue: string) => {
  const customProvider = config.customProviders?.find(provider => provider.id === serviceValue);
  if (customProvider?.name) return customProvider.name;
  const service = options.services.find(item => item.value === serviceValue);
  return service?.label ?? serviceValue;
};
const activeServiceLabel = computed(() => getServiceLabel(activeService.value));
const buildAvailableServiceOptions = (): ServiceOption[] => {
  const result: ServiceOption[] = [];

  for (const item of options.services) {
    if (item.disabled) continue;
    const isDisplayModeIncompatible = config.display === 0
      && !supportsTranslationOnlyMode(item.value);
    if (!isDisplayModeIncompatible && isServiceConfigured(item.value, config)) {
      result.push({ value: item.value, label: item.label });
    }
  }

  for (const provider of config.customProviders ?? []) {
    if (isServiceConfigured(provider.id, config)) {
      result.push({
        value: provider.id,
        label: provider.name || provider.id
      });
    }
  }

  return result;
};

const syncToolbarState = () => {
  activeScope.value = config.translationScope === 'full' ? 'full' : 'smart';
  activeService.value = config.service;
  availableServiceOptions.value = buildAvailableServiceOptions();
  isServiceMenuOpen.value = false;
};

const clampVerticalOffset = (offsetY: number) => {
  const floatingBallHeight = floatingBall.value?.getBoundingClientRect().height || 42;
  const maxY = window.innerHeight - floatingBallHeight;
  return Math.max(8, Math.min(offsetY, maxY - 8));
};

const updatePositionStyle = () => {
  if (isDragging.value) return;

  const sideProperty = internalPosition.value === 'left' ? 'left' : 'right';
  const style: CSSProperties = {
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined,
    transform: undefined
  };

  style[sideProperty] = '18px';

  if (draggedY.value === null) {
    style.bottom = '74px';
  } else {
    const clampedOffsetY = clampVerticalOffset(draggedY.value);
    draggedY.value = clampedOffsetY;
    style.top = `${clampedOffsetY}px`;
  }

  positionStyle.value = style;
};

const toggleToolbar = () => {
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  if (!isToolbarOpen.value) {
    syncToolbarState();
  } else {
    isServiceMenuOpen.value = false;
  }
  isToolbarOpen.value = !isToolbarOpen.value;
};

const startDrag = (event: MouseEvent) => {
  if (event.button !== 0 || !floatingBall.value) return;

  isDragging.value = true;
  pointerStartX.value = event.clientX;
  pointerStartY.value = event.clientY;
  pointerLastX.value = event.clientX;
  pointerLastY.value = event.clientY;

  const rect = floatingBall.value.getBoundingClientRect();
  positionStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: 'auto',
    bottom: 'auto',
    transform: 'none'
  };

  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  event.preventDefault();
};

const drag = (event: MouseEvent) => {
  if (!isDragging.value || !floatingBall.value) return;

  const rect = floatingBall.value.getBoundingClientRect();
  const offsetX = event.clientX - pointerLastX.value;
  const offsetY = event.clientY - pointerLastY.value;
  const movedX = Math.abs(event.clientX - pointerStartX.value);
  const movedY = Math.abs(event.clientY - pointerStartY.value);
  const maxX = window.innerWidth - rect.width;
  const maxY = window.innerHeight - rect.height;

  if (movedX > 5 || movedY > 5) {
    isToolbarOpen.value = false;
    isServiceMenuOpen.value = false;
  }

  positionStyle.value = {
    left: `${Math.max(0, Math.min(rect.left + offsetX, maxX))}px`,
    top: `${Math.max(0, Math.min(rect.top + offsetY, maxY))}px`,
    right: 'auto',
    bottom: 'auto',
    transform: 'none'
  };

  pointerLastX.value = event.clientX;
  pointerLastY.value = event.clientY;
};

const stopDrag = (event: MouseEvent) => {
  if (!isDragging.value || !floatingBall.value) return;

  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);

  const movedX = Math.abs(event.clientX - pointerStartX.value);
  const movedY = Math.abs(event.clientY - pointerStartY.value);
  const isDragGesture = movedX > 5 || movedY > 5;

  if (!isDragGesture) {
    suppressNextClick.value = false;
    isDragging.value = false;
    nextTick(updatePositionStyle);
    return;
  }

  const rect = floatingBall.value.getBoundingClientRect();
  const nextPosition = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
  const nextOffsetY = clampVerticalOffset(rect.top);

  internalPosition.value = nextPosition;
  draggedY.value = nextOffsetY;
  suppressNextClick.value = isDragGesture;
  isDragging.value = false;
  props.onPositionChanged(nextPosition, nextOffsetY);

  nextTick(updatePositionStyle);
};

const addRippleEffect = (color: string) => {
  if (!rippleContainer.value) return;

  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  ripple.style.backgroundColor = color;
  rippleContainer.value.appendChild(ripple);

  setTimeout(() => {
    ripple.classList.add('active');
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, 10);
};

const triggerAnimation = (type: 'translate' | 'restore') => {
  isAnimating.value = true;
  addRippleEffect(type === 'translate' ? '#5bb5f5' : '#20a77a');
  showShortcutTooltip.value = true;

  setTimeout(() => {
    showShortcutTooltip.value = false;
  }, 1800);

  setTimeout(() => {
    isAnimating.value = false;
  }, 500);
};

const setTranslationState = (nextState: boolean) => {
  if (isTranslating.value === nextState) return;
  isTranslating.value = nextState;
  triggerAnimation(nextState ? 'translate' : 'restore');
  props.onTranslationToggle(nextState);
};

const syncTranslationState = (nextState: boolean) => {
  if (isTranslating.value === nextState) return;
  isTranslating.value = nextState;
  triggerAnimation(nextState ? 'translate' : 'restore');
};

const toggleTranslation = () => {
  setTranslationState(!isTranslating.value);
};

const togglePrimaryTranslation = () => {
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  if (props.pdfSource) {
    openPdfReader();
    return;
  }
  toggleTranslation();
};

const toggleTranslationFromExternal = () => {
  if (props.pdfSource) {
    openPdfReader();
    return;
  }
  toggleTranslation();
};

const openPdfReader = () => {
  if (!props.pdfSource) return;
  isToolbarOpen.value = false;
  isServiceMenuOpen.value = false;
  props.onOpenPdf(props.pdfSource);
};

const openReading = () => {
  isToolbarOpen.value = false;
  isServiceMenuOpen.value = false;
  props.onOpenReading();
};

const toggleScope = () => {
  const nextScope: TranslationScope = activeScope.value === 'full' ? 'smart' : 'full';
  activeScope.value = nextScope;
  props.onScopeChanged(nextScope);
};

const toggleServiceMenu = () => {
  isServiceMenuOpen.value = !isServiceMenuOpen.value;
};

const selectService = (service: string) => {
  activeService.value = service;
  isServiceMenuOpen.value = false;
  props.onServiceChanged(service);
};

const openMore = (event: MouseEvent) => {
  props.onSettingsClick(event);
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  if (floatingBall.value?.contains(target)) return;
  isToolbarOpen.value = false;
  isServiceMenuOpen.value = false;
};

onMounted(() => {
  internalPosition.value = props.position;
  draggedY.value = props.offsetY ?? null;
  availableServiceOptions.value = buildAvailableServiceOptions();
  updatePositionStyle();
  window.addEventListener('resize', updatePositionStyle);
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePositionStyle);
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('click', handleClickOutside);
});

watch(() => props.position, (newPosition) => {
  if (newPosition !== internalPosition.value) {
    internalPosition.value = newPosition;
    updatePositionStyle();
  }
});

watch(() => props.offsetY, (newOffsetY) => {
  draggedY.value = newOffsetY ?? null;
  updatePositionStyle();
});

defineExpose({
  isTranslating,
  setTranslationState,
  syncTranslationState,
  toggleTranslationFromExternal
});
</script>

<style scoped>
.fr-floating-ball {
  position: fixed;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: auto;
  height: 42px;
  user-select: none;
  touch-action: none;
  transition: top 0.22s ease, left 0.22s ease, right 0.22s ease, bottom 0.22s ease;
  --fr-sky: #5bb5f5;
  --fr-sky-deep: #258ed8;
  --fr-sky-ink: #126da8;
  --fr-sky-soft: #edf8ff;
  --fr-sky-line: #b9e3fb;
  --fr-done: #20a77a;
  --fr-done-deep: #0f7c5a;
  --fr-done-line: #b8ead7;
}

.fr-floating-ball[data-position="right"] {
  flex-direction: row;
}

.fr-floating-ball[data-position="left"] {
  flex-direction: row-reverse;
}

.fr-floating-ball.dragging {
  transition: none;
}

.floating-ball-more-trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 1px solid #d8e2ee;
  border-radius: 50%;
  color: #4c586d;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 20px rgba(23, 32, 51, 0.10);
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.floating-ball-more-icon {
  display: block;
  width: 16px;
  height: 16px;
}

.floating-ball-more-trigger:hover {
  border-color: var(--fr-sky-line);
  color: var(--fr-sky-deep);
  background: var(--fr-sky-soft);
  transform: translateY(-1px);
}

.floating-ball-more-trigger:active {
  transform: scale(0.96);
}

.floating-ball-more-trigger[aria-expanded="true"] {
  border-color: var(--fr-sky);
  color: var(--fr-sky-deep);
  background: #ffffff;
}

.floating-ball-trigger {
  position: relative;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: var(--fr-sky);
  color: #ffffff;
  box-shadow: 0 14px 32px rgba(91, 181, 245, 0.34);
  cursor: pointer;
  overflow: visible;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.floating-ball-trigger:hover {
  transform: translateY(-1px);
  background: #4aaaf0;
  box-shadow: 0 16px 36px rgba(91, 181, 245, 0.38);
}

.floating-ball-trigger:active {
  transform: scale(0.96);
}

.floating-ball-logo {
  width: 24px;
  height: 24px;
  padding: 2px;
  color: #ffffff;
  background: transparent;
}

.floating-ball-pdf-mark {
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .03em;
}

.is-translating .floating-ball-trigger {
  border-color: transparent;
  background: var(--fr-sky);
  box-shadow: 0 14px 32px rgba(91, 181, 245, 0.34);
}

.is-translating .floating-ball-logo {
  background: transparent;
}

.animating.is-translating .floating-ball-trigger {
  animation: pulse-green 0.5s ease;
}

.animating:not(.is-translating) .floating-ball-trigger {
  animation: pulse-blue 0.5s ease;
}

.static-mode .floating-ball-trigger {
  animation: none !important;
}

@keyframes pulse-green {
  0% {
    box-shadow: 0 12px 28px rgba(23, 32, 51, 0.18);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(32, 167, 122, 0.16);
    transform: scale(1.08);
  }
  100% {
    box-shadow: 0 14px 32px rgba(91, 181, 245, 0.34);
    transform: scale(1);
  }
}

@keyframes pulse-blue {
  0% {
    box-shadow: 0 14px 32px rgba(91, 181, 245, 0.34);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(91, 181, 245, 0.20);
    transform: scale(1.08);
  }
  100% {
    box-shadow: 0 14px 32px rgba(91, 181, 245, 0.34);
    transform: scale(1);
  }
}

.check-mark {
  position: absolute;
  right: -1px;
  bottom: -1px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--fr-done);
}

.check-mark::after {
  content: "";
  width: 4px;
  height: 7px;
  border-right: 1.6px solid #ffffff;
  border-bottom: 1.6px solid #ffffff;
  transform: rotate(45deg) translate(-1px, -1px);
}

.shortcut-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  max-width: 220px;
  padding: 5px 8px;
  border-radius: 6px;
  color: #ffffff;
  background: rgba(16, 24, 40, 0.82);
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  pointer-events: none;
}

.ripple-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 50%;
  pointer-events: none;
}

.ripple-container :deep(.ripple) {
  position: absolute;
  inset: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0.35;
  transform: translate(-50%, -50%) scale(1);
  transition: transform 0.6s ease, opacity 0.6s ease;
}

.ripple-container :deep(.ripple.active) {
  opacity: 0;
  transform: translate(-50%, -50%) scale(8);
}

.floating-toolbar {
  position: absolute;
  top: 50%;
  right: calc(100% + 8px);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(520px, calc(100vw - 92px));
  padding: 8px;
  border: 1px solid #dfe5ef;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 44px rgba(23, 32, 51, 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translate(10px, -50%) scale(0.86);
  transform-origin: right center;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fr-floating-ball[data-position="left"] .floating-toolbar {
  right: auto;
  left: calc(100% + 8px);
  transform: translate(-10px, -50%) scale(0.86);
  transform-origin: left center;
}

.floating-toolbar--open {
  opacity: 1;
  pointer-events: auto;
  transform: translate(0, -50%) scale(1);
}

.fr-floating-ball[data-position="left"] .floating-toolbar--open {
  transform: translate(0, -50%) scale(1);
}

.toolbar-button,
.scope-toggle,
.service-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border-radius: 8px;
  white-space: nowrap;
  font-size: 13px;
}

.toolbar-button {
  padding: 0 11px;
  border: 1px solid #dfe5ef;
  color: #172033;
  background: #ffffff;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.toolbar-button:hover {
  border-color: var(--fr-sky-line);
  background: var(--fr-sky-soft);
}

.toolbar-button:active {
  transform: scale(0.96);
}

.toolbar-button--primary {
  border-color: var(--fr-sky);
  color: #ffffff;
  background: var(--fr-sky);
  font-weight: 680;
}

.toolbar-button--primary:hover {
  border-color: var(--fr-sky-deep);
  background: var(--fr-sky-deep);
}

.toolbar-button--restore {
  border-color: var(--fr-done);
  background: var(--fr-done);
}

.toolbar-button--restore:hover {
  border-color: var(--fr-done-deep);
  background: var(--fr-done-deep);
}

.toolbar-button--secondary {
  color: #344154;
  border-color: #dbe3ee;
  background: #f8fafc;
}

.toolbar-button--secondary:hover {
  color: #263244;
  border-color: #cbd6e6;
  background: #f1f5fb;
}

.scope-toggle {
  gap: 3px;
  padding: 3px;
  border: 1px solid #d8e0ec;
  background: #eef2f7;
  cursor: pointer;
}

.scope-toggle-option {
  display: grid;
  place-items: center;
  min-width: 40px;
  height: 24px;
  border-radius: 6px;
  color: #647084;
  font-size: 12px;
}

.scope-toggle[data-scope="smart"] .scope-toggle-option--smart,
.scope-toggle[data-scope="full"] .scope-toggle-option--full {
  color: var(--fr-sky-ink);
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(23, 32, 51, 0.12);
  font-weight: 700;
}

.service-pill {
  max-width: 138px;
  padding: 0 10px;
  overflow: hidden;
  color: #4a5567;
  border: 1px solid #dfe5ef;
  background: #f8fafc;
  text-overflow: ellipsis;
}

.service-menu-wrap {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

.service-pill--button {
  cursor: pointer;
}

.service-pill--button::after {
  content: "";
  width: 5px;
  height: 5px;
  margin-left: 6px;
  border-right: 1.5px solid #647084;
  border-bottom: 1.5px solid #647084;
  transform: translateY(-1px) rotate(45deg);
}

.service-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 2;
  display: grid;
  gap: 4px;
  width: 156px;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 14px 36px rgba(23, 32, 51, 0.14);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-6px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.fr-floating-ball[data-position="left"] .service-menu {
  right: auto;
  left: 0;
}

.service-menu--open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.service-menu-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 30px;
  width: 100%;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  color: #263244;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
}

.service-menu-item:hover {
  background: #f1f5fb;
}

.service-menu-item--active {
  color: var(--fr-sky-ink);
  background: var(--fr-sky-soft);
  font-weight: 700;
}

@media (max-width: 520px) {
  .floating-toolbar {
    gap: 6px;
    padding: 7px;
    max-width: calc(100vw - 76px);
  }

  .service-pill {
    max-width: 92px;
  }

  .toolbar-button,
  .scope-toggle,
  .service-pill {
    font-size: 12px;
  }
}
</style>
