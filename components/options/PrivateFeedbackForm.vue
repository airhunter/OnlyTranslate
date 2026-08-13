<template>
  <section class="private-feedback" data-testid="private-feedback-form">
    <header class="private-feedback__header">
      <div>
        <h3>{{ t('privateFeedback.title') }}</h3>
        <p>{{ t('privateFeedback.intro') }}</p>
      </div>
      <button type="button" class="private-feedback__close" :aria-label="t('privateFeedback.close')" @click="emit('close')">×</button>
    </header>

    <label class="private-feedback__field">
      <span>{{ t('privateFeedback.category') }}</span>
      <select v-model="category" data-testid="private-feedback-category">
        <option v-for="item in categories" :key="item" :value="item">
          {{ t(`privateFeedback.categories.${item}`) }}
        </option>
      </select>
    </label>

    <label class="private-feedback__field">
      <span>{{ t('privateFeedback.message') }}</span>
      <textarea
        v-model="message"
        maxlength="4000"
        rows="6"
        :placeholder="t('privateFeedback.messagePlaceholder')"
        data-testid="private-feedback-message"
      />
    </label>

    <div class="private-feedback__option">
      <label class="private-feedback__check">
        <input v-model="includeDiagnostics" type="checkbox" data-testid="include-diagnostics" />
        <strong>{{ t('privateFeedback.diagnostics') }}</strong>
      </label>
      <p>{{ t('privateFeedback.diagnosticsHint') }}</p>
      <p class="private-feedback__retention">{{ t('privateFeedback.retention') }}</p>
      <div v-if="includeDiagnostics" class="private-feedback__diagnostics-controls">
        <label><input v-model="diagnosticRange" type="radio" value="latest" /> {{ t('privateFeedback.latest') }}</label>
        <label><input v-model="diagnosticRange" type="radio" value="last3" /> {{ t('privateFeedback.last3') }}</label>
      </div>
      <div class="private-feedback__preview">
        <strong>{{ t('privateFeedback.preview') }}</strong>
        <pre v-if="diagnosticPreview" data-testid="diagnostic-preview">{{ diagnosticPreview }}</pre>
        <p v-else>{{ includeDiagnostics ? t('privateFeedback.noDiagnostics') : t('privateFeedback.emptyPreview') }}</p>
      </div>
      <button type="button" class="private-feedback__text-button" @click="clearDiagnostics">
        {{ t('privateFeedback.clear') }}
      </button>
    </div>

    <div class="private-feedback__option">
      <label class="private-feedback__check">
        <input v-model="includePageUrl" type="checkbox" data-testid="include-page-url" />
        <strong>{{ t('privateFeedback.pageUrl') }}</strong>
        <small>{{ t('privateFeedback.optional') }}</small>
      </label>
      <p>{{ t('privateFeedback.pageUrlHint') }}</p>
      <input
        v-if="includePageUrl"
        v-model="pageUrl"
        class="private-feedback__url"
        type="url"
        :placeholder="t('privateFeedback.pageUrlPlaceholder')"
        data-testid="private-feedback-page-url"
      />
    </div>

    <div class="private-feedback__option">
      <label class="private-feedback__check">
        <input v-model="includeContact" type="checkbox" data-testid="include-contact" />
        <strong>{{ t('privateFeedback.contact') }}</strong>
        <small>{{ t('privateFeedback.optional') }}</small>
      </label>
      <p>{{ t('privateFeedback.contactHint') }}</p>
      <label v-if="includeContact" class="private-feedback__contact-field">
        <span>{{ t('privateFeedback.contactEmail') }}</span>
        <input
          v-model="contactEmail"
          class="private-feedback__email"
          type="email"
          autocomplete="email"
          maxlength="254"
          required
          :placeholder="t('privateFeedback.contactPlaceholder')"
          data-testid="private-feedback-email"
        />
      </label>
    </div>

    <p v-if="statusMessage" class="private-feedback__status" :class="{ 'private-feedback__status--success': submittedId }">
      {{ statusMessage }}
    </p>

    <footer class="private-feedback__footer">
      <button type="button" class="private-feedback__secondary" @click="emit('close')">{{ t('privateFeedback.close') }}</button>
      <button type="button" class="private-feedback__submit" :disabled="submitting" data-testid="submit-private-feedback" @click="submit">
        {{ submitting ? t('privateFeedback.submitting') : t('privateFeedback.submit') }}
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'
import {
  clearTranslationDiagnostics,
  getRecentTranslationDiagnostics,
  type TranslationDiagnosticSession,
} from '@/entrypoints/utils/translationDiagnostics'
import {
  describeBrowser,
  normalizeFeedbackEmail,
  sanitizeFeedbackPageUrl,
  selectFeedbackDiagnostics,
  submitPrivateFeedback,
  type FeedbackDiagnosticRange,
  type PrivateFeedbackPayload,
} from '@/entrypoints/utils/privateFeedback'

const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const extensionVersion = browser.runtime.getManifest().version
const categories = ['performance', 'failure', 'quality', 'compatibility', 'suggestion', 'other'] as const
const category = ref<(typeof categories)[number]>('performance')
const message = ref('')
const includeDiagnostics = ref(false)
const diagnosticRange = ref<FeedbackDiagnosticRange>('latest')
const diagnostics = ref<TranslationDiagnosticSession[]>([])
const includePageUrl = ref(false)
const pageUrl = ref('')
const includeContact = ref(false)
const contactEmail = ref('')
const submitting = ref(false)
const submittedId = ref('')
const statusMessage = ref('')

