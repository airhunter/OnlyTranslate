import { ref, watch } from 'vue'
import { Config } from '@/entrypoints/utils/model'
import { storage } from '@wxt-dev/storage'

// Singleton — shared across all useConfig() calls so components never hold
// stale defaults that overwrite the user's saved settings on save.
const config = ref(new Config())
let _initialized = false

// Sync inbound changes from storage (e.g. another tab, background script)
storage.watch('local:config', (newValue: any) => {
  if (typeof newValue === 'string' && newValue) {
    Object.assign(config.value, JSON.parse(newValue))
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
      storage.setItem('local:config', JSON.stringify(newValue))
    }, { deep: true })

    return config
  }

  return { config, loadConfig }
}
