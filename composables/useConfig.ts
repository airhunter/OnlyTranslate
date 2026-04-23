import { ref, watch, nextTick } from 'vue'
import { Config } from '@/entrypoints/utils/model'
import { storage } from '@wxt-dev/storage'

// Singleton — shared across all useConfig() calls so components never hold
// stale defaults that overwrite the user's saved settings on save.
const config = ref(new Config())
let _initialized = false

// 守卫标志：防止 storage.watch → Object.assign → deep watch → storage.setItem
// 之间形成无限写回循环。当从 storage 同步数据时，暂时抑制 deep watcher 的写回。
let _updatingFromStorage = false

// 记录上一次写入 storage 的 JSON 快照，避免内容相同时重复写入
let _lastWrittenJson = ''

// 监听存储变化（来自其他标签页、Popup/Options 或 background script 的同步）
storage.watch('local:config', (newValue: any) => {
  if (typeof newValue === 'string' && newValue) {
    // 如果本次存储变化就是自己刚写入的，跳过以避免循环
    if (newValue === _lastWrittenJson) return

    _updatingFromStorage = true
    Object.assign(config.value, JSON.parse(newValue))
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
      Object.assign(config.value, JSON.parse(value))
    }

    // Register auto-save only after initial load to avoid persisting
    // default values before the stored config has been read.
    watch(config, (newValue: any) => {
      // 如果本次变化来自 storage.watch 的同步，不要再写回存储
      if (_updatingFromStorage) return

      const json = JSON.stringify(newValue)
      // 内容没有实际变化时，跳过写入
      if (json === _lastWrittenJson) return

      _lastWrittenJson = json
      storage.setItem('local:config', json)
    }, { deep: true })

    return config
  }

  return { config, loadConfig }
}
