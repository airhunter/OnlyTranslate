import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import OnboardingCard from '@/components/OnboardingCard.vue'

const mocks = vi.hoisted(() => ({
  config: {
    value: {
      service: 'microsoft',
      activeBuiltinProviders: [] as string[],
      customProviders: [],
      token: {} as Record<string, string>,
      newApiUrl: '',
    }
  },
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
    mocks.config.value.activeBuiltinProviders = []
    mocks.config.value.token = {}
    mocks.getItem.mockReset()
    mocks.getItem.mockResolvedValue(undefined)
    mocks.setItem.mockReset()
  })

  it('adds an unconfigured recommended service without making it current', async () => {
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.text()).toContain('欢迎使用「只译」')
    await wrapper.findAll('.onboarding-service-item')[0].trigger('click')

    expect(mocks.config.value.activeBuiltinProviders).toEqual(['siliconCloud'])
    expect(mocks.config.value.service).toBe('microsoft')
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('can switch directly to a recommended service that needs no configuration', async () => {
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.findAll('.onboarding-service-item')[2].trigger('click')

    expect(mocks.config.value.service).toBe('chromeTranslator')
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