const selectedDiagnostics = computed(() => selectFeedbackDiagnostics(diagnostics.value, diagnosticRange.value))
const diagnosticBlock = computed(() => includeDiagnostics.value && selectedDiagnostics.value.length
  ? {
      formatVersion: 1 as const,
      browser: describeBrowser(navigator.userAgent),
      sessions: selectedDiagnostics.value,
    }
  : undefined)
const diagnosticPreview = computed(() => diagnosticBlock.value
  ? JSON.stringify({
      extensionVersion,
      ...diagnosticBlock.value,
    }, null, 2)
  : '')

onMounted(async () => {
  const recent = await getRecentTranslationDiagnostics()
  diagnostics.value = Array.isArray(recent) ? recent : []
  pageUrl.value = diagnostics.value[0]?.pageUrl ?? ''
})

async function clearDiagnostics() {
  await clearTranslationDiagnostics()
  diagnostics.value = []
  pageUrl.value = ''
  statusMessage.value = t('privateFeedback.cleared')
  submittedId.value = ''
}

async function submit() {
  submittedId.value = ''
  const normalizedMessage = message.value.trim()
  if (!normalizedMessage) {
    statusMessage.value = t('privateFeedback.required')
    return
  }

  const normalizedPageUrl = includePageUrl.value && pageUrl.value.trim()
    ? sanitizeFeedbackPageUrl(pageUrl.value)
    : undefined
  if (includePageUrl.value && pageUrl.value.trim() && !normalizedPageUrl) {
    statusMessage.value = t('privateFeedback.invalidUrl')
    return
  }
  const normalizedContactEmail = includeContact.value
    ? normalizeFeedbackEmail(contactEmail.value)
    : undefined
  if (includeContact.value && !normalizedContactEmail) {
    statusMessage.value = t('privateFeedback.invalidEmail')
    return
  }

  const payload: PrivateFeedbackPayload = {
    type: 'extension_feedback',
    schemaVersion: 1,
    source: 'extension',
    version: extensionVersion,
    locale: locale.value,
    category: category.value,
    message: normalizedMessage,
    ...(normalizedContactEmail
      ? { contact: { email: normalizedContactEmail, consent: true } as const }
      : {}),
    ...(normalizedPageUrl ? { pageUrl: normalizedPageUrl } : {}),
    ...(diagnosticBlock.value ? { diagnostics: diagnosticBlock.value } : {}),
  }

  submitting.value = true
  statusMessage.value = ''
  try {
    submittedId.value = await submitPrivateFeedback(payload)
    statusMessage.value = t('privateFeedback.success', { id: submittedId.value })
  }
  catch {
    statusMessage.value = t('privateFeedback.failed')
  }
  finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.private-feedback { border: 1px solid var(--fr-border-color-light); border-radius: 14px; background: var(--el-bg-color); padding: 22px; }
.private-feedback__header { display: flex; gap: 20px; justify-content: space-between; }
.private-feedback__header h3 { margin: 0; font-size: 19px; }
.private-feedback__header p, .private-feedback__option p { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.65; margin: 6px 0 0; }
.private-feedback__close { border: 0; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; font-size: 24px; height: 32px; }
.private-feedback__field { display: grid; gap: 7px; margin-top: 18px; color: var(--el-text-color-primary); font-size: 13px; font-weight: 650; }
.private-feedback__field select, .private-feedback__field textarea, .private-feedback__url, .private-feedback__email { box-sizing: border-box; width: 100%; border: 1px solid var(--fr-border-color); border-radius: 8px; background: var(--fr-bg-color); color: var(--fr-text-color-primary); font: inherit; padding: 10px 12px; }
.private-feedback__field textarea { resize: vertical; }
.private-feedback__option { margin-top: 18px; border-top: 1px solid var(--fr-border-color-lighter); padding-top: 16px; }
.private-feedback__check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.private-feedback__check small { color: var(--el-text-color-secondary); font-weight: 400; }
.private-feedback__contact-field { display: grid; gap: 7px; margin-top: 10px; font-size: 13px; font-weight: 650; }
.private-feedback__retention { font-size: 12px !important; }
.private-feedback__diagnostics-controls { display: flex; gap: 20px; margin-top: 12px; font-size: 13px; }
.private-feedback__preview { margin-top: 12px; }
.private-feedback__preview > strong { font-size: 12px; }
.private-feedback__preview pre { max-height: 280px; overflow: auto; white-space: pre-wrap; border-radius: 8px; background: var(--el-fill-color-light); color: var(--el-text-color-primary); font-size: 11px; line-height: 1.55; padding: 12px; }
.private-feedback__text-button { margin-top: 8px; border: 0; background: transparent; color: var(--fr-accent-color); cursor: pointer; padding: 0; }
.private-feedback__url { margin-top: 10px; }
.private-feedback__status { color: var(--el-color-danger); font-size: 13px; }
.private-feedback__status--success { color: var(--el-color-success); }
.private-feedback__footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.private-feedback__secondary, .private-feedback__submit { border: 1px solid var(--fr-border-color); border-radius: 8px; cursor: pointer; padding: 9px 16px; }
.private-feedback__secondary { background: var(--el-bg-color); color: var(--el-text-color-primary); }
.private-feedback__submit { border-color: var(--fr-accent-color); background: var(--fr-accent-color); color: white; }
.private-feedback__submit:disabled { cursor: wait; opacity: .65; }
</style>
