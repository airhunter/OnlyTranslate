import { watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export function useTheme(config: Ref<any>) {
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function updateTheme(theme: string) {
    if (theme === 'auto') {
      // Auto mode: use system preference
      const isDark = darkModeMediaQuery.matches
      document.documentElement.classList.toggle('dark', isDark)
    } else {
      // Manual mode: use selected theme
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }

  // Watch config.theme changes
  watch(() => config.value.theme, (newTheme) => {
    updateTheme(newTheme || 'auto')
  })

  // Listen for system theme changes (auto mode)
  darkModeMediaQuery.onchange = () => {
    if (config.value.theme === 'auto') {
      updateTheme('auto')
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    darkModeMediaQuery.onchange = null
  })

  return { updateTheme, darkModeMediaQuery }
}