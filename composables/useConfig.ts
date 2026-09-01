import { ref, watch, nextTick } from 'vue'
import { Config } from '@/entrypoints/utils/model'
import { storage } from '@wxt-dev/storage'
import {
  applyRetiredClaudeModelMigration,
  saveClaudeModelMigrationNotice,
} from '@/entrypoints/utils/modelMigration'
import {
  applyTranslationOnlyCompatibilityMigration,
  saveDisplayModeMigrationNotice,
} from '@/entrypoints/utils/displayModeMigration'
import { applyContextAwarePromptMigration } from '@/entrypoints/utils/promptMigration'
import { PendingConfigWrites } from './pendingConfigWrites'

// Singleton — shared across all useConfig() calls so components never hold
// stale defaults that overwrite the user's saved settings on save.
const config = ref(new Config())
let _initialized = false

// 守卫标志：防止 storage.watch → Object.assign → deep watch → storage.setItem
// 之间形成无限写回循环。当从 storage 同步数据时，暂时抑制 deep watcher 的写回。
let _updatingFromStorage = false

// 记录上一次写入 storage 的 JSON 快照，避免内容相同时重复写入
let _lastWrittenJson = ''

// 文本输入会在短时间内触发多次变更。串行写入可保证最后一次编辑最后落盘，
// 避免较早的异步 storage.setItem 在较晚写入之后完成并覆盖新内容。
let _writeQueue: Promise<void> = Promise.resolve()
const _localWriteSnapshots = new PendingConfigWrites()

function persistConfigJson(json: string): Promise<void> {
  _lastWrittenJson = json
  _localWriteSnapshots.remember(json)
  const write = _writeQueue.then(async () => {
    await storage.setItem('local:config', json)
  })
  _writeQueue = write.catch((error) => {
    console.error('Failed to save config:', error)
  })
  return write
}

// 监听存储变化（来自其他标签页、Popup/Options 或 background script 的同步）
storage.watch('local:config', (newValue: unknown) => {
  if (typeof newValue === 'string' && newValue) {
    // 跳过当前页面发起的所有排队写入，而不仅是最后一个快照。
    // 否则中间快照落盘时会短暂覆盖用户仍在输入的新内容。
    if (_localWriteSnapshots.consume(newValue)) return

    _updatingFromStorage = true
    _lastWrittenJson = newValue
    Object.assign(config.value, JSON.parse(newValue) as Partial<Config>)
    // nextTick 确保 Vue 的 deep watcher 在本轮已执行完毕后再释放标志
    nextTick(() => {
      _updatingFromStorage = false
    })
  }
})

export function useConfig() {
  const loadConfig = async () => {
    if (_initialized) return config
    _initialized = true

    const value = await storage.getItem('local:config')
    if (typeof value === 'string' && value) {
      const parsedConfig = JSON.parse(value) as Partial<Config>
      let shouldPersistMigration = false
      const modelMigration = applyRetiredClaudeModelMigration(parsedConfig)
      if (modelMigration.status === 'target-missing') {
        console.warn(
          `Skipped Claude model migration because target "${modelMigration.notice.to}" is not a current preset.`,
        )
      } else if (modelMigration.status === 'migrated') {
        shouldPersistMigration = true
        try {
          await saveClaudeModelMigrationNotice(modelMigration.notice)
        } catch (error) {
          console.warn('Failed to save Claude model migration notice:', error)
        }
      }

      const displayModeMigration = applyTranslationOnlyCompatibilityMigration(parsedConfig)
      if (displayModeMigration.status === 'migrated') {
        shouldPersistMigration = true
        try {
          await saveDisplayModeMigrationNotice(displayModeMigration.notice)
        } catch (error) {
          console.warn('Failed to save display mode migration notice:', error)
        }
      }

      const promptMigration = applyContextAwarePromptMigration(parsedConfig)
      if (promptMigration.status === 'migrated') {
        shouldPersistMigration = true
      }

      if (shouldPersistMigration) {
        const migratedJson = JSON.stringify(parsedConfig)
        await persistConfigJson(migratedJson)
      }
      Object.assign(config.value, parsedConfig)
    }

    // Register auto-save only after initial load to avoid persisting
    // default values before the stored config has been read.
    watch(config, (newValue) => {
      // 如果本次变化来自 storage.watch 的同步，不要再写回存储
      if (_updatingFromStorage) return

      const json = JSON.stringify(newValue)
      // 内容没有实际变化时，跳过写入
      if (json === _lastWrittenJson) return

      void persistConfigJson(json)
    }, { deep: true })

    return config
  }

  const saveConfig = () => persistConfigJson(JSON.stringify(config.value))

  return { config, loadConfig, saveConfig }
}
