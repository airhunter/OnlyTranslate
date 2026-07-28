<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import { useData } from 'vitepress';
import appIconSmall from '../../../public/icon/48.png';
import appIconLarge from '../../../public/icon/128.png';
import webScreenshotZhCN from '../../../store-assets/chrome-web-store/zh-CN/01-web-translation.png';
import webScreenshotGlobal from '../../../store-assets/chrome-web-store/global/01-web-translation.png';
import subtitleDemoPosterGlobal from '../../../store-assets/chrome-web-store/global/02-video-subtitles.png';
import epubDemoPosterGlobal from '../../../store-assets/chrome-web-store/global/03-ebook-reader-beta.png';
import demoPoster from '../../../store-assets/demos/web-bilingual-reading/poster-horizontal.webp';
import demoVideo from '../../../store-assets/demos/web-bilingual-reading/onlytranslate-web-bilingual-horizontal-voiceover.mp4';
import subtitleDemoPoster from '../../../store-assets/demos/video-bilingual-subtitles/poster-horizontal.webp';
import subtitleDemoVideo from '../../../store-assets/demos/video-bilingual-subtitles/onlytranslate-video-subtitles-horizontal-voiceover.mp4';
import epubDemoPoster from '../../../store-assets/demos/epub-bilingual-reading/poster-horizontal.webp';
import epubDemoVideo from '../../../store-assets/demos/epub-bilingual-reading/onlytranslate-epub-bilingual-horizontal-voiceover.mp4';
import {
  homeMessages,
  resolveWebsiteLocale,
  websiteLocaleOptions,
  websiteLocaleRoutes,
  type DemoId,
} from './homeMessages';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi';
const githubUrl = 'https://github.com/airhunter/OnlyTranslate';
const issuesUrl = 'https://github.com/airhunter/OnlyTranslate/issues';
const releasesUrl = 'https://github.com/airhunter/OnlyTranslate/releases';
const fluentReadUrl = 'https://github.com/Bistutu/FluentRead';

const { lang } = useData();
const pageLocale = computed(() => resolveWebsiteLocale(lang.value));
const copy = computed(() => homeMessages[pageLocale.value]);
const localeBase = computed(() => websiteLocaleRoutes[pageLocale.value]);
const webScreenshot = computed(() =>
  pageLocale.value === 'zh-CN' ? webScreenshotZhCN : webScreenshotGlobal,
);

const localizedPath = (path: string) => `${localeBase.value}${path}`;

function switchLocale(event: Event) {
  const target = event.target as HTMLSelectElement;
  window.location.assign(target.value);
}

const demoIds: DemoId[] = ['web', 'video', 'epub'];
const activeDemo = ref<DemoId>('web');
const demoMedia = ref<HTMLElement>();
const demoVideoElement = ref<HTMLVideoElement>();
const isDemoVisible = ref(false);
let demoObserver: IntersectionObserver | undefined;

const demoAssets: Record<DemoId, {
  poster: string;
  globalPoster: string;
  video: string;
}> = {
  web: {
    poster: demoPoster,
    globalPoster: webScreenshotGlobal,
    video: demoVideo,
  },
  video: {
    poster: subtitleDemoPoster,
    globalPoster: subtitleDemoPosterGlobal,
    video: subtitleDemoVideo,
  },
  epub: {
    poster: epubDemoPoster,
    globalPoster: epubDemoPosterGlobal,
    video: epubDemoVideo,
  },
};

const currentDemo = computed(() => {
  const assets = demoAssets[activeDemo.value];

  return {
    ...assets,
    poster:
      pageLocale.value === 'zh-CN' ? assets.poster : assets.globalPoster,
    ...copy.value.demo.items[activeDemo.value],
  };
});

const currentCaptionTracks = computed(() => [
  {
    locale: 'en-US',
    srclang: 'en',
    label: 'English',
    src: `/captions/${activeDemo.value}.en.vtt`,
  },
  {
    locale: 'zh-TW',
    srclang: 'zh-TW',
    label: '繁體中文',
    src: `/captions/${activeDemo.value}.zh-TW.vtt`,
  },
  {
    locale: 'ja-JP',
    srclang: 'ja',
    label: '日本語',
    src: `/captions/${activeDemo.value}.ja.vtt`,
  },
]);

