import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

interface ThemeConfig {
  theme?: string
}

export function useTheme(config: Ref<ThemeConfig>) {
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const systemTheme = ref<'light' | 'dark'>(darkModeMediaQuery.matches ? 'dark' : 'light')
  const actualTheme = computed<'light' | 'dark'>(() => {
    if (config.value.theme === 'dark') return 'dark'
    if (config.value.theme === 'light') return 'light'
    return systemTheme.value
  })

  function updateTheme(theme: string) {
    const resolvedTheme = theme === 'auto' ? systemTheme.value : theme
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }

  watch(actualTheme, theme => updateTheme(theme), { immediate: true })

  darkModeMediaQuery.onchange = event => {
    systemTheme.value = event.matches ? 'dark' : 'light'
  }

  onUnmounted(() => {
    darkModeMediaQuery.onchange = null
  })

  return { updateTheme, darkModeMediaQuery, actualTheme }
}
