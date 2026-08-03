<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type SurveyLocale = 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP'

interface SurveyOption {
  value: string
  label: string
  hint?: string
}

interface SurveyCopy {
  eyebrow: string
  title: string
  intro: string
  skip: string
  reasonTitle: string
  reasonRequired: string
  reasons: SurveyOption[]
  obstacleTitle: string
  obstacleOptional: string
  obstacles: SurveyOption[]
  submit: string
  privacyPrefix: string
  privacyLink: string
  privacySuffix: string
  metadata: string
  versionLabel: string
}

const props = defineProps<{
  locale: SurveyLocale
  thanksPath: string
  privacyPath: string
}>()

const copyByLocale: Record<SurveyLocale, SurveyCopy> = {
  'zh-CN': {
    eyebrow: '卸载反馈',
    title: '是什么让你离开了只译？',
    intro: '一个选择就能帮助我们判断下一步最该改什么。问卷不会要求登录，也不收集自由文本。',
    skip: '不想回答也没关系，你可以直接关闭这个页面。',
    reasonTitle: '你卸载只译的主要原因是什么？',
    reasonRequired: '必选',
    reasons: [
      { value: 'no_longer_needed', label: '暂时不需要了' },
      { value: 'hard_to_start', label: '不知道如何开始使用', hint: '例如不知道从哪里配置或启动翻译' },
      { value: 'translation_quality', label: '翻译质量不理想' },
      { value: 'translation_speed', label: '翻译速度太慢' },
      { value: 'page_compatibility', label: '网页排版或兼容性有问题' },
      { value: 'found_alternative', label: '找到了更合适的替代品' },
      { value: 'privacy_concerns', label: '对权限或隐私有顾虑' },
      { value: 'other', label: '其他原因' },
    ],
    obstacleTitle: '首次使用时，你遇到过什么障碍？',
    obstacleOptional: '可选',
    obstacles: [
      { value: '', label: '请选择（可跳过）' },
      { value: 'none', label: '没有明显障碍' },
      { value: 'did_not_know_start', label: '不知道从哪里开始翻译' },
      { value: 'service_setup', label: '不知道如何选择或配置翻译服务' },
      { value: 'translation_failed', label: '第一次翻译没有成功' },
      { value: 'unsupported_page', label: '想翻译的页面无法使用' },
      { value: 'controls_confusing', label: '功能入口或选项不好理解' },
    ],
    submit: '提交匿名反馈',
    privacyPrefix: '提交后只记录所选分类、扩展版本和界面语言。详情见',
    privacyLink: '隐私说明',
    privacySuffix: '。',
    metadata: '不记录 IP、请求头、网页地址、翻译内容或用户标识。',
    versionLabel: '扩展版本',
  },
  'en-US': {
    eyebrow: 'Uninstall feedback',
    title: 'What made you leave OnlyTranslate?',
    intro: 'One selection helps us understand what to improve next. No sign-in or free-text response is required.',
    skip: 'If you would rather not answer, you can simply close this page.',
    reasonTitle: 'What is the main reason you uninstalled OnlyTranslate?',
    reasonRequired: 'Required',
    reasons: [
      { value: 'no_longer_needed', label: 'I no longer need it' },
      { value: 'hard_to_start', label: 'I did not know how to get started', hint: 'For example, where to configure or start translation' },
      { value: 'translation_quality', label: 'Translation quality was not good enough' },
      { value: 'translation_speed', label: 'Translation was too slow' },
      { value: 'page_compatibility', label: 'It caused page layout or compatibility problems' },
      { value: 'found_alternative', label: 'I found a better alternative' },
      { value: 'privacy_concerns', label: 'I had permission or privacy concerns' },
      { value: 'other', label: 'Another reason' },
    ],
    obstacleTitle: 'Did anything block you when you first tried it?',
    obstacleOptional: 'Optional',
    obstacles: [
      { value: '', label: 'Select an answer (optional)' },
      { value: 'none', label: 'No obvious obstacle' },
      { value: 'did_not_know_start', label: 'I did not know where to start a translation' },
      { value: 'service_setup', label: 'I did not know how to choose or configure a translation service' },
      { value: 'translation_failed', label: 'My first translation did not work' },
      { value: 'unsupported_page', label: 'It did not work on the page I wanted to translate' },
      { value: 'controls_confusing', label: 'The controls or options were hard to understand' },
    ],
    submit: 'Submit anonymous feedback',
    privacyPrefix: 'The submission records only your selections, extension version, and interface language. See the',
    privacyLink: 'privacy notice',
    privacySuffix: '.',
    metadata: 'It does not store your IP address, request headers, page URLs, translation content, or a user identifier.',
    versionLabel: 'Extension version',
  },
  'zh-TW': {
    eyebrow: '解除安裝回饋',
    title: '是什麼原因讓你離開只譯？',
    intro: '一個選項就能幫助我們判斷下一步最該改善什麼。問卷不要求登入，也不收集自由文字。',
    skip: '如果不想回答，可以直接關閉此頁面。',
    reasonTitle: '你解除安裝只譯的主要原因是什麼？',
    reasonRequired: '必選',
    reasons: [
      { value: 'no_longer_needed', label: '暫時不需要了' },
      { value: 'hard_to_start', label: '不知道如何開始使用', hint: '例如不知道從哪裡設定或啟動翻譯' },
      { value: 'translation_quality', label: '翻譯品質不理想' },
      { value: 'translation_speed', label: '翻譯速度太慢' },
      { value: 'page_compatibility', label: '網頁排版或相容性有問題' },
      { value: 'found_alternative', label: '找到了更合適的替代方案' },
      { value: 'privacy_concerns', label: '對權限或隱私有疑慮' },
      { value: 'other', label: '其他原因' },
    ],
    obstacleTitle: '首次使用時，你遇到過什麼障礙？',
    obstacleOptional: '選填',
    obstacles: [
      { value: '', label: '請選擇（可略過）' },
      { value: 'none', label: '沒有明顯障礙' },
      { value: 'did_not_know_start', label: '不知道從哪裡開始翻譯' },
      { value: 'service_setup', label: '不知道如何選擇或設定翻譯服務' },
      { value: 'translation_failed', label: '第一次翻譯沒有成功' },
      { value: 'unsupported_page', label: '想翻譯的頁面無法使用' },
      { value: 'controls_confusing', label: '功能入口或選項不容易理解' },
    ],
    submit: '提交匿名回饋',
    privacyPrefix: '提交後只記錄所選分類、擴充功能版本和介面語言。詳情請見',
    privacyLink: '隱私說明',
    privacySuffix: '。',
    metadata: '不記錄 IP、請求標頭、網頁網址、翻譯內容或使用者識別碼。',
    versionLabel: '擴充功能版本',
  },
  'ja-JP': {
    eyebrow: 'アンインストール時のフィードバック',
    title: 'OnlyTranslate を離れた理由を教えてください',
    intro: '1 つ選ぶだけで、次に何を改善すべきか判断する助けになります。ログインも自由記述も必要ありません。',
    skip: '回答しない場合は、このページをそのまま閉じてください。',
    reasonTitle: 'OnlyTranslate をアンインストールした主な理由は何ですか？',
    reasonRequired: '必須',
    reasons: [
      { value: 'no_longer_needed', label: '今は必要なくなった' },
      { value: 'hard_to_start', label: '使い始め方が分からなかった', hint: '翻訳の設定場所や開始方法が分からないなど' },
      { value: 'translation_quality', label: '翻訳品質が十分ではなかった' },
      { value: 'translation_speed', label: '翻訳が遅すぎた' },
      { value: 'page_compatibility', label: 'ページの表示や互換性に問題があった' },
      { value: 'found_alternative', label: 'より適した代替手段を見つけた' },
      { value: 'privacy_concerns', label: '権限やプライバシーが気になった' },
      { value: 'other', label: 'その他の理由' },
    ],
    obstacleTitle: '初めて使ったとき、何か困ったことはありましたか？',
    obstacleOptional: '任意',
    obstacles: [
      { value: '', label: '選択してください（省略可）' },
      { value: 'none', label: '特に問題はなかった' },
      { value: 'did_not_know_start', label: 'どこから翻訳を始めるか分からなかった' },
      { value: 'service_setup', label: '翻訳サービスの選択や設定方法が分からなかった' },
      { value: 'translation_failed', label: '最初の翻訳が成功しなかった' },
      { value: 'unsupported_page', label: '翻訳したいページで使えなかった' },
      { value: 'controls_confusing', label: '機能の入口や設定が分かりにくかった' },
    ],
    submit: '匿名フィードバックを送信',
    privacyPrefix: '送信時に記録されるのは、選択した項目、拡張機能のバージョン、表示言語だけです。詳しくは',
    privacyLink: 'プライバシー説明',
    privacySuffix: 'をご覧ください。',
    metadata: 'IP アドレス、リクエストヘッダー、ページ URL、翻訳内容、ユーザー識別子は保存しません。',
    versionLabel: '拡張機能のバージョン',
  },
}

