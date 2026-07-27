<script setup lang="ts">
import { nextTick, ref } from 'vue';
import appIcon from '../../../public/icon/128.png';
import webScreenshot from '../../../store-assets/chrome-web-store/zh-CN/01-web-translation.png';
import demoPoster from '../../../store-assets/demos/web-bilingual-reading/poster-horizontal.png';
import demoVideo from '../../../store-assets/demos/web-bilingual-reading/onlytranslate-web-bilingual-horizontal-voiceover.mp4';
import subtitleDemoPoster from '../../../store-assets/demos/video-bilingual-subtitles/poster-horizontal.jpg';
import subtitleDemoVideo from '../../../store-assets/demos/video-bilingual-subtitles/onlytranslate-video-subtitles-horizontal-voiceover.mp4';
import epubDemoPoster from '../../../store-assets/demos/epub-bilingual-reading/poster-horizontal.jpg';
import epubDemoVideo from '../../../store-assets/demos/epub-bilingual-reading/onlytranslate-epub-bilingual-horizontal-voiceover.mp4';

const chromeWebStoreUrl =
  'https://chromewebstore.google.com/detail/%E5%8F%AA%E8%AF%91/hiajidipndfdngigicngbkhbjolggifi';
const githubUrl = 'https://github.com/airhunter/OnlyTranslate';
const issuesUrl = 'https://github.com/airhunter/OnlyTranslate/issues';
const releasesUrl = 'https://github.com/airhunter/OnlyTranslate/releases';

type DemoId = 'web' | 'video' | 'epub';

const demoIds: DemoId[] = ['web', 'video', 'epub'];
const activeDemo = ref<DemoId>('web');
const webDemo = ref<HTMLVideoElement>();
const subtitleDemo = ref<HTMLVideoElement>();
const epubDemo = ref<HTMLVideoElement>();

function selectDemo(demo: DemoId) {
  if (demo === activeDemo.value) {
    return;
  }

  webDemo.value?.pause();
  subtitleDemo.value?.pause();
  epubDemo.value?.pause();
  activeDemo.value = demo;
}

async function selectAdjacentDemo(direction: -1 | 1) {
  const currentIndex = demoIds.indexOf(activeDemo.value);
  const nextIndex =
    (currentIndex + direction + demoIds.length) % demoIds.length;
  const nextDemo = demoIds[nextIndex];

  selectDemo(nextDemo);
  await nextTick();
  document.getElementById(`demo-tab-${nextDemo}`)?.focus();
}

const services = [
  '微软翻译',
  'Google 翻译',
  'Chrome 内置翻译',
  'DeepL',
  'OpenAI',
  'DeepSeek',
  'Gemini',
  'Claude',
];
</script>

