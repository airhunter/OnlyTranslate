<template>
  <div class="help-group">
    <section class="help-hero">
      <div>
        <p class="help-kicker">{{ t('help.kicker') }}</p>
        <h2>{{ t('help.title') }}</h2>
        <p>{{ t('help.subtitle') }}</p>
      </div>

      <label class="help-search">
        <span class="sr-only">{{ t('help.searchLabel') }}</span>
        <input
          v-model="query"
          type="search"
          :placeholder="t('help.searchPlaceholder')"
          data-testid="help-search"
        />
      </label>
    </section>

    <div v-if="filteredTopics.length" class="help-documentation">
      <nav class="help-toc" :aria-label="t('help.kicker')">
        <span class="help-toc-title">{{ t('help.kicker') }}</span>
        <a
          v-for="topic in filteredTopics"
          :key="topic.id"
          class="help-toc-link"
          :href="`#help-topic-${topic.id}`"
        >
          {{ t(topic.titleKey) }}
        </a>
      </nav>

      <main class="help-articles">
        <article
          v-for="topic in filteredTopics"
          :id="`help-topic-${topic.id}`"
          :key="topic.id"
          class="help-topic"
        >
          <header class="help-topic-header">
            <h2>{{ t(topic.titleKey) }}</h2>
            <p>{{ t(topic.summaryKey) }}</p>
          </header>

          <div class="help-topic-content">
            <section
              v-for="(section, sectionIndex) in topic.sections"
              :id="`help-section-${section.id}`"
              :key="section.id"
              class="help-section"
            >
              <div class="help-section-heading">
                <span class="help-section-index" aria-hidden="true">
                  {{ String(sectionIndex + 1).padStart(2, '0') }}
                </span>
                <h3>{{ t(section.titleKey) }}</h3>
              </div>
              <p>{{ t(section.bodyKey) }}</p>
              <figure v-if="section.image" class="help-figure">
                <img
                  :src="section.image"
                  :alt="section.imageAltKey ? t(section.imageAltKey) : ''"
                  loading="lazy"
                />
              </figure>
              <ol v-if="section.stepKeys?.length" class="help-steps">
                <li v-for="stepKey in section.stepKeys" :key="stepKey">
                  <span>{{ t(stepKey) }}</span>
                </li>
              </ol>
            </section>
          </div>
        </article>
      </main>
    </div>

    <div v-else class="help-empty" data-testid="help-empty">
      <strong>{{ t('help.emptyTitle') }}</strong>
      <p>{{ t('help.emptyBody') }}</p>
    </div>

    <div class="help-actions">
      <button type="button" class="help-action" @click="openFeedback">
        {{ t('help.actions.feedback') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'
import { buildFeedbackIssueUrl, helpTopics } from '@/entrypoints/utils/help'

const { t, locale } = useI18n()
const query = ref('')

const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase(locale.value))

const filteredTopics = computed(() => {
  if (!normalizedQuery.value) return helpTopics

  return helpTopics.filter((topic) => {
    const values = [
      topic.titleKey,
      topic.summaryKey,
      topic.keywordsKey,
      ...topic.sections.flatMap(section => [
        section.titleKey,
        section.bodyKey,
        ...(section.stepKeys ?? []),
      ]),
    ]

    return values
      .map(key => t(key))
      .join(' ')
      .toLocaleLowerCase(locale.value)
      .includes(normalizedQuery.value)
  })
})

const openFeedback = () => {
  const url = buildFeedbackIssueUrl({
    version: browser.runtime.getManifest().version,
    locale: locale.value,
    userAgent: navigator.userAgent,
  })
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.help-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0 24px;
}

.help-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 340px);
  gap: 28px;
  align-items: end;
  padding: 26px 28px;
  border: 1px solid var(--fr-border-color-light);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.help-kicker {
  margin: 0 0 6px;
  color: var(--fr-accent-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.help-hero h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  line-height: 1.3;
}

.help-hero p:not(.help-kicker) {
  max-width: 660px;
  margin: 9px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.75;
}

.help-search input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--fr-border-color);
  border-radius: 9px;
  background: var(--fr-bg-color);
  color: var(--fr-text-color-primary);
  font: inherit;
  padding: 11px 13px;
  outline: none;
}

.help-search input:focus {
  border-color: var(--fr-accent-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fr-accent-color) 15%, transparent);
}

.help-documentation {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.help-toc {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-left: 1px solid var(--fr-border-color-lighter);
  padding: 4px 0 4px 14px;
}

.help-toc-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.help-toc-link {
  border-radius: 7px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.45;
  padding: 8px 10px;
  text-decoration: none;
}

.help-toc-link:hover,
.help-toc-link:focus-visible {
  background: var(--el-fill-color-light);
  color: var(--fr-accent-color);
  outline: none;
}

.help-articles {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 18px;
}

.help-topic {
  scroll-margin-top: 16px;
  overflow: hidden;
  border: 1px solid var(--fr-border-color-light);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.help-topic-header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--fr-border-color-lighter);
}

.help-topic-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 19px;
  line-height: 1.4;
}

.help-topic-header p {
  margin: 7px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.help-topic-content {
  padding: 4px 24px 8px;
}

.help-section {
  padding: 20px 0 22px;
}

.help-section + .help-section {
  border-top: 1px solid var(--fr-border-color-lighter);
}

.help-section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.help-section-index {
  color: var(--fr-accent-color);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.help-section h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  line-height: 1.5;
}

.help-section > p {
  margin: 9px 0 0 26px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.85;
}

.help-figure {
  margin: 18px 0 0 26px;
}

.help-figure img {
  display: block;
  width: auto;
  max-width: min(100%, 680px);
  max-height: 420px;
  border: 1px solid var(--fr-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-extra-light);
  object-fit: contain;
}

.help-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 0 26px;
  padding: 0;
  list-style: none;
  counter-reset: help-step;
}

.help-steps li {
  counter-increment: help-step;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.75;
}

.help-steps li::before {
  content: counter(help-step);
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--fr-accent-color) 12%, transparent);
  color: var(--fr-accent-color);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.help-actions {
  display: flex;
  justify-content: flex-end;
}

.help-action {
  border: 1px solid var(--fr-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--fr-text-color-primary);
  cursor: pointer;
  font-size: 13px;
  padding: 9px 14px;
}

.help-action:hover {
  border-color: var(--fr-accent-color);
  color: var(--fr-accent-color);
}

.help-empty {
  border: 1px dashed var(--fr-border-color);
  border-radius: 12px;
  padding: 42px 24px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.help-empty strong {
  color: var(--el-text-color-primary);
}

.help-empty p {
  margin: 8px 0 0;
  font-size: 13px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .help-documentation {
    grid-template-columns: 1fr;
  }

  .help-toc {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid var(--fr-border-color-lighter);
    border-radius: 10px;
    padding: 10px;
  }

  .help-toc-title {
    grid-column: 1 / -1;
    padding: 0 8px;
  }
}

@media (max-width: 680px) {
  .help-hero {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 22px;
  }

  .help-toc {
    grid-template-columns: 1fr;
  }

  .help-topic-header,
  .help-topic-content {
    padding-left: 18px;
    padding-right: 18px;
  }

  .help-section > p,
  .help-figure,
  .help-steps {
    margin-left: 0;
  }
}
</style>
