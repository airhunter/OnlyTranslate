import { describe, expect, it } from 'vitest'
import { applyContextAwarePromptMigration } from '@/entrypoints/utils/promptMigration'
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  CONTEXT_PROMPT_V1_SYSTEM_PROMPT,
  CONTEXT_PROMPT_V1_USER_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  LEGACY_DEFAULT_USER_PROMPT,
} from '@/entrypoints/utils/translationPrompt'

describe('context-aware prompt migration', () => {
  it('upgrades a complete legacy default pair', () => {
    const config = {
      system_role: { openai: LEGACY_DEFAULT_SYSTEM_PROMPT },
      user_role: { openai: LEGACY_DEFAULT_USER_PROMPT },
    }

    expect(applyContextAwarePromptMigration(config)).toEqual({
      status: 'migrated',
      services: ['openai'],
    })
    expect(config.system_role.openai).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(config.user_role.openai).toBe(DEFAULT_USER_PROMPT)
    expect(applyContextAwarePromptMigration(config).status).toBe('unchanged')
  })

  it('preserves the whole pair when either prompt was customized', () => {
    const customSystem = {
      system_role: { openai: 'My system prompt' },
      user_role: { openai: LEGACY_DEFAULT_USER_PROMPT },
    }
    const customUser = {
      system_role: { claude: LEGACY_DEFAULT_SYSTEM_PROMPT },
      user_role: { claude: 'Translate {{origin}} to {{to}} in my style' },
    }

    expect(applyContextAwarePromptMigration(customSystem).status).toBe('unchanged')
    expect(applyContextAwarePromptMigration(customUser).status).toBe('unchanged')
    expect(customSystem.user_role.openai).toBe(LEGACY_DEFAULT_USER_PROMPT)
    expect(customUser.system_role.claude).toBe(LEGACY_DEFAULT_SYSTEM_PROMPT)
  })

  it('treats an explicitly cleared prompt as a customization', () => {
    const clearedSystem = {
      system_role: { openai: '' },
      user_role: { openai: LEGACY_DEFAULT_USER_PROMPT },
    }
    const clearedUser = {
      system_role: { claude: LEGACY_DEFAULT_SYSTEM_PROMPT },
      user_role: { claude: '' },
    }

    expect(applyContextAwarePromptMigration(clearedSystem).status).toBe('unchanged')
    expect(applyContextAwarePromptMigration(clearedUser).status).toBe('unchanged')
    expect(clearedSystem.system_role.openai).toBe('')
    expect(clearedUser.user_role.claude).toBe('')
  })

  it('fills a missing half only when the stored half is still the legacy default', () => {
    const config = {
      system_role: { deepseek: LEGACY_DEFAULT_SYSTEM_PROMPT },
      user_role: {} as Record<string, string>,
    }

    expect(applyContextAwarePromptMigration(config).status).toBe('migrated')
    expect(config.system_role.deepseek).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(config.user_role.deepseek).toBe(DEFAULT_USER_PROMPT)
  })

  it('upgrades the first context-aware default used by development builds', () => {
    const config = {
      system_role: { openai: CONTEXT_PROMPT_V1_SYSTEM_PROMPT },
      user_role: { openai: CONTEXT_PROMPT_V1_USER_PROMPT },
    }

    expect(applyContextAwarePromptMigration(config).status).toBe('migrated')
    expect(config.system_role.openai).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(config.user_role.openai).toBe(DEFAULT_USER_PROMPT)
  })
})
