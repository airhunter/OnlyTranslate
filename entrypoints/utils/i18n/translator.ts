import { fallbackLocale, getActiveLocale, type SupportedLocale } from './locale'

export function createTranslator(messages: Record<SupportedLocale, unknown>) {
  return (key: string, params: Record<string, string | number> = {}): string => {
    const message = getMessage(messages, getActiveLocale(), key)
      ?? getMessage(messages, fallbackLocale, key)
      ?? key
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message,
    )
  }
}

function getMessage(
  messages: Record<SupportedLocale, unknown>,
  locale: SupportedLocale,
  key: string,
): string | null {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, messages[locale])

  return typeof value === 'string' ? value : null
}
