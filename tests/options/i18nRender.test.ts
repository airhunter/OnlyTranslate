import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import AISettingsGroup from '@/components/options/AISettingsGroup.vue'
import GeneralGroup from '@/components/options/GeneralGroup.vue'
import AboutGroup from '@/components/options/AboutGroup.vue'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ version: '0.4.0' }),
      getURL: (path: string) => path
    }
  }
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    watch: vi.fn()
  }
}))

const global = {
  plugins: [createAppI18n('zh-CN')],
  stubs: {
    'el-button': true,
    'el-icon': true,
    'el-input': true,
    'el-input-number': true,
    'el-option': true,
    'el-select': true,
    'el-switch': true,
    'el-tooltip': true
  }
}

describe('options i18n render', () => {
  it('renders AI settings without i18n message compiler errors', () => {
    const wrapper = mount(AISettingsGroup, { global })
    expect(wrapper.text()).toContain('核心 Prompt 调试台')
  })

  it('renders general settings', () => {
    const wrapper = mount(GeneralGroup, { global })
    expect(wrapper.text()).toContain('视觉呈现')
  })

  it('renders about page', () => {
    const wrapper = mount(AboutGroup, { global })
    expect(wrapper.text()).toContain('关于只译')
  })
})
