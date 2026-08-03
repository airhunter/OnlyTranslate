const PRODUCTION_UNINSTALL_FEEDBACK_ORIGIN = 'https://onlytranslate.top'

export type UninstallFeedbackLocale = 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP'

const localePaths: Record<UninstallFeedbackLocale, string> = {
  'zh-CN': '/uninstall',
  'en-US': '/en/uninstall',
  'zh-TW': '/zh-tw/uninstall',
  'ja-JP': '/ja/uninstall',
}

export function resolveUninstallFeedbackOrigin(
  mode = import.meta.env.MODE,
  configuredOrigin = import.meta.env.MODE === 'development'
    ? import.meta.env.WXT_UNINSTALL_FEEDBACK_ORIGIN
    : undefined,
): string {
  if (mode !== 'development' || !configuredOrigin?.trim()) {
    return PRODUCTION_UNINSTALL_FEEDBACK_ORIGIN
  }

  try {
    const url = new URL(configuredOrigin.trim())
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
    ) {
      return PRODUCTION_UNINSTALL_FEEDBACK_ORIGIN
    }

    return url.origin
  }
  catch {
    return PRODUCTION_UNINSTALL_FEEDBACK_ORIGIN
  }
}

export function resolveUninstallFeedbackLocale(uiLanguage: string): UninstallFeedbackLocale {
  const normalized = uiLanguage.trim().replaceAll('_', '-').toLowerCase()

  if (
    normalized.startsWith('zh-tw')
    || normalized.startsWith('zh-hk')
    || normalized.startsWith('zh-mo')
    || normalized.includes('hant')
  ) {
    return 'zh-TW'
  }

  if (normalized.startsWith('zh')) return 'zh-CN'
  if (normalized.startsWith('ja')) return 'ja-JP'
  return 'en-US'
}

export function buildUninstallFeedbackUrl(
  version: string,
  uiLanguage: string,
  origin = resolveUninstallFeedbackOrigin(),
): string {
  const locale = resolveUninstallFeedbackLocale(uiLanguage)
  const url = new URL(localePaths[locale], origin)

  if (/^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/.test(version)) {
    url.searchParams.set('version', version)
  }

  return url.toString()
}
