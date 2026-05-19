import {createApp} from 'vue';
import './style.css';
import App from './App.vue';
import 'element-plus/dist/index.css'
import { ChatDotRound, Setting, Refresh, Edit, Upload, Download, Star, Loading, Coffee, WarningFilled, Warning, CircleCheckFilled } from '@element-plus/icons-vue'
import { createAppI18n } from '@/entrypoints/utils/i18n'

import {
  ElRow,
  ElCol,
  ElContainer,
  ElHeader,
  ElMain,
  ElFooter,
  ElSelect,
  ElOption,
  ElOptionGroup,
  ElInput,
  ElSwitch,
  ElCollapse,
  ElCollapseItem,
  ElTooltip,
  ElEmpty,
  ElIcon,
  ElMessage,
  ElLink,
  ElText,
  ElButton,
  ElDialog,
  ElDivider,
  ElInputNumber
} from 'element-plus'

const app = createApp(App);
const i18n = createAppI18n()
app.use(i18n)

// 按需注册组件
const components = [
  ElRow,
  ElCol,
  ElContainer,
  ElHeader,
  ElMain,
  ElFooter,
  ElSelect,
  ElOption,
  ElOptionGroup,
  ElInput,
  ElSwitch,
  ElCollapse,
  ElCollapseItem,
  ElTooltip,
  ElEmpty,
  ElIcon,
  ElLink,
  ElText,
  ElButton,
  ElDialog,
  ElDivider,
  ElInputNumber
]

components.forEach(component => {
  if (component.name) {
    app.component(component.name, component)
  }
})

// 注册使用到的图标
app.component('ChatDotRound', ChatDotRound)
app.component('Setting', Setting)
app.component('Refresh', Refresh)
app.component('Edit', Edit)
app.component('Upload', Upload)
app.component('Download', Download)
app.component('Star', Star)
app.component('Loading', Loading)
app.component('Coffee', Coffee)
app.component('WarningFilled', WarningFilled)
app.component('Warning', Warning)
app.component('CircleCheckFilled', CircleCheckFilled)

app.mount('#app');
