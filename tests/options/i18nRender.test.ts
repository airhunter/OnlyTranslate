import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import AISettingsGroup from '@/components/options/AISettingsGroup.vue'
import GeneralGroup from '@/components/options/GeneralGroup.vue'
import AboutGroup from '@/components/options/AboutGroup.vue'

const mocks = vi.hoisted(() => ({
  clearTranslationCache: vi.fn(),
}))

vi.mock('@/entrypoints/utils/clearTranslationCache', () => ({
  clearTranslationCache: mocks.clearTranslationCache,
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clearTranslationCache.mockResolvedValue({ clearedPageTabs: 0, videoSubtitleEntries: 0 })
  })

  it.each([
    ['zh-CN', '思考模式'],
    ['en-US', 'Thinking mode'],
    ['zh-TW', '思考模式'],
    ['ja-JP', '思考モード']
  ])('localizes the per-service thinking setting for %s', (locale, label) => {
    const i18n = createAppI18n(locale as 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP')
    expect(i18n.global.t('options.service.thinkingMode')).toBe(label)
    expect(i18n.global.t('options.service.thinkingModeTip')).not.toBe('options.service.thinkingModeTip')
  })

  it('renders AI settings without i18n message compiler errors', () => {
    const wrapper = mount(AISettingsGroup, { global })
    expect(wrapper.text()).toContain('核心 Prompt 调试台')
  })

  it('renders general settings', () => {
    const wrapper = mount(GeneralGroup, { global })
    expect(wrapper.text()).toContain('视觉呈现')
    expect(wrapper.text()).toContain('字幕翻译优先速度')
    expect(wrapper.text()).toContain('清除已缓存译文')
    expect(wrapper.get('.cache-clear-button').attributes('type')).toBe('primary')
  })

  it('clears translation caches from general settings', async () => {
    const wrapper = mount(GeneralGroup, { global })

    await wrapper.get('.cache-clear-button').trigger('click')
    await flushPromises()

    expect(mocks.clearTranslationCache).toHaveBeenCalledOnce()
  })

  it('renders about page with official website and source links', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mount(AboutGroup, { global })

    expect(wrapper.text()).toContain('关于只译')
    expect(wrapper.text()).toContain('官方网站')
    expect(wrapper.text()).toContain('GitHub 源码')

    await wrapper.get('[data-testid="official-website-link"]').trigger('click')
    expect(openSpy).toHaveBeenCalledWith('https://onlytranslate.top/', '_blank', 'noopener,noreferrer')

    await wrapper.get('[data-testid="github-link"]').trigger('click')
    expect(openSpy).toHaveBeenCalledWith('https://github.com/airhunter/OnlyTranslate', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it.each([
    ['zh-CN', '“只译” (OnlyTranslate) 隐私权政策', '最后更新日期', '不会自动收集'],
    ['en-US', 'OnlyTranslate Privacy Policy', 'Last updated', 'does not automatically collect'],
    ['zh-TW', '「只譯」(OnlyTranslate) 隱私權政策', '最後更新日期', '不會自動收集'],
    ['ja-JP', '「OnlyTranslate」プライバシーポリシー', '最終更新日', '個人情報'],
  ])('renders the localized privacy policy for %s', (locale, title, meta, body) => {
    const i18n = createAppI18n(locale as 'zh-CN' | 'en-US' | 'zh-TW' | 'ja-JP')
    const wrapper = mount(AboutGroup, {
      global: {
        ...global,
        plugins: [i18n],
      },
    })

    expect(wrapper.get('.privacy-title').text()).toBe(title)
    expect(wrapper.get('.privacy-meta').text()).toContain(meta)
    expect(wrapper.get('.privacy-doc').text()).toContain(body)
  })
})
