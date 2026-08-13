import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import { submitPrivateFeedback } from '@/entrypoints/utils/privateFeedback'
import HelpGroup from '@/components/options/HelpGroup.vue'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ version: '1.2.3' }),
    },
  },
}))

vi.mock('@/entrypoints/utils/translationDiagnostics', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entrypoints/utils/translationDiagnostics')>()
  return {
    ...original,
    getRecentTranslationDiagnostics: vi.fn().mockResolvedValue([]),
    clearTranslationDiagnostics: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/entrypoints/utils/privateFeedback', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entrypoints/utils/privateFeedback')>()
  return {
    ...original,
    submitPrivateFeedback: vi.fn().mockResolvedValue('OT-20260813-TEST'),
  }
})

describe('HelpGroup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
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
    expect(wrapper.findAll('.help-topic')).toHaveLength(8)
    expect(wrapper.findAll('.help-toc-link')).toHaveLength(8)
  })

  it('presents readable operation steps and compact screenshots', () => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })

    expect(wrapper.text()).toContain('第一次翻译网页')
    expect(wrapper.text()).toContain('输入框翻译')
    expect(wrapper.text()).toContain('电子书翻译（Beta）')
    expect(wrapper.text()).toContain('章节导航与键盘操作')
    expect(wrapper.text()).toContain('Shift + Space')
    expect(wrapper.text()).toContain('翻译缓存与清理')
    expect(wrapper.text()).toContain('自定义网关')
    expect(wrapper.text()).toContain('查看字幕 FastMode 状态')
    expect(wrapper.text()).toContain('如果视频字幕加载流畅，可以直接忽略')
    expect(wrapper.findAll('.help-steps').length).toBeGreaterThanOrEqual(10)
    expect(wrapper.findAll('.help-figure img')).toHaveLength(2)
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

    await search.setValue('公测')
    expect(wrapper.text()).toContain('电子书翻译（Beta）')
    expect(wrapper.findAll('.help-topic')).toHaveLength(1)

    await search.setValue('PageDown')
    expect(wrapper.text()).toContain('章节导航与键盘操作')
    expect(wrapper.findAll('.help-topic')).toHaveLength(1)

    await search.setValue('完全不存在的关键词')
    expect(wrapper.get('[data-testid="help-empty"]').text()).toContain('没有找到相关内容')
  })

  it('provides private and public feedback entries', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })

    expect(wrapper.get('.help-toc-link').attributes('href')).toBe('#help-topic-quick-start')
    expect(wrapper.get('.help-hero').find('[data-testid="open-private-feedback"]').exists()).toBe(true)
    expect(wrapper.get('.help-hero').find('[data-testid="open-public-feedback"]').exists()).toBe(true)
    await wrapper.get('[data-testid="open-private-feedback"]').trigger('click')
    expect(wrapper.find('[data-testid="private-feedback-form"]').exists()).toBe(true)
    expect(wrapper.get('.help-hero').element.nextElementSibling).toBe(wrapper.get('[data-testid="private-feedback-form"]').element)

    await wrapper.get('[data-testid="open-public-feedback"]').trigger('click')

    expect(open).toHaveBeenCalledTimes(1)
    expect(String(open.mock.calls[0][0])).toContain('github.com/airhunter/OnlyTranslate/issues/new')
  })

  it('describes the diagnostic ranges and page URL handling explicitly', async () => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('en-US')] },
    })

    await wrapper.get('[data-testid="open-private-feedback"]').trigger('click')
    await wrapper.get('[data-testid="include-diagnostics"]').setValue(true)

    expect(wrapper.text()).toContain('Most recent translation')
    expect(wrapper.text()).toContain('3 most recent translations')
    expect(wrapper.text()).toContain('query parameters are retained')
    expect(wrapper.find('[data-testid="private-feedback-email"]').exists()).toBe(false)

    await wrapper.get('[data-testid="include-contact"]').setValue(true)
    const email = wrapper.get('[data-testid="private-feedback-email"]')
    expect(email.attributes('type')).toBe('email')
    expect(email.attributes('maxlength')).toBe('254')
    expect(email.attributes('required')).toBeDefined()
    expect(wrapper.text()).toContain('used only to follow up on this feedback')
  })

  it('submits contact details only after explicit opt-in', async () => {
    const wrapper = mount(HelpGroup, {
      global: { plugins: [createAppI18n('zh-CN')] },
    })

    await wrapper.get('[data-testid="open-private-feedback"]').trigger('click')
    await wrapper.get('[data-testid="private-feedback-message"]').setValue('页面翻译失败')
    await wrapper.get('[data-testid="include-contact"]').setValue(true)
    await wrapper.get('[data-testid="private-feedback-email"]').setValue(' user@example.com ')
    await wrapper.get('[data-testid="submit-private-feedback"]').trigger('click')

    await vi.waitFor(() => expect(submitPrivateFeedback).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      message: '页面翻译失败',
      contact: { email: 'user@example.com', consent: true },
    })))
  })
})