async function syncDemoPlayback(preferSound = false) {
  const video = demoVideoElement.value;
  if (!video) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const shouldPlay =
    isDemoVisible.value && !document.hidden && !prefersReducedMotion;

  if (!shouldPlay) {
    video.pause();
    return;
  }

  if (preferSound) video.muted = false;

  try {
    await video.play();
  } catch (error) {
    const isAutoplayBlocked =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'NotAllowedError';
    if (!isAutoplayBlocked) return;

    video.muted = true;
    try {
      await video.play();
    } catch {
      // 浏览器仍可能根据用户设置阻止播放，保留原生控件供手动操作。
    }
  }
}

async function selectDemo(demo: DemoId, preferSound = false) {
  if (demo === activeDemo.value) {
    await syncDemoPlayback(preferSound);
    return;
  }

  demoVideoElement.value?.pause();
  activeDemo.value = demo;
  await nextTick();
  await syncDemoPlayback(preferSound);
}

async function selectAdjacentDemo(direction: -1 | 1) {
  const currentIndex = demoIds.indexOf(activeDemo.value);
  const nextIndex =
    (currentIndex + direction + demoIds.length) % demoIds.length;
  const nextDemo = demoIds[nextIndex];

  await selectDemo(nextDemo, true);
  document.getElementById(`demo-tab-${nextDemo}`)?.focus();
}

onMounted(() => {
  const media = demoMedia.value;
  if (!media || !('IntersectionObserver' in window)) {
    isDemoVisible.value = true;
    void syncDemoPlayback();
    return;
  }

  demoObserver = new IntersectionObserver(
    ([entry]) => {
      isDemoVisible.value =
        entry.isIntersecting && entry.intersectionRatio >= 0.35;
      void syncDemoPlayback();
    },
    { threshold: [0, 0.35, 0.75] },
  );
  demoObserver.observe(media);
  document.addEventListener('visibilitychange', syncDemoPlayback);
});

onBeforeUnmount(() => {
  demoObserver?.disconnect();
  document.removeEventListener('visibilitychange', syncDemoPlayback);
});
</script>

