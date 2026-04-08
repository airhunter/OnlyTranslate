import { ref, watch } from 'vue'
import { Config } from '@/entrypoints/utils/model'
import { storage } from '@wxt-dev/storage'

export function useConfig() {
  const config = ref(new Config())

  // Load config from storage
  const loadConfig = async () => {
    const value = await storage.getItem('local:config')
    if (typeof value === 'string' && value) {
      Object.assign(config.value, JSON.parse(value))
    }
    return config
  }

  // Watch storage for external changes (e.g., from Options page)
  storage.watch('local:config', (newValue: any) => {
    if (typeof newValue === 'string' && newValue) {
      Object.assign(config.value, JSON.parse(newValue))
    }
  })

  // Auto-save config changes to storage
  watch(config, (newValue: any) => {
    storage.setItem('local:config', JSON.stringify(newValue))
  }, { deep: true })

  return { config, loadConfig }
}