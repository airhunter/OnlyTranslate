import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import ServiceGroup from '@/components/options/ServiceGroup.vue'

const mocks = vi.hoisted(() => ({
  config: {
    value: {
      service: 'microsoft',
      to: 'zh-Hans',
      bidirectionalTranslation: false,
      bidirectionalTarget: 'en',
      activeBuiltinProviders: [] as string[],
      customProviders: [] as Array<{
        id: string
        name: string
        url: string
        token: string
        model: string
        customModel: string
      }>,
      token: {} as Record<string, string>,
      model: {} as Record<string, string>,
      customModel: {} as Record<string, string>,
      proxy: {} as Record<string, string>,
      thinking: {} as Record<string, boolean>,
      newApiUrl: '',
    }
  },
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/composables/useConfig', () => ({
  useConfig: () => ({ config: mocks.config })
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: mocks.success,
    warning: mocks.warning,
    error: vi.fn(),
  }
}))

const mountGroup = () => mount(ServiceGroup, {
  global: {
    plugins: [createAppI18n('zh-CN')],
    stubs: {
      'el-button': {
        template: '<button type="button"><slot /></button>'
      },
      'el-dialog': {
        template: '<div><slot /></div>'
      },
      'el-icon': true,
      'el-input': true,
      'el-option': true,
      'el-select': true,
      'el-switch': true,
      'el-tooltip': {
        template: '<div><slot /></div>'
      },
    }
  }
})

describe('ServiceGroup', () => {
  beforeEach(() => {
    mocks.config.value.service = 'microsoft'
    mocks.config.value.activeBuiltinProviders = []
    mocks.config.value.customProviders = []
    mocks.config.value.token = {}
    mocks.success.mockReset()
    mocks.warning.mockReset()
  })

  it('does not make a newly added custom service current', async () => {
    const wrapper = mountGroup()

    await wrapper.find('.gallery-item--custom').trigger('click')

    expect(mocks.config.value.customProviders).toHaveLength(1)
    expect(mocks.config.value.service).toBe('microsoft')
  })

  it('falls back to Microsoft when removing an unconfigured current service', async () => {
    mocks.config.value.service = 'custom_pending'
    mocks.config.value.customProviders = [{
      id: 'custom_pending',
      name: 'Pending provider',
      url: '',
      token: '',
      model: 'custom',
      customModel: '',
    }]
    const wrapper = mountGroup()
    const removeButton = wrapper.findAll('.provider-panel-actions button')
      .find(button => button.text().includes('移除'))

    expect(removeButton).toBeDefined()
    await removeButton!.trigger('click')

    expect(mocks.config.value.service).toBe('microsoft')
    expect(mocks.config.value.customProviders).toEqual([])
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledOnce()
  })
})