<template>
  <div class="landing-page">
    <header class="landing-header">
      <a class="brand" :href="localeBase" :aria-label="copy.brand.homeAria">
        <img
          :src="appIconSmall"
          alt=""
          width="42"
          height="42"
          fetchpriority="high"
        />
        <span>
          <strong>{{ copy.brand.name }}</strong>
          <small>{{ copy.brand.subtitle }}</small>
        </span>
      </a>

      <nav class="landing-nav" :aria-label="copy.nav.aria">
        <a href="#demo">{{ copy.nav.demo }}</a>
        <a href="#services">{{ copy.nav.services }}</a>
        <a href="#privacy">{{ copy.nav.privacy }}</a>
        <a href="#faq">{{ copy.nav.faq }}</a>
      </nav>

      <label class="landing-language">
        <span class="visually-hidden">{{ copy.language.label }}</span>
        <select
          :aria-label="copy.language.label"
          :value="websiteLocaleRoutes[pageLocale]"
          @change="switchLocale"
        >
          <option
            v-for="option in websiteLocaleOptions"
            :key="option.locale"
            :value="option.href"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </header>

    <main>
      <section class="hero section-shell">
        <div class="hero-copy">
          <p class="eyebrow"><span></span> {{ copy.hero.eyebrow }}</p>
          <h1 class="hero-title">
            <span class="hero-title-line">{{ copy.hero.titleLine1 }}</span>
            <span class="hero-title-line hero-title-accent">{{ copy.hero.titleLine2 }}</span>
          </h1>
          <p class="hero-lead">{{ copy.hero.lead }}</p>
          <div class="hero-actions">
            <a
              class="button button-primary button-large"
              :href="chromeWebStoreUrl"
              target="_blank"
              rel="noreferrer"
            >
              <span class="chrome-dots" aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </span>
              {{ copy.hero.install }}
            </a>
            <a
              class="button button-secondary button-large"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ copy.hero.source }}
            </a>
          </div>
          <a
            class="issue-link"
            :href="issuesUrl"
            target="_blank"
            rel="noreferrer"
          >
            {{ copy.hero.issues }}
            <span aria-hidden="true">↗</span>
          </a>
          <ul class="trust-list" :aria-label="copy.hero.trustAria">
            <li v-for="item in copy.hero.trustItems" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="hero-visual" :aria-label="copy.hero.visualAria">
          <div class="hero-glow"></div>
          <div class="browser-frame">
            <div class="browser-bar">
              <span></span><span></span><span></span>
              <div>{{ copy.hero.browserLabel }}</div>
            </div>
            <img
              :src="webScreenshot"
              :alt="copy.hero.screenshotAlt"
              width="1280"
              height="800"
            />
          </div>
          <div class="floating-note note-smart">
            <strong>{{ copy.hero.smart }}</strong>
            <span>{{ copy.hero.smartDetail }}</span>
          </div>
          <div class="floating-note note-bilingual">
            <strong>{{ copy.hero.bilingual }}</strong>
            <span>{{ copy.hero.bilingualDetail }}</span>
          </div>
        </div>
      </section>

      <section class="proof-strip" :aria-label="copy.proof.aria">
        <div class="section-shell proof-panel">
          <div
            v-for="(item, index) in copy.proof.items"
            :key="item.title"
            class="proof-item"
          >
            <span class="proof-mark">{{ String(index + 1).padStart(2, '0') }}</span>
            <div><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></div>
          </div>
        </div>
      </section>

      <section id="demo" class="demo-section section-shell page-section">
        <div class="section-intro centered">
          <p class="section-number">{{ copy.demo.sectionLabel }}</p>
          <h2>{{ copy.demo.title }}</h2>
          <p>{{ copy.demo.description }}</p>
        </div>

        <div class="demo-tabs" role="tablist" :aria-label="copy.demo.tabsAria">
          <button
            v-for="(demo, index) in demoIds"
            :id="`demo-tab-${demo}`"
            :key="demo"
            class="demo-tab"
            :class="{ 'is-active': activeDemo === demo }"
            type="button"
            role="tab"
            :aria-selected="activeDemo === demo"
            :aria-controls="`demo-panel-${demo}`"
            :tabindex="activeDemo === demo ? 0 : -1"
            @click="selectDemo(demo, true)"
            @keydown.left.prevent="selectAdjacentDemo(-1)"
            @keydown.right.prevent="selectAdjacentDemo(1)"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ copy.demo.items[demo].tab }}</strong>
          </button>
        </div>

        <div class="demo-stage">
          <article
            :id="`demo-panel-${activeDemo}`"
            class="demo-panel"
            role="tabpanel"
            :aria-labelledby="`demo-tab-${activeDemo}`"
          >
            <div ref="demoMedia" class="demo-stage-media">
              <video
                :key="activeDemo"
                ref="demoVideoElement"
                controls
                playsinline
                loop
                preload="none"
                :poster="currentDemo.poster"
                :aria-label="currentDemo.ariaLabel"
              >
                <source :src="currentDemo.video" type="video/mp4" />
                <track
                  v-for="track in currentCaptionTracks"
                  :key="track.locale"
                  kind="subtitles"
                  :src="track.src"
                  :srclang="track.srclang"
                  :label="track.label"
                  :default="pageLocale === track.locale"
                />
                {{ copy.demo.unsupported }}
              </video>
            </div>
            <div class="demo-stage-copy">
              <div>
                <p>{{ currentDemo.label }}</p>
                <h3>{{ currentDemo.title }}</h3>
                <p
                  v-if="currentDemo.note"
                  class="demo-language-note"
                >
                  {{ currentDemo.note }}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="services" class="services-section page-section">
        <div class="section-shell services-layout">
          <div class="services-copy">
            <p class="section-number">{{ copy.services.sectionLabel }}</p>
            <h2>{{ copy.services.title }}</h2>
            <p>{{ copy.services.description }}</p>
            <p class="fine-print">{{ copy.services.finePrint }}</p>
          </div>
          <div class="service-cloud" :aria-label="copy.services.aria">
            <span v-for="service in copy.services.providers" :key="service">{{ service }}</span>
          </div>
        </div>
      </section>

      <section id="privacy" class="privacy-section page-section">
        <div class="section-shell">
          <div class="section-intro centered light">
            <p class="section-number">{{ copy.privacy.sectionLabel }}</p>
            <h2>{{ copy.privacy.title }}</h2>
            <p>{{ copy.privacy.description }}</p>
          </div>

          <div class="privacy-grid">
            <article
              v-for="(item, index) in copy.privacy.cards"
              :key="item.title"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.detail }}</p>
            </article>
          </div>

          <div class="privacy-actions">
            <a class="text-link light-link" :href="localizedPath('privacy')">
              {{ copy.privacy.fullPolicy }}
            </a>
            <a
              class="text-link light-link"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ copy.privacy.source }}
            </a>
          </div>
        </div>
      </section>

      <section class="steps-section page-section">
        <div class="section-shell">
          <div class="section-intro">
            <p class="section-number">{{ copy.steps.sectionLabel }}</p>
            <h2>{{ copy.steps.title }}</h2>
          </div>
          <ol class="step-list">
            <li v-for="(item, index) in copy.steps.items" :key="item.title">
              <span>{{ index + 1 }}</span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.detail }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="limits-section">
        <div class="section-shell limits-layout">
          <div>
            <p class="section-number">{{ copy.limits.label }}</p>
            <h2>{{ copy.limits.title }}</h2>
          </div>
          <ul>
            <li v-for="item in copy.limits.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </section>

      <section id="faq" class="faq-section page-section">
        <div class="section-shell faq-layout">
          <div class="section-intro">
            <p class="section-number">{{ copy.faq.sectionLabel }}</p>
            <h2>{{ copy.faq.title }}</h2>
            <p>
              {{ copy.faq.introBefore }}
              <a :href="issuesUrl" target="_blank" rel="noreferrer">{{ copy.faq.introLink }}</a>
              {{ copy.faq.introAfter }}
            </p>
          </div>

          <div class="faq-list">
            <details
              v-for="(item, index) in copy.faq.items"
              :key="item.question"
              :open="index === 0"
            >
              <summary>{{ item.question }}</summary>
              <p>{{ item.answer }}</p>
            </details>
            <details>
              <summary>{{ copy.faq.relationQuestion }}</summary>
              <p>
                {{ copy.faq.relationBefore }}
                <a :href="fluentReadUrl" target="_blank" rel="noreferrer">
                  {{ copy.faq.fluentRead }}
                </a>
                {{ copy.faq.relationAfter }}
              </p>
            </details>
          </div>
        </div>
      </section>

      <section class="final-cta">
        <div class="section-shell final-cta-inner">
          <img
            :src="appIconLarge"
            alt=""
            width="72"
            height="72"
            loading="lazy"
            decoding="async"
          />
          <p class="section-number">{{ copy.cta.label }}</p>
          <h2 class="final-cta-title">
            <span class="final-cta-opening">{{ copy.cta.opening }}</span>
            <span class="final-cta-scenes">{{ copy.cta.scenes }}</span>
            <span class="final-cta-promise">{{ copy.cta.promise }}</span>
          </h2>
          <div class="hero-actions centered-actions">
            <a
              class="button button-light button-large"
              :href="chromeWebStoreUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ copy.cta.install }}
            </a>
            <a
              class="button button-ghost-light button-large"
              :href="releasesUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ copy.cta.releases }}
            </a>
            <a
              class="button button-ghost-light button-large"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ copy.cta.source }}
            </a>
          </div>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="section-shell footer-layout">
        <div class="footer-brand">
          <img
            :src="appIconSmall"
            alt=""
            width="36"
            height="36"
            loading="lazy"
            decoding="async"
          />
          <span>
            <strong>{{ copy.brand.name }}</strong>
            <small>{{ copy.brand.subtitle }}</small>
          </span>
        </div>
        <nav :aria-label="copy.footer.aria">
          <a :href="chromeWebStoreUrl" target="_blank" rel="noreferrer">Chrome Web Store</a>
          <a :href="githubUrl" target="_blank" rel="noreferrer">GitHub</a>
          <a :href="releasesUrl" target="_blank" rel="noreferrer">{{ copy.footer.releases }}</a>
          <a :href="issuesUrl" target="_blank" rel="noreferrer">{{ copy.footer.issues }}</a>
          <a :href="localizedPath('help')">{{ copy.footer.help }}</a>
          <a :href="localizedPath('privacy')">{{ copy.footer.privacy }}</a>
        </nav>
        <p>{{ copy.footer.license }}</p>
      </div>
    </footer>
  </div>
</template>
