import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import HelpGroup from '@/components/options/HelpGroup.vue'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ version: '1.2.3' }),
    },
  },
}))

describe('HelpGroup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['zh-CN', '只译使用帮助'],
    ['en-US', 'OnlyTranslate Help'],
    ['zh-TW', '只譯使用說明'],
    ['ja-JP', 'OnlyTranslate ヘルプ'],
  ] as const)('renders the localized user guide for %s', (locale, title) => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n(locale)] },
    })

    expect(wrapper.text()).toContain(title)
    expect(wrapper.findAll('.help-topic')).toHaveLength(6)
    expect(wrapper.findAll('.help-toc-link')).toHaveLength(6)
  })

  it('presents readable operation steps and compact screenshots', () => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })

    expect(wrapper.text()).toContain('第一次翻译网页')
    expect(wrapper.text()).toContain('输入框翻译')
    expect(wrapper.text()).toContain('自定义网关')
    expect(wrapper.findAll('.help-steps').length).toBeGreaterThanOrEqual(10)
    expect(wrapper.findAll('.help-figure img')).toHaveLength(3)
    expect(wrapper.get('.help-figure img').attributes('loading')).toBe('lazy')
  })

  it('searches localized guide content and shows an empty state', async () => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })
    const search = wrapper.get('[data-testid="help-search"]')

    await search.setValue('连续三次空格')
    expect(wrapper.text()).toContain('输入框翻译')
    expect(wrapper.findAll('.help-topic')).toHaveLength(1)

    await search.setValue('完全不存在的关键词')
    expect(wrapper.get('[data-testid="help-empty"]').text()).toContain('没有找到相关内容')
  })

  it('provides anchored contents and opens a sanitized feedback issue', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })

    expect(wrapper.get('.help-toc-link').attributes('href')).toBe('#help-topic-quick-start')
    await wrapper.get('.help-action').trigger('click')

    expect(open).toHaveBeenCalledTimes(1)
    expect(String(open.mock.calls[0][0])).toContain('github.com/airhunter/OnlyTranslate/issues/new')
  })
})
