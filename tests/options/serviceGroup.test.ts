import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createAppI18n } from '@/entrypoints/utils/i18n'
import ServiceGroup from '@/components/options/ServiceGroup.vue'

const mocks = vi.hoisted(() => ({
  config: {
    __v_isRef: true,
    value: {
      service: 'microsoft',
      to: 'zh-Hans',
      bidirectionalTranslation: false,
      bidirectionalTarget: 'en',
      activeBuiltinProviders: [] as string[],
      customProviders: [] as Array<{
        id: string
        name: string
        protocol?: 'openai' | 'anthropic'
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
  fetchModels: vi.fn(),
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

vi.mock('@/entrypoints/utils/modelCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entrypoints/utils/modelCatalog')>()
  return {
    ...actual,
    fetchProviderModels: mocks.fetchModels,
  }
})

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
    mocks.config.value.model = {}
    mocks.config.value.customModel = {}
    mocks.config.value.proxy = {}
    mocks.config.value.thinking = {}
    mocks.success.mockReset()
    mocks.warning.mockReset()
    mocks.fetchModels.mockReset()
  })

  it('does not make a newly added custom service current', async () => {
    const wrapper = mountGroup()

    await wrapper.find('.gallery-item--custom').trigger('click')

    expect(mocks.config.value.customProviders).toHaveLength(1)
    expect(mocks.config.value.customProviders[0].protocol).toBe('openai')
    expect(mocks.config.value.service).toBe('microsoft')
  })

  it('shows the completed request URL below the custom provider address', async () => {
    mocks.config.value.customProviders = [{
      id: 'custom_anthropic',
      name: 'Anthropic gateway',
      protocol: 'anthropic',
      url: 'https://gateway.example/v1',
      token: '',
      model: '自定义模型',
      customModel: 'claude-test',
    }]
    const wrapper = mountGroup()

    expect(wrapper.get('[data-testid="custom-provider-endpoint-preview"]').text())
      .toContain('https://gateway.example/v1/messages')
  })

  it('refreshes custom provider models without replacing a manually entered model', async () => {
    mocks.config.value.customProviders = [{
      id: 'custom_anthropic',
      name: 'Anthropic gateway',
      protocol: 'anthropic',
      url: 'https://gateway.example',
      token: 'anthropic-token',
      model: '自定义模型',
      customModel: 'manual-model',
    }]
    mocks.fetchModels.mockResolvedValue([
      'claude-remote-a',
      'claude-remote-b',
      '自定义模型',
    ])
    const wrapper = mountGroup()

    await wrapper.get('[data-testid="custom-provider-model-refresh"]').trigger('click')
    await flushPromises()

    expect(mocks.fetchModels).toHaveBeenCalledWith('custom_anthropic', {
      token: 'anthropic-token',
      url: 'https://gateway.example',
      protocol: 'anthropic',
    })
    expect(mocks.config.value.customProviders[0].customModel).toBe('manual-model')
    expect(wrapper.text()).toContain('已从厂商接口获取 2 个模型')
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

  it('replaces an unavailable DeepSeek selection with the refreshed provider catalog', async () => {
    mocks.config.value.activeBuiltinProviders = ['deepseek']
    mocks.config.value.token.deepseek = 'configured-token'
    mocks.config.value.model.deepseek = 'retired-model'
    mocks.fetchModels.mockResolvedValue([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      '自定义模型',
    ])
    const wrapper = mountGroup()
    const refreshButton = wrapper.find('button[aria-label="刷新模型列表"]')

    expect(refreshButton.exists()).toBe(true)
    await refreshButton.trigger('click')
    await flushPromises()

    expect(mocks.fetchModels).toHaveBeenCalledWith('deepseek', {
      token: 'configured-token',
      url: 'https://api.deepseek.com/chat/completions',
    })
    expect(mocks.config.value.model.deepseek).toBe('deepseek-v4-flash')
  })
})
