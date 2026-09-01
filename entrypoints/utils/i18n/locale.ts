export const supportedLocales = ['zh-CN', 'en-US', 'zh-TW', 'ja-JP'] as const

export type SupportedLocale = typeof supportedLocales[number]
export type UiLocalePreference = 'auto' | SupportedLocale

export const fallbackLocale: SupportedLocale = 'zh-CN'

let activeLocale: SupportedLocale = resolveLocale('auto')

export function getActiveLocale(): SupportedLocale {
  return activeLocale
}

export function setLocale(preference: UiLocalePreference | string | undefined): SupportedLocale {
  activeLocale = resolveLocale(preference)
  return activeLocale
}

export function resolveLocale(preference: UiLocalePreference | string | undefined): SupportedLocale {
  if (isSupportedLocale(preference)) return preference
  if (preference && preference !== 'auto') return normalizeLocale(preference) ?? fallbackLocale
  return normalizeLocale(getBrowserLanguage()) ?? fallbackLocale
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && supportedLocales.includes(value as SupportedLocale)
}

function getBrowserLanguage(): string {
  try {
    const extensionLanguage = browser?.i18n?.getUILanguage?.()
    if (extensionLanguage) return extensionLanguage
  } catch (_) {}

  return navigator.language || 'zh-CN'
}

function normalizeLocale(language: string): SupportedLocale | null {
  const normalized = language.replace('_', '-').toLowerCase()
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-hant')) return 'zh-TW'
  if (normalized.startsWith('zh')) return 'zh-CN'
  if (normalized.startsWith('ja')) return 'ja-JP'
  if (normalized.startsWith('en')) return 'en-US'
  return null
}
