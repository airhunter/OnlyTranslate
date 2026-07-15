import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import OnboardingCard from '@/components/OnboardingCard.vue'

const mocks = vi.hoisted(() => ({
  config: { value: { service: 'microsoft' } },
  getItem: vi.fn(),
  setItem: vi.fn()
}))

vi.mock('@/composables/useConfig', () => ({
  useConfig: () => ({ config: mocks.config })
}))

vi.mock('@wxt-dev/storage', () => ({
  storage: {
    getItem: mocks.getItem,
    setItem: mocks.setItem
  }
}))

const mountCard = () => mount(OnboardingCard, {
  global: {
    plugins: [createAppI18n('zh-CN')],
    stubs: {
      'el-icon': true
    }
  }
})

describe('OnboardingCard', () => {
  beforeEach(() => {
    mocks.config.value.service = 'microsoft'
    mocks.getItem.mockReset()
    mocks.getItem.mockResolvedValue(undefined)
    mocks.setItem.mockReset()
  })

  it('shows the original welcome card and selects a recommended service without navigation', async () => {
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.text()).toContain('欢迎使用「只译」')
    await wrapper.findAll('.onboarding-service-item')[0].trigger('click')

    expect(mocks.config.value.service).toBe('siliconCloud')
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('persists dismissal and hides the card', async () => {
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.find('.onboarding-dismiss').trigger('click')

    expect(mocks.setItem).toHaveBeenCalledWith('local:onboardingDismissed', true)
    expect(wrapper.find('.onboarding-card').exists()).toBe(false)
  })

  it('stays hidden when it was previously dismissed', async () => {
    mocks.getItem.mockResolvedValue(true)
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.find('.onboarding-card').exists()).toBe(false)
  })
})
