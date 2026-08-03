<script setup lang="ts">
import { computed, onMounted } from 'vue'

type SurveyLocale = 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP'

const props = defineProps<{
  locale: SurveyLocale
  homePath: string
}>()

const copyByLocale = {
  'zh-CN': {
    eyebrow: '已收到',
    title: '谢谢你的反馈',
    body: '你的选择会与其他匿名反馈一起汇总，用来判断只译下一步优先改善什么。',
    detail: '如果愿意补充具体情况，可以继续通过 GitHub Issues 联系我们。',
    home: '返回只译官网',
    issue: '补充详细反馈',
  },
  'en-US': {
    eyebrow: 'Received',
    title: 'Thank you for your feedback',
    body: 'Your selections will be aggregated with other anonymous responses to help prioritize future improvements.',
    detail: 'If you would like to add more detail, you can continue through GitHub Issues.',
    home: 'Return to the OnlyTranslate website',
    issue: 'Share more detail',
  },
  'zh-TW': {
    eyebrow: '已收到',
    title: '謝謝你的回饋',
    body: '你的選項會與其他匿名回饋一起彙整，用來判斷只譯下一步優先改善什麼。',
    detail: '如果願意補充具體情況，可以繼續透過 GitHub Issues 聯絡我們。',
    home: '返回只譯官網',
    issue: '補充詳細回饋',
  },
  'ja-JP': {
    eyebrow: '受け付けました',
    title: 'フィードバックありがとうございます',
    body: '選択内容はほかの匿名回答と集計し、今後の改善優先度を判断するために利用します。',
    detail: '詳しい状況を追加したい場合は、GitHub Issues からお知らせください。',
    home: 'OnlyTranslate のサイトへ戻る',
    issue: '詳しい内容を送る',
  },
} satisfies Record<SurveyLocale, Record<string, string>>

const copy = computed(() => copyByLocale[props.locale])

onMounted(() => {
  window.history.replaceState(null, '', window.location.pathname)
})
</script>

<template>
  <main class="thanks-page">
    <div class="thanks-card">
      <div class="thanks-check" aria-hidden="true">✓</div>
      <p class="thanks-eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="thanks-body">{{ copy.body }}</p>
      <p class="thanks-detail">{{ copy.detail }}</p>
      <div class="thanks-actions">
        <a class="thanks-primary" :href="homePath">{{ copy.home }}</a>
        <a
          class="thanks-secondary"
          href="https://github.com/airhunter/OnlyTranslate/issues/new"
          target="_blank"
          rel="noreferrer"
        >{{ copy.issue }}</a>
      </div>
    </div>
  </main>
</template>

<style scoped>
.thanks-page {
  display: grid;
  place-items: center;
  width: min(720px, calc(100% - 32px));
  min-height: 66vh;
  margin: 0 auto;
  padding: 64px 0 90px;
}

.thanks-card {
  width: 100%;
  padding: 54px 38px;
  text-align: center;
  border: 1px solid var(--ot-line);
  border-radius: 26px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 26px 76px rgba(20, 61, 159, 0.11);
}

.thanks-check {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 20px;
  color: white;
  font-size: 28px;
  font-weight: 800;
  border-radius: 50%;
  background: linear-gradient(135deg, #43c59e, #1c9d79);
  box-shadow: 0 13px 30px rgba(28, 157, 121, 0.24);
}

.thanks-eyebrow {
  margin: 0 0 10px;
  color: var(--ot-blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.thanks-card h1 {
  margin: 0;
  font-size: clamp(32px, 6vw, 46px);
  letter-spacing: -0.04em;
  line-height: 1.15;
}

.thanks-body {
  max-width: 570px;
  margin: 22px auto 0;
  color: var(--ot-muted);
  font-size: 17px;
  line-height: 1.75;
}

.thanks-detail {
  margin: 12px 0 0;
  color: var(--ot-muted);
  font-size: 13px;
  line-height: 1.65;
}

.thanks-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 30px;
}

.thanks-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 750;
  border-radius: 12px;
  text-decoration: none;
}

.thanks-primary {
  color: white;
  background: linear-gradient(135deg, #2d6ff0, #174bc5);
  box-shadow: 0 12px 28px rgba(37, 95, 223, 0.23);
}

.thanks-secondary {
  color: var(--ot-blue);
  border: 1px solid rgba(37, 95, 223, 0.25);
  background: var(--vp-c-bg);
}

@media (max-width: 560px) {
  .thanks-card {
    padding: 40px 20px;
  }

  .thanks-actions {
    flex-direction: column;
  }
}
</style>
