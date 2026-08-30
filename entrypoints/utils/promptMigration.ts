import type { Config } from './model'
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  LEGACY_DEFAULT_USER_PROMPT,
} from './translationPrompt'

type PromptConfig = Partial<Pick<Config, 'system_role' | 'user_role'>>

export interface PromptMigrationResult {
  status: 'unchanged' | 'migrated'
  services: string[]
}

export function applyContextAwarePromptMigration(config: PromptConfig): PromptMigrationResult {
  const systemRoles = config.system_role
  const userRoles = config.user_role
  if (!systemRoles && !userRoles) return { status: 'unchanged', services: [] }

  const serviceIds = new Set([
    ...Object.keys(systemRoles ?? {}),
    ...Object.keys(userRoles ?? {}),
  ])
  const migratedServices: string[] = []

  for (const service of serviceIds) {
    const system = systemRoles?.[service]
    const user = userRoles?.[service]
    const matchesLegacyDefault = (system === undefined || system === LEGACY_DEFAULT_SYSTEM_PROMPT)
      && (user === undefined || user === LEGACY_DEFAULT_USER_PROMPT)
    if (!matchesLegacyDefault) continue

    config.system_role ??= {}
    config.user_role ??= {}
    config.system_role[service] = DEFAULT_SYSTEM_PROMPT
    config.user_role[service] = DEFAULT_USER_PROMPT
    migratedServices.push(service)
  }

  return migratedServices.length > 0
    ? { status: 'migrated', services: migratedServices }
    : { status: 'unchanged', services: [] }
}
