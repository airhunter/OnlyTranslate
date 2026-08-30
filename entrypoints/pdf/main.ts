import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import '../../styles/theme.css'
import { createAppI18n } from '@/entrypoints/utils/i18n'

createApp(App)
  .use(createAppI18n())
  .mount('#app')