const copy = computed(() => copyByLocale[props.locale])
const selectedReason = ref('')
const selectedObstacle = ref('')
const version = ref('')

onMounted(() => {
  const candidate = new URLSearchParams(window.location.search).get('version') || ''
  if (/^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/.test(candidate)) {
    version.value = candidate
  }
})

function submitSurvey() {
  if (!selectedReason.value) return

  const params = new URLSearchParams({
    reason: selectedReason.value,
    locale: props.locale,
  })
  if (selectedObstacle.value) params.set('obstacle', selectedObstacle.value)
  if (version.value) params.set('version', version.value)

  window.location.assign(`${props.thanksPath}?${params.toString()}`)
}
</script>

<template>
  <main class="uninstall-survey">
    <header class="survey-hero">
      <p class="survey-eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="survey-intro">{{ copy.intro }}</p>
      <p class="survey-skip">{{ copy.skip }}</p>
    </header>

    <form class="survey-form" @submit.prevent="submitSurvey">
      <fieldset>
        <legend>
          {{ copy.reasonTitle }}
          <span class="survey-badge survey-badge-required">{{ copy.reasonRequired }}</span>
        </legend>
        <div class="reason-grid">
          <label
            v-for="option in copy.reasons"
            :key="option.value"
            class="reason-option"
            :class="{ 'reason-option-selected': selectedReason === option.value }"
          >
            <input v-model="selectedReason" type="radio" name="reason" :value="option.value" required>
            <span class="reason-control" aria-hidden="true"></span>
            <span>
              <strong>{{ option.label }}</strong>
              <small v-if="option.hint">{{ option.hint }}</small>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset class="obstacle-fieldset">
        <legend>
          {{ copy.obstacleTitle }}
          <span class="survey-badge">{{ copy.obstacleOptional }}</span>
        </legend>
        <select v-model="selectedObstacle" class="obstacle-select">
          <option v-for="option in copy.obstacles" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </fieldset>

      <button class="survey-submit" type="submit" :disabled="!selectedReason">
        {{ copy.submit }}
      </button>

      <div class="survey-privacy">
        <p>
          {{ copy.privacyPrefix }}
          <a :href="privacyPath">{{ copy.privacyLink }}</a>{{ copy.privacySuffix }}
        </p>
        <p>{{ copy.metadata }}</p>
        <p v-if="version">{{ copy.versionLabel }}：{{ version }}</p>
      </div>
    </form>
  </main>
