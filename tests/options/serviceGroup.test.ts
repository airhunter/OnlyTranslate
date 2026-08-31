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
      'el-select': {
        name: 'ElSelect',
        emits: ['visible-change', 'update:model-value'],
        template: '<div><slot /></div>',
      },
      'el-switch': true,
      'el-tooltip': {
        template: '<div><slot /></div>'
      },
    }
  }
})

const getModelPicker = (
  wrapper: ReturnType<typeof mountGroup>,
  testId: 'custom-provider-model-picker' | 'builtin-model-picker',
) => {
  const picker = wrapper.findAllComponents({ name: 'ElSelect' })
    .find(component => component.attributes('data-testid') === testId)
  if (!picker) throw new Error(`Missing model picker: ${testId}`)
  return picker
}

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

  it('loads custom provider models when the model picker first opens', async () => {
    mocks.config.value.customProviders = [{
      id: 'custom_openai',
      name: 'Local gateway',
      protocol: 'openai',
      url: 'http://localhost:11434/v1',
      token: '',
      model: '自定义模型',
      customModel: 'manual-model',
    }]
    mocks.fetchModels.mockResolvedValue([
      'remote-model-a',
      'remote-model-b',
      '自定义模型',
    ])
    const wrapper = mountGroup()
    const picker = getModelPicker(wrapper, 'custom-provider-model-picker')

    picker.vm.$emit('visible-change', true)
    await flushPromises()
    picker.vm.$emit('visible-change', true)
    await flushPromises()

    expect(mocks.fetchModels).toHaveBeenCalledOnce()
    expect(mocks.fetchModels).toHaveBeenCalledWith('custom_openai', {
      token: '',
      url: 'http://localhost:11434/v1',
      protocol: 'openai',
    })
    expect(mocks.config.value.customProviders[0].customModel).toBe('manual-model')
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('recommends a replacement without changing a retired custom Anthropic model', () => {
    mocks.config.value.customProviders = [{
      id: 'custom_anthropic',
      name: 'Anthropic gateway',
      protocol: 'anthropic',
      url: 'https://gateway.example',
      token: '',
      model: '自定义模型',
      customModel: 'claude-opus-4-1',
    }]

    const wrapper = mountGroup()

    expect(wrapper.text()).toContain('型号 claude-opus-4-1 已停止服务，建议改用 claude-opus-4-8')
    expect(mocks.config.value.customProviders[0].customModel).toBe('claude-opus-4-1')
  })

  it('falls back to Google when removing an unconfigured current service', async () => {
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

    expect(mocks.config.value.service).toBe('google')
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

  it('loads built-in models on first picker open without replacing the current selection', async () => {
    mocks.config.value.activeBuiltinProviders = ['deepseek']
    mocks.config.value.token.deepseek = 'configured-token'
    mocks.config.value.model.deepseek = 'manual-model'
    mocks.fetchModels.mockResolvedValue([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      '自定义模型',
    ])
    const wrapper = mountGroup()
    const picker = getModelPicker(wrapper, 'builtin-model-picker')

    picker.vm.$emit('visible-change', true)
    await flushPromises()
    picker.vm.$emit('visible-change', true)
    await flushPromises()

    expect(mocks.fetchModels).toHaveBeenCalledOnce()
    expect(mocks.config.value.model.deepseek).toBe('manual-model')
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('does not auto-load built-in models before an API key is configured', async () => {
    mocks.config.value.activeBuiltinProviders = ['deepseek']
    mocks.config.value.model.deepseek = 'deepseek-v4-flash'
    const wrapper = mountGroup()

    getModelPicker(wrapper, 'builtin-model-picker').vm.$emit('visible-change', true)
    await flushPromises()

    expect(mocks.fetchModels).not.toHaveBeenCalled()
  })
})
