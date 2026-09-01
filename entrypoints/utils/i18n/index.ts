import { createI18n, type I18n } from 'vue-i18n';
import { messages } from './messages';
import {
  fallbackLocale,
  getActiveLocale,
  resolveLocale,
  setLocale,
  type SupportedLocale,
  type UiLocalePreference,
} from './locale';

export {
  resolveLocale,
  setLocale,
  supportedLocales,
  type SupportedLocale,
  type UiLocalePreference,
} from './locale';

export function createAppI18n(preference: UiLocalePreference = 'auto') {
  const activeLocale = setLocale(preference);

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

export function t(key: string, params: Record<string, string | number> = {}): string {
  const message = getMessage(getActiveLocale(), key) ?? getMessage(fallbackLocale, key) ?? key;
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
