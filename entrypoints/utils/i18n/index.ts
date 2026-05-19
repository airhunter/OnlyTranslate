import { createI18n, type I18n } from 'vue-i18n';
import { messages } from './messages';

export const supportedLocales = ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const;
export type SupportedLocale = typeof supportedLocales[number];
export type UiLocalePreference = 'auto' | SupportedLocale;

const fallbackLocale: SupportedLocale = 'zh-CN';
let activeLocale: SupportedLocale = resolveLocale('auto');

export function createAppI18n(preference: UiLocalePreference = 'auto') {
  activeLocale = resolveLocale(preference);

  return createI18n({
    legacy: false,
    locale: activeLocale,
    fallbackLocale,
    messages,
    missingWarn: false,
    fallbackWarn: false
  });
}

export function updateI18nLocale(i18n: I18n, preference: UiLocalePreference | string | undefined): SupportedLocale {
  const locale = setLocale(preference);
  const globalLocale = i18n.global.locale as unknown as { value?: string };
  if (globalLocale && typeof globalLocale === 'object' && 'value' in globalLocale) {
    globalLocale.value = locale;
  } else {
    i18n.global.locale = locale as never;
  }
  return locale;
}

export function setLocale(preference: UiLocalePreference | string | undefined): SupportedLocale {
  activeLocale = resolveLocale(preference);
  return activeLocale;
}

export function resolveLocale(preference: UiLocalePreference | string | undefined): SupportedLocale {
  if (isSupportedLocale(preference)) return preference;
  if (preference && preference !== 'auto') return normalizeLocale(preference) ?? fallbackLocale;
  return normalizeLocale(getBrowserLanguage()) ?? fallbackLocale;
}

export function t(key: string, params: Record<string, string | number> = {}): string {
  const message = getMessage(activeLocale, key) ?? getMessage(fallbackLocale, key) ?? key;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    message
  );
}

function getMessage(locale: SupportedLocale, key: string): string | null {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, messages[locale]);

  return typeof value === 'string' ? value : null;
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && supportedLocales.includes(value as SupportedLocale);
}

function getBrowserLanguage(): string {
  try {
    const extensionLanguage = browser?.i18n?.getUILanguage?.();
    if (extensionLanguage) return extensionLanguage;
  } catch (_) {}

  return navigator.language || 'zh-CN';
}

function normalizeLocale(language: string): SupportedLocale | null {
  const normalized = language.replace('_', '-').toLowerCase();
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-hant')) return 'zh-TW';
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ja')) return 'ja-JP';
  if (normalized.startsWith('en')) return 'en-US';
  return null;
}