<template>
  <div class="landing-page">
    <header class="landing-header">
      <a class="brand" href="/" aria-label="只译 OnlyTranslate 首页">
        <img :src="appIcon" alt="" width="42" height="42" />
        <span>
          <strong>只译</strong>
          <small>OnlyTranslate</small>
        </span>
      </a>

      <nav class="landing-nav" aria-label="页面导航">
        <a href="#demo">真实演示</a>
        <a href="#services">翻译服务</a>
        <a href="#privacy">隐私与开源</a>
        <a href="#faq">常见问题</a>
      </nav>
    </header>

    <main>
      <section class="hero section-shell">
        <div class="hero-copy">
          <p class="eyebrow"><span></span> 免费开源的 Chrome 翻译扩展</p>
          <h1 class="hero-title">
            <span class="hero-title-line">网页、视频、电子书，</span>
            <span class="hero-title-line hero-title-accent">都能双语读。</span>
          </h1>
          <p class="hero-lead">
            给认真读外语内容的人。只译把译文放回正在阅读的内容里，尽量保留原来的结构和节奏；无需注册只译账号，也不绑定订阅。
          </p>
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
              从 Chrome Web Store 安装
            </a>
            <a
              class="button button-secondary button-large"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看 GitHub 源码
            </a>
          </div>
          <a
            class="issue-link"
            :href="issuesUrl"
            target="_blank"
            rel="noreferrer"
          >
            遇到问题或有建议？前往 GitHub Issues
            <span aria-hidden="true">↗</span>
          </a>
          <ul class="trust-list" aria-label="产品特点">
            <li>无需注册</li>
            <li>自选翻译服务</li>
            <li>本地保存设置</li>
          </ul>
        </div>

        <div class="hero-visual" aria-label="只译网页识文翻译效果">
          <div class="hero-glow"></div>
          <div class="browser-frame">
            <div class="browser-bar">
              <span></span><span></span><span></span>
              <div>外语文章正在双语阅读</div>
            </div>
            <img
              :src="webScreenshot"
              alt="只译在真实网页中保留正文原文并插入中文译文"
              width="1280"
              height="800"
            />
          </div>
          <div class="floating-note note-smart">
            <strong>识文</strong>
            <span>优先处理正文</span>
          </div>
          <div class="floating-note note-bilingual">
            <strong>双语</strong>
            <span>原文随时可核对</span>
          </div>
        </div>
      </section>

      <section class="proof-strip" aria-label="产品原则">
        <div class="section-shell proof-panel">
          <div class="proof-item">
            <span class="proof-mark">01</span>
            <div><strong>免费使用</strong><span>扩展本身不含订阅</span></div>
          </div>
          <div class="proof-item">
            <span class="proof-mark">02</span>
            <div><strong>开放源码</strong><span>遵循 GPL v3 协议</span></div>
          </div>
          <div class="proof-item">
            <span class="proof-mark">03</span>
            <div><strong>无需账号</strong><span>不建立只译账户体系</span></div>
          </div>
          <div class="proof-item">
            <span class="proof-mark">04</span>
            <div><strong>服务自选</strong><span>按需要选择翻译服务</span></div>
          </div>
        </div>
      </section>

      <section id="demo" class="demo-section section-shell page-section">
        <div class="section-intro centered">
          <p class="section-number">01 · 真实演示</p>
          <h2>切换场景，看清每一次双语阅读</h2>
          <p>
            真实操作展示只译如何在网页、视频和本地电子书中呈现双语内容。
          </p>
        </div>

        <div
          class="demo-tabs"
          role="tablist"
          aria-label="选择真实演示场景"
        >
          <button
            id="demo-tab-web"
            class="demo-tab"
            :class="{ 'is-active': activeDemo === 'web' }"
            type="button"
            role="tab"
            :aria-selected="activeDemo === 'web'"
            aria-controls="demo-panel-web"
            :tabindex="activeDemo === 'web' ? 0 : -1"
            @click="selectDemo('web')"
            @keydown.left.prevent="selectAdjacentDemo(-1)"
            @keydown.right.prevent="selectAdjacentDemo(1)"
          >
            <span>01</span>
            <strong>网页识文</strong>
          </button>
          <button
            id="demo-tab-video"
            class="demo-tab"
            :class="{ 'is-active': activeDemo === 'video' }"
            type="button"
            role="tab"
            :aria-selected="activeDemo === 'video'"
            aria-controls="demo-panel-video"
            :tabindex="activeDemo === 'video' ? 0 : -1"
            @click="selectDemo('video')"
            @keydown.left.prevent="selectAdjacentDemo(-1)"
            @keydown.right.prevent="selectAdjacentDemo(1)"
          >
            <span>02</span>
            <strong>视频字幕</strong>
          </button>
          <button
            id="demo-tab-epub"
            class="demo-tab"
            :class="{ 'is-active': activeDemo === 'epub' }"
            type="button"
            role="tab"
            :aria-selected="activeDemo === 'epub'"
            aria-controls="demo-panel-epub"
            :tabindex="activeDemo === 'epub' ? 0 : -1"
            @click="selectDemo('epub')"
            @keydown.left.prevent="selectAdjacentDemo(-1)"
            @keydown.right.prevent="selectAdjacentDemo(1)"
          >
            <span>03</span>
            <strong>本地 EPUB</strong>
          </button>
        </div>

        <div class="demo-stage">
          <article
            v-show="activeDemo === 'web'"
            id="demo-panel-web"
            class="demo-panel"
            role="tabpanel"
            aria-labelledby="demo-tab-web"
          >
            <div class="demo-stage-media">
              <video
                ref="webDemo"
                controls
                playsinline
                preload="metadata"
                :poster="demoPoster"
                aria-label="只译网页识文翻译演示视频"
              >
                <source :src="demoVideo" type="video/mp4" />
                你的浏览器暂不支持视频播放。
              </video>
            </div>
            <div class="demo-stage-copy">
              <div>
                <p>01 · 网页识文</p>
                <h3>留在原网页，只翻正在读的正文</h3>
              </div>
            </div>
          </article>

          <article
            v-show="activeDemo === 'video'"
            id="demo-panel-video"
            class="demo-panel"
            role="tabpanel"
            aria-labelledby="demo-tab-video"
          >
            <div class="demo-stage-media">
              <video
                ref="subtitleDemo"
                controls
                playsinline
                preload="metadata"
                :poster="subtitleDemoPoster"
                aria-label="只译视频双语字幕真实演示"
              >
                <source :src="subtitleDemoVideo" type="video/mp4" />
                你的浏览器暂不支持视频播放。
              </video>
            </div>
            <div class="demo-stage-copy">
              <div>
                <p>02 · 视频字幕</p>
                <h3>外语字幕，跟着播放进度双语显示</h3>
              </div>
            </div>
          </article>

          <article
            v-show="activeDemo === 'epub'"
            id="demo-panel-epub"
            class="demo-panel"
            role="tabpanel"
            aria-labelledby="demo-tab-epub"
          >
            <div class="demo-stage-media">
              <video
                ref="epubDemo"
                controls
                playsinline
                preload="metadata"
                :poster="epubDemoPoster"
                aria-label="只译本地 EPUB 双语阅读真实演示"
              >
                <source :src="epubDemoVideo" type="video/mp4" />
                你的浏览器暂不支持视频播放。
              </video>
            </div>
            <div class="demo-stage-copy">
              <div>
                <p>03 · 本地 EPUB</p>
                <h3>导入电子书，沿着章节继续双语读</h3>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="services" class="services-section page-section">
        <div class="section-shell services-layout">
          <div class="services-copy">
            <p class="section-number">02 · 翻译服务</p>
            <h2>不把你锁进一种服务</h2>
            <p>
              微软翻译、Google 翻译等免配置服务可以直接使用；如果需要 AI 翻译，也可以填写自己的 API Key。兼容 OpenAI Chat Completions 的接口同样可以接入。
            </p>
            <p class="fine-print">
              只译本身免费；第三方在线服务可能有自己的账号、额度、计费和隐私规则。
            </p>
          </div>
          <div class="service-cloud" aria-label="支持的翻译服务">
            <span v-for="service in services" :key="service">{{ service }}</span>
          </div>
        </div>
      </section>

      <section id="privacy" class="privacy-section page-section">
        <div class="section-shell">
          <div class="section-intro centered light">
            <p class="section-number">03 · 隐私与开源</p>
            <h2>数据去哪里，应该说清楚</h2>
            <p>
              开源不等于数据不会离开设备。只译把本地保存与在线翻译的边界明确写出来。
            </p>
          </div>

          <div class="privacy-grid">
            <article>
              <span>01</span>
              <h3>只译不要求注册</h3>
              <p>没有只译账号，也没有项目方订阅。项目方不收集扩展使用数据。</p>
            </article>
            <article>
              <span>02</span>
              <h3>阅读数据保存在本地</h3>
              <p>设置、缓存、EPUB 书架、阅读进度和书签保存在当前浏览器中。</p>
            </article>
            <article>
              <span>03</span>
              <h3>在线翻译会发送文本</h3>
              <p>开始翻译后，相关文本会发送给你选择的服务商，并受其隐私政策约束。</p>
            </article>
            <article>
              <span>04</span>
              <h3>源码可以公开检查</h3>
              <p>项目遵循 GPL v3 开源，功能实现、问题记录和版本历史均公开可见。</p>
            </article>
          </div>

          <div class="privacy-actions">
            <a class="text-link light-link" href="/privacy">阅读完整隐私说明 →</a>
            <a
              class="text-link light-link"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看项目源码 →
            </a>
          </div>
        </div>
      </section>

      <section class="steps-section page-section">
        <div class="section-shell">
          <div class="section-intro">
            <p class="section-number">04 · 开始使用</p>
            <h2>三步开始双语阅读</h2>
          </div>
          <ol class="step-list">
            <li>
              <span>1</span>
              <div>
                <h3>安装只译</h3>
                <p>从 Chrome Web Store 安装扩展，并固定到浏览器工具栏。</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>选择翻译服务</h3>
                <p>免配置服务可以直接使用；AI 服务需要填写对应的 API Key。</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>打开正在读的内容</h3>
                <p>选择双语对照与识文，开始翻译网页；或进入字幕和 EPUB 场景。</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="limits-section">
        <div class="section-shell limits-layout">
          <div>
            <p class="section-number">当前边界</p>
            <h2>有些事情，只译现在还做不到</h2>
          </div>
          <ul>
            <li>当前主要支持 Chrome；浏览器内部页和扩展商店等受限页面无法运行。</li>
            <li>字幕翻译依赖网站已有的可读取字幕，不负责从音频生成字幕。</li>
            <li>EPUB 阅读器仍处于 Beta，仅支持本地无 DRM 的 EPUB。</li>
            <li>复杂动态网页仍可能出现漏翻或排版问题，可以切换全页模式重试。</li>
          </ul>
        </div>
      </section>

      <section id="faq" class="faq-section page-section">
        <div class="section-shell faq-layout">
          <div class="section-intro">
            <p class="section-number">05 · 常见问题</p>
            <h2>安装前，你可能还想知道</h2>
            <p>
              没找到答案？可以前往
              <a :href="issuesUrl" target="_blank" rel="noreferrer">GitHub Issues</a>
              反馈具体页面和问题。
            </p>
          </div>

          <div class="faq-list">
            <details open>
              <summary>只译收费吗？</summary>
              <p>
                只译本身免费、开源，也不提供项目方订阅。部分第三方翻译服务可能按自己的规则收费。
              </p>
            </details>
            <details>
              <summary>需要注册只译账号吗？</summary>
              <p>不需要。设置、缓存和电子书数据保存在当前浏览器配置中。</p>
            </details>
            <details>
              <summary>翻译内容会被上传吗？</summary>
              <p>
                使用在线翻译服务时，待翻译文本会发送给你选择的服务商。可用的 Chrome
                内置翻译则在浏览器本地处理。
              </p>
            </details>
            <details>
              <summary>为什么有些页面不能翻译？</summary>
              <p>
                浏览器内部页、扩展商店、安全受限页面和部分嵌入内容不允许普通扩展运行；复杂动态页面也可能需要切换到全页模式。
              </p>
            </details>
            <details>
              <summary>没有原字幕的视频能翻译吗？</summary>
              <p>
                目前不能。只译读取网站已有字幕进行翻译，不包含语音识别和字幕生成能力。
              </p>
            </details>
            <details>
              <summary>为什么又做一个翻译扩展？与流畅阅读是什么关系？</summary>
              <p>
                只译不是因为现有产品都不够强，而是希望保留一个更克制的选择：不建立新的账号和订阅体系，让用户自己选择翻译服务，专注处理网页、字幕和电子书里的阅读体验。项目基于开源扩展
                <a
                  href="https://github.com/Bistutu/FluentRead"
                  target="_blank"
                  rel="noreferrer"
                >FluentRead（流畅阅读）</a>
                继续开发，并按照 GPL v3 协议开源。
              </p>
            </details>
          </div>
        </div>
      </section>

      <section class="final-cta">
        <div class="section-shell final-cta-inner">
          <img :src="appIcon" alt="" width="72" height="72" />
          <p class="section-number">OnlyTranslate · 只译</p>
          <h2 class="final-cta-title">
            <span class="final-cta-opening">小而克制，</span><span class="final-cta-scenes">网页、视频、电子书，</span>
            <span class="final-cta-promise">让双语阅读更简单。</span>
          </h2>
          <div class="hero-actions centered-actions">
            <a
              class="button button-light button-large"
              :href="chromeWebStoreUrl"
              target="_blank"
              rel="noreferrer"
            >
              安装只译
            </a>
            <a
              class="button button-ghost-light button-large"
              :href="releasesUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看更新说明
            </a>
            <a
              class="button button-ghost-light button-large"
              :href="githubUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看源码
            </a>
          </div>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="section-shell footer-layout">
        <div class="footer-brand">
          <img :src="appIcon" alt="" width="36" height="36" />
          <span><strong>只译</strong><small>OnlyTranslate</small></span>
        </div>
        <nav aria-label="页脚导航">
          <a :href="chromeWebStoreUrl" target="_blank" rel="noreferrer">Chrome Web Store</a>
          <a :href="githubUrl" target="_blank" rel="noreferrer">GitHub</a>
          <a :href="releasesUrl" target="_blank" rel="noreferrer">更新说明</a>
          <a :href="issuesUrl" target="_blank" rel="noreferrer">问题反馈</a>
          <a href="/help">使用帮助</a>
          <a href="/privacy">隐私说明</a>
        </nav>
        <p>GPL v3 · 免费开源</p>
      </div>
    </footer>
  </div>
</template>
