import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '../../entrypoints/utils/i18n'
import PdfOutline from '../../entrypoints/pdf/PdfOutline.vue'

const child = { id: '0.0', title: 'Chapter <script>unsafe</script>', dest: 'chapter', items: [] }
const parent = { id: '0', title: 'Part One', dest: null, items: [child] }

describe('PDF outline panel', () => {
  it('expands and collapses a parent with no destination, and emits leaf selection', async () => {
    const wrapper = mount(PdfOutline, { props: { items: [parent], activeId: '' }, global: { plugins: [createAppI18n('zh-CN')] } })
    expect(wrapper.findAll('li')).toHaveLength(2)
    await wrapper.get('.pdf-outline__expand').trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.get('.pdf-outline__expand').attributes('aria-expanded')).toBe('false')
    await wrapper.get('.pdf-outline__title').trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(2)
    await wrapper.findAll('.pdf-outline__title')[1].trigger('click')
    expect(wrapper.emitted('select')).toEqual([[child]])
  })

  it('renders titles as text and exposes the selected location accessibly', () => {
    const wrapper = mount(PdfOutline, { props: { items: [parent], activeId: child.id }, global: { plugins: [createAppI18n('en-US')] } })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('[aria-current="location"]').text()).toBe(child.title)
  })

  it('resets expansion when the document changes and keeps external-only entries inert', async () => {
    const wrapper = mount(PdfOutline, { props: { items: [parent], activeId: '' }, global: { plugins: [createAppI18n('zh-CN')] } })
    await wrapper.get('.pdf-outline__expand').trigger('click')
    await wrapper.setProps({ items: [{ ...parent, title: 'New document' }] })
    expect(wrapper.findAll('li')).toHaveLength(2)
    await wrapper.setProps({ items: [{ id: '0', title: '', dest: null, items: [] }] })
    expect(wrapper.get('.pdf-outline__title').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.pdf-outline__title').text()).toBe('未命名章节')
  })
})
