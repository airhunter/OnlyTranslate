import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FloatingBall from '@/components/FloatingBall.vue'
import { setLocale } from '@/entrypoints/utils/i18n'

const mockConfig = vi.hoisted(() => ({
  animations: false,
  display: 1,
  service: 'deepseek',
  translationScope: 'smart' as 'smart' | 'full',
  token: {
    deepseek: 'deepseek-token',
    openai: 'openai-token'
  } as Record<string, string>,
  customProviders: [] as Array<{ id: string; name?: string; url?: string }>
}))

vi.mock('@/entrypoints/utils/config', () => ({
  config: mockConfig
}))

describe('FloatingBall', () => {
  beforeEach(() => {
    mockConfig.animations = false
    mockConfig.display = 1
    mockConfig.service = 'deepseek'
    mockConfig.translationScope = 'smart'
    mockConfig.token = {
      deepseek: 'deepseek-token',
      openai: 'openai-token'
    }
    mockConfig.customProviders = []
    setLocale('zh-CN')
  })

  it('opens a docked toolbar beside the recall entry before running page translation actions', async () => {
    const onTranslationToggle = vi.fn()
    const onScopeChanged = vi.fn()
    const onSettingsClick = vi.fn()
    const onPositionChanged = vi.fn()
    const onServiceChanged = vi.fn()

    const wrapper = mount(FloatingBall, {
      props: {
        onTranslationToggle,
        onScopeChanged,
        onSettingsClick,
        onPositionChanged,
        onServiceChanged
      },
      attachTo: document.body
    })

    expect(wrapper.get('.fr-floating-ball [data-testid="floating-toolbar"]').classes()).not.toContain('floating-toolbar--open')

    const trigger = wrapper.get('[data-testid="floating-ball-trigger"]')
    await trigger.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }))
    await nextTick()
    await trigger.trigger('click')

    expect(onTranslationToggle).not.toHaveBeenCalled()
    expect(onPositionChanged).not.toHaveBeenCalled()
    expect(wrapper.get('.fr-floating-ball [data-testid="floating-toolbar"]').classes()).toContain('floating-toolbar--open')
    expect(wrapper.text()).toContain('翻译')
    expect(wrapper.text()).toContain('识文')
    expect(wrapper.text()).toContain('DeepSeek')
    expect(wrapper.text()).toContain('更多')

    await wrapper.get('[data-testid="floating-toolbar-translate"]').trigger('click')
    expect(onTranslationToggle).toHaveBeenCalledWith(true)

    await wrapper.get('[data-testid="floating-toolbar-scope"]').trigger('mousedown', { button: 0, clientX: 120, clientY: 120 })
    await wrapper.get('[data-testid="floating-toolbar-scope"]').trigger('click')
    expect(onScopeChanged).toHaveBeenCalledWith('full')
    expect(wrapper.get('[data-testid="floating-toolbar-scope"]').attributes('data-scope')).toBe('full')
    expect(mockConfig.translationScope).toBe('smart')
    expect(onPositionChanged).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="floating-toolbar-scope"]').trigger('click')
    expect(onScopeChanged).toHaveBeenLastCalledWith('smart')
    expect(wrapper.get('[data-testid="floating-toolbar-scope"]').attributes('data-scope')).toBe('smart')
    expect(mockConfig.translationScope).toBe('smart')

    await wrapper.get('[data-testid="floating-toolbar-service"]').trigger('click')
    expect(wrapper.get('[data-testid="floating-toolbar-service-menu"]').classes()).toContain('service-menu--open')

    await wrapper.get('[data-testid="floating-toolbar-service-openai"]').trigger('click')
    expect(onServiceChanged).toHaveBeenCalledWith('openai')
    expect(wrapper.get('[data-testid="floating-toolbar-service"]').text()).toContain('OpenAI')
    expect(mockConfig.service).toBe('deepseek')

    await wrapper.get('[data-testid="floating-toolbar-more"]').trigger('click')
    expect(onSettingsClick).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('uses detached capsule styling and keeps more secondary after translating', async () => {
    const wrapper = mount(FloatingBall, {
      attachTo: document.body
    })

    const trigger = wrapper.get('[data-testid="floating-ball-trigger"]')
    await trigger.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }))
    await nextTick()
    await trigger.trigger('click')

    const toolbar = wrapper.get('[data-testid="floating-toolbar"]')
    expect(toolbar.classes()).toContain('floating-toolbar--detached')

    await wrapper.get('[data-testid="floating-toolbar-translate"]').trigger('click')

    const translateButton = wrapper.get('[data-testid="floating-toolbar-translate"]')
    const moreButton = wrapper.get('[data-testid="floating-toolbar-more"]')

    expect(translateButton.classes()).toContain('toolbar-button--restore')
    expect(moreButton.classes()).toContain('toolbar-button--secondary')
    expect(moreButton.classes()).not.toContain('toolbar-button--restore')

    wrapper.unmount()
  })

  it('closes the toolbar when the recall entry is clicked again', async () => {
    const wrapper = mount(FloatingBall, {
      attachTo: document.body
    })

    const trigger = wrapper.get('[data-testid="floating-ball-trigger"]')
    const toolbar = wrapper.get('[data-testid="floating-toolbar"]')

    await trigger.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }))
    await nextTick()
    await trigger.trigger('click')
    expect(toolbar.classes()).toContain('floating-toolbar--open')

    await trigger.trigger('mousedown', { button: 0, clientX: 100, clientY: 100 })
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }))
    await nextTick()
    await trigger.trigger('click')
    expect(toolbar.classes()).not.toContain('floating-toolbar--open')

    wrapper.unmount()
  })

  it('persists side and vertical offset after dragging the recall entry', async () => {
    const onPositionChanged = vi.fn()

    const wrapper = mount(FloatingBall, {
      props: {
        onPositionChanged
      },
      attachTo: document.body
    })

    const ball = wrapper.get('.fr-floating-ball').element as HTMLElement
    vi.spyOn(ball, 'getBoundingClientRect').mockReturnValue({
      x: 700,
      y: 220,
      left: 700,
      top: 220,
      right: 742,
      bottom: 262,
      width: 42,
      height: 42,
      toJSON: () => ({})
    } as DOMRect)

    await wrapper.get('[data-testid="floating-ball-trigger"]').trigger('mousedown', {
      button: 0,
      clientX: 700,
      clientY: 220
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 760, clientY: 260, bubbles: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 760, clientY: 260, bubbles: true }))

    expect(onPositionChanged).toHaveBeenCalledWith('right', 220)

    wrapper.unmount()
  })

  it('clamps the restored vertical offset when the viewport is resized smaller', async () => {
    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true
    })

    const wrapper = mount(FloatingBall, {
      props: {
        offsetY: 260
      },
      attachTo: document.body
    })

    const ball = wrapper.get('.fr-floating-ball')
    vi.spyOn(ball.element as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      x: 700,
      y: 260,
      left: 700,
      top: 260,
      right: 742,
      bottom: 302,
      width: 42,
      height: 42,
      toJSON: () => ({})
    } as DOMRect)

    Object.defineProperty(window, 'innerHeight', {
      value: 80,
      configurable: true
    })
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(ball.attributes('style')).toContain('top: 30px')

    wrapper.unmount()
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true
    })
  })
})