</template>

<style scoped>
.uninstall-survey {
  width: min(760px, calc(100% - 32px));
  margin: 0 auto;
  padding: 70px 0 96px;
  color: var(--ot-ink);
}

.survey-hero {
  text-align: center;
}

.survey-eyebrow {
  margin: 0 0 14px;
  color: var(--ot-blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.survey-hero h1 {
  margin: 0;
  font-size: clamp(34px, 6vw, 50px);
  letter-spacing: -0.04em;
  line-height: 1.12;
  text-wrap: balance;
}

.survey-intro {
  max-width: 650px;
  margin: 22px auto 0;
  color: var(--ot-muted);
  font-size: 17px;
  line-height: 1.75;
}

.survey-skip {
  margin: 12px 0 0;
  color: var(--ot-muted);
  font-size: 13px;
}

.survey-form {
  padding: 34px;
  margin-top: 42px;
  border: 1px solid var(--ot-line);
  border-radius: 24px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 24px 70px rgba(20, 61, 159, 0.1);
}

fieldset {
  padding: 0;
  margin: 0;
  border: 0;
}

legend {
  width: 100%;
  margin-bottom: 18px;
  color: var(--ot-ink);
  font-size: 17px;
  font-weight: 760;
}

.survey-badge {
  display: inline-flex;
  padding: 3px 8px;
  margin-left: 8px;
  color: var(--ot-muted);
  font-size: 11px;
  font-weight: 700;
  vertical-align: 2px;
  border-radius: 999px;
  background: var(--vp-c-bg-alt);
}

.survey-badge-required {
  color: var(--ot-blue-deep);
  background: rgba(37, 95, 223, 0.11);
}

.reason-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.reason-option {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 11px;
  align-items: start;
  min-height: 62px;
  padding: 14px 15px;
  border: 1px solid var(--ot-line);
  border-radius: 14px;
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.reason-option:hover {
  border-color: rgba(37, 95, 223, 0.42);
  transform: translateY(-1px);
}

.reason-option-selected {
  border-color: var(--ot-blue);
  box-shadow: 0 0 0 3px rgba(37, 95, 223, 0.1);
}

.reason-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.reason-control {
  position: relative;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border: 1.5px solid rgba(37, 95, 223, 0.45);
  border-radius: 50%;
}

.reason-option-selected .reason-control {
  border: 5px solid var(--ot-blue);
}

.reason-option strong {
  display: block;
  font-size: 14px;
  line-height: 1.45;
}

.reason-option small {
  display: block;
  margin-top: 4px;
  color: var(--ot-muted);
  font-size: 12px;
  line-height: 1.45;
}

.obstacle-fieldset {
  margin-top: 30px;
}

.obstacle-select {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  color: var(--ot-ink);
  font: inherit;
  border: 1px solid var(--ot-line);
  border-radius: 12px;
  outline: none;
  background: var(--vp-c-bg);
}

.obstacle-select:focus-visible {
  border-color: var(--ot-blue);
  box-shadow: 0 0 0 3px rgba(37, 95, 223, 0.1);
}

.survey-submit {
  width: 100%;
  min-height: 50px;
  margin-top: 28px;
  color: white;
  font: inherit;
  font-weight: 760;
  border: 0;
  border-radius: 13px;
  background: linear-gradient(135deg, #2d6ff0, #174bc5);
  box-shadow: 0 12px 30px rgba(37, 95, 223, 0.24);
  cursor: pointer;
}

.survey-submit:disabled {
  opacity: 0.45;
  box-shadow: none;
  cursor: not-allowed;
}

.survey-privacy {
  margin-top: 20px;
  color: var(--ot-muted);
  font-size: 12px;
  line-height: 1.65;
  text-align: center;
}

.survey-privacy p {
  margin: 2px 0;
}

.survey-privacy a {
  color: var(--ot-blue);
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 640px) {
  .uninstall-survey {
    padding: 44px 0 64px;
  }

  .survey-form {
    padding: 22px 18px;
    margin-top: 30px;
    border-radius: 18px;
  }

  .reason-grid {
    grid-template-columns: 1fr;
  }
}
</style>
